/**
 * Parallel transport of a tangent vector along a curve.
 *
 * Given a curve `γ(t)` on a Riemannian manifold, the parallel transport
 * of a tangent vector `V₀ = V(tMin)` along γ is the vector field `V(t)`
 * satisfying `∇_{γ̇} V = 0`:
 *
 *   dV^k/dt  +  Γ^k_{ij}(γ(t))  γ̇^i(t)  V^j(t)  =  0
 *
 * This is a linear ODE in V with time-varying coefficients determined by
 * γ, γ̇, and the manifold's Christoffel symbols. We integrate it with any
 * ODE stepper and sample γ(t), V(t) at equal time steps.
 *
 * The returned `vectors[i]` is V at γ(t_i) in the chart's coordinate
 * basis. For rendering, push forward through the surface embedding —
 * `V^θ · ∂r/∂θ + V^φ · ∂r/∂φ` on a 2-sphere, for example.
 *
 * Closed loops `γ(tMin) = γ(tMax)` exhibit *holonomy*: the transported
 * vector at `tMax` generally differs from `V₀` by a rotation. On a
 * surface of Gauss curvature K, the holonomy equals `∫∫ K dA` over any
 * region bounded by the loop (classical Gauss-Bonnet).
 */

import type { DerivFn, Stepper } from '@/math/ode';
import { rk4 } from '@/math/ode';
import type { Manifold } from './types';
import { christoffelFromMetric } from './christoffel';

export interface ParallelTransportOptions {
  patch: Manifold;

  /** `γ(t) ∈ patch`, returning a length-`dim` point in parameter space. */
  curve: (t: number) => number[];

  /**
   * `γ̇(t)`, length-`dim`. Optional — central finite differences on
   * `curve` provide a fallback if absent.
   */
  tangent?: (t: number) => number[];

  /** `V(tMin)` — length-`dim` tangent vector in the chart's coordinate basis. */
  initialVector: number[];

  tMin: number;
  tMax: number;

  /** Number of integration steps; we return `steps + 1` samples. */
  steps: number;

  /** ODE stepper (default: `rk4`). */
  stepper?: Stepper;

  /** Finite-difference step for `tangent` fallback (default 1e-4). */
  tangentStep?: number;
}

export interface ParallelTransportResult {
  /** `t_i = tMin + i · (tMax − tMin) / steps`, length `steps + 1`. */
  times: number[];
  /** `γ(t_i)`, each length `dim`. */
  points: number[][];
  /** Transported vector `V(t_i)` in the chart's coordinate basis. */
  vectors: number[][];
}

/**
 * Integrate the parallel-transport ODE along γ from `tMin` to `tMax`.
 */
export function parallelTransport(
  options: ParallelTransportOptions,
): ParallelTransportResult {
  const {
    patch,
    curve,
    tangent: tangentFn,
    initialVector,
    tMin,
    tMax,
    steps,
    stepper = rk4,
    tangentStep = 1e-4,
  } = options;

  const n = patch.dim;
  const dt = (tMax - tMin) / steps;

  // Tangent γ̇(t) — analytic if provided, FD otherwise.
  const tangent: (t: number) => number[] = tangentFn ?? ((t) => {
    const cPlus = curve(t + tangentStep);
    const cMinus = curve(t - tangentStep);
    const out = new Array(n);
    const inv = 1 / (2 * tangentStep);
    for (let i = 0; i < n; i++) out[i] = (cPlus[i] - cMinus[i]) * inv;
    return out;
  });

  // Christoffel at a point — analytic override when available.
  const chr = (p: number[]): Float64Array => {
    if (patch.computeChristoffel) return patch.computeChristoffel(p);
    return christoffelFromMetric((q) => patch.computeMetric(q), p);
  };

  // dV^k/dt = −Γ^k_{ij}(γ(t)) γ̇^i V^j
  //   with Γ stored flat: Γ[k*n*n + i*n + j]
  const deriv: DerivFn = (V, t) => {
    const p = curve(t);
    const v = tangent(t);
    const G = chr(p);
    const dV = new Array(n);
    for (let k = 0; k < n; k++) {
      let s = 0;
      const kOff = k * n * n;
      for (let i = 0; i < n; i++) {
        const kiOff = kOff + i * n;
        const vi = v[i];
        for (let j = 0; j < n; j++) {
          s += G[kiOff + j] * vi * V[j];
        }
      }
      dV[k] = -s;
    }
    return dV;
  };

  const times = new Array<number>(steps + 1);
  const points = new Array<number[]>(steps + 1);
  const vectors = new Array<number[]>(steps + 1);

  times[0] = tMin;
  points[0] = curve(tMin);
  vectors[0] = initialVector.slice();

  let V = initialVector.slice();
  let t = tMin;
  for (let i = 0; i < steps; i++) {
    V = stepper(deriv, V, t, dt);
    t += dt;
    times[i + 1] = t;
    points[i + 1] = curve(t);
    vectors[i + 1] = V.slice();
  }

  return { times, points, vectors };
}
