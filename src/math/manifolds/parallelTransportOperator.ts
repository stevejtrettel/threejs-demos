/**
 * Parallel-transport **operator** along a curve.
 *
 * Where `parallelTransport` integrates a single vector's image, this
 * function returns the full transport operator `R(t): T_{γ(0)} M → T_{γ(t)} M`
 * as a matrix at each sample. Expressed between orthonormal frames built
 * from the metric at each endpoint, the operator lives in `SO(n)` (Levi-
 * Civita transport is an isometry, and the Cholesky-based frame choice
 * is orientation-preserving).
 *
 * ## What "orthonormal frame at p" means here
 *
 * If `g(p) = L(p) · L(p)ᵀ` (Cholesky), then the columns of `E(p) = L(p)⁻ᵀ`
 * give an orthonormal basis for `T_p M`:
 *
 *   `(E_a, E_b)_g = δ_{ab}`
 *
 * A vector `v ∈ T_p M` has coordinate-basis components `V^i` and
 * orthonormal-frame components `v̂^a`, related by `V = E · v̂`. The
 * orthonormal-frame transport operator is then
 *
 *   `R(t) = L(t)ᵀ · P(t) · L(0)⁻ᵀ`
 *
 * where `P(t)` is the coordinate-basis transport operator solving
 *
 *   `dP^k_l/dt + Γ^k_{ij}(γ(t)) γ̇^i(t) P^j_l(t) = 0`,   `P(0) = I`.
 *
 * ## Use cases
 *
 * - **Holonomy as a group element.** For a closed loop, `R(tMax)` is the
 *   holonomy of the Levi-Civita connection. On a 2-surface that's an
 *   `SO(2)` element — a single angle. On an n-manifold it's `SO(n)`.
 * - **Composable transport.** Transport concatenated along two curves
 *   composes via matrix multiplication on the operators.
 * - **Frame transport.** Apply `R(t)` to multiple vectors without
 *   re-integrating.
 */

import type { DerivFn, Stepper } from '@/math/ode';
import { rk4 } from '@/math/ode';
import type { Manifold } from './types';
import { christoffelFromMetric } from './christoffel';
import { Matrix } from '@/math/linear-algebra';

export interface ParallelTransportOperatorOptions {
  patch: Manifold;

  /** `γ(t) ∈ patch`, length-`dim` point. */
  curve: (t: number) => number[];

  /** `γ̇(t)`, length-`dim`. Central finite differences used if omitted. */
  tangent?: (t: number) => number[];

  tMin: number;
  tMax: number;

  /** Number of integration steps; returns `steps + 1` samples. */
  steps: number;

  /** ODE stepper (default: `rk4`). */
  stepper?: Stepper;

  /** Finite-difference step for `tangent` fallback (default 1e-4). */
  tangentStep?: number;
}

export interface ParallelTransportOperatorResult {
  /** Sample times, length `steps + 1`. */
  times: number[];

  /** Curve samples `γ(t_i)`, each length `dim`. */
  points: number[][];

  /**
   * Operator `R(t_i)` in orthonormal frames, `dim × dim` matrix.
   * `operators[0]` is the identity.
   */
  operators: Matrix[];

  /**
   * Cholesky factor `L(t_i)` of the metric at each sample (with
   * `g = L · Lᵀ`). Exposed so callers can push a vector back from the
   * orthonormal frame into the coordinate basis — `V = L⁻ᵀ · v̂` — without
   * re-running Cholesky.
   */
  choleskys: Matrix[];
}

/**
 * Integrate the parallel-transport operator along `γ`.
 */
export function parallelTransportOperator(
  options: ParallelTransportOperatorOptions,
): ParallelTransportOperatorResult {
  const {
    patch,
    curve,
    tangent: tangentFn,
    tMin,
    tMax,
    steps,
    stepper = rk4,
    tangentStep = 1e-4,
  } = options;

  const n = patch.dim;
  const dt = (tMax - tMin) / steps;

  const tangent: (t: number) => number[] = tangentFn ?? ((t) => {
    const cP = curve(t + tangentStep);
    const cM = curve(t - tangentStep);
    const out = new Array(n);
    const inv = 1 / (2 * tangentStep);
    for (let i = 0; i < n; i++) out[i] = (cP[i] - cM[i]) * inv;
    return out;
  });

  const chr = (p: number[]): Float64Array => {
    if (patch.computeChristoffel) return patch.computeChristoffel(p);
    return christoffelFromMetric((q) => patch.computeMetric(q), p);
  };

  // State layout: flattened n×n matrix, row-major. `state[k*n + l] = P^k_l`.
  //   dP^k_l/dt = -Γ^k_{ij} γ̇^i P^j_l
  const deriv: DerivFn = (P, t) => {
    const p = curve(t);
    const v = tangent(t);
    const G = chr(p);
    const out = new Array(n * n);
    for (let k = 0; k < n; k++) {
      for (let l = 0; l < n; l++) {
        let s = 0;
        const kOff = k * n * n;
        for (let i = 0; i < n; i++) {
          const kiOff = kOff + i * n;
          const vi = v[i];
          for (let j = 0; j < n; j++) {
            s += G[kiOff + j] * vi * P[j * n + l];
          }
        }
        out[k * n + l] = -s;
      }
    }
    return out;
  };

  // P(0) = I, flat.
  const P0: number[] = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) P0[i * n + i] = 1;

  // Precompute L(0)⁻ᵀ — reused every step.
  const g0 = patch.computeMetric(curve(tMin));
  const L0 = g0.cholesky();
  const L0invT = L0.invert().transpose();

  const times = new Array<number>(steps + 1);
  const points = new Array<number[]>(steps + 1);
  const operators = new Array<Matrix>(steps + 1);
  const choleskys = new Array<Matrix>(steps + 1);

  times[0] = tMin;
  points[0] = curve(tMin);
  const I = new Matrix(n, n);
  for (let i = 0; i < n; i++) I.data[i * n + i] = 1;
  operators[0] = I;
  choleskys[0] = L0;

  let P = P0;
  let t = tMin;
  for (let i = 0; i < steps; i++) {
    P = stepper(deriv, P, t, dt);
    t += dt;

    const p = curve(t);
    times[i + 1] = t;
    points[i + 1] = p;

    const gT = patch.computeMetric(p);
    const Lt = gT.cholesky();
    const Pmat = new Matrix(n, n, Float64Array.from(P));
    operators[i + 1] = Lt.transpose().multiply(Pmat).multiply(L0invT);
    choleskys[i + 1] = Lt;
  }

  return { times, points, operators, choleskys };
}
