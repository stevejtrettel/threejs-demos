/**
 * n-D geodesic flow as a first-order ODE.
 *
 * The geodesic equation on a manifold with Christoffel symbols Γ^k_ij is the
 * second-order system
 *
 *   ẍ^k = −Γ^k_ij ẋ^i ẋ^j.
 *
 * Written in first-order form on the tangent bundle, with phase state
 * `s = [x⁰…x^{n−1}, v⁰…v^{n−1}]` (position half followed by velocity half):
 *
 *   ẋ^k = v^k,
 *   v̇^k = −Γ^k_ij v^i v^j.
 *
 * This is the n-D, signature-agnostic generalization of the 2D
 * `GeodesicIntegrator`. It works for any `Manifold` — Riemannian or
 * pseudo-Riemannian (Lorentzian) — because the geodesic equation only sees
 * the Christoffel symbols, which `christoffelFromMetric` produces from any
 * non-degenerate metric. Plug the returned `DerivFn` straight into the ODE
 * layer (`rk4`, `integrate`).
 *
 * Null/timelike/spacelike character is set entirely by the initial velocity:
 * geodesic flow preserves the metric norm g(v, v) exactly (to integrator
 * order), so a null start stays null, a timelike start stays timelike. This
 * is what lets light cones and massive-particle worldlines share one code
 * path — see `math/relativity`.
 *
 * 2D sugar: the existing `GeodesicIntegrator` remains the ergonomic choice for
 * 2D surfaces with the `{position, velocity}` tangent-vector shape. This
 * module is the flat-`number[]` n-D form the relativity layer builds on.
 */

import type { Manifold } from '@/math/manifolds';
import { christoffelFromMetric } from '@/math/manifolds';
import type { DerivFn } from '@/math/ode';

/**
 * Build the geodesic `DerivFn` for a manifold.
 *
 * Returns `(s, t) → ds/dt` over phase state `s = [x…, v…]` of length `2·dim`.
 * Uses the manifold's analytic `computeChristoffel` when present, otherwise
 * falls back to numerical `christoffelFromMetric` with step `h`.
 *
 * @example
 *   const deriv = geodesicDeriv(spacetime);
 *   const traj = integrate({ deriv, initial: [...x0, ...v0], dt: 0.01, steps: 2000 });
 */
export function geodesicDeriv(manifold: Manifold, h?: number): DerivFn {
  const n = manifold.dim;
  const x = new Array(n);

  return (s: number[]): number[] => {
    for (let k = 0; k < n; k++) x[k] = s[k];

    const chr = manifold.computeChristoffel?.(x)
      ?? christoffelFromMetric((p) => manifold.computeMetric(p), x, h);

    const out = new Array(2 * n);
    for (let k = 0; k < n; k++) {
      out[k] = s[n + k]; // ẋ^k = v^k

      // v̇^k = −Γ^k_ij v^i v^j, reading Γ from flat layout Γ[k*n*n + i*n + j].
      const kBase = k * n * n;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const vi = s[n + i];
        const iOff = kBase + i * n;
        for (let j = 0; j < n; j++) {
          acc += chr[iOff + j] * vi * s[n + j];
        }
      }
      out[n + k] = -acc;
    }
    return out;
  };
}

/**
 * Metric norm g_ij(x) v^i v^j of the velocity half of a phase state.
 *
 * The conserved quantity of geodesic flow. Use it to (a) classify a geodesic
 * — negative ⇒ timelike, zero ⇒ null, positive ⇒ spacelike under the
 * mostly-plus convention this library uses for Lorentzian metrics — and
 * (b) validate an integration run: the norm should hold constant.
 */
export function geodesicNorm(manifold: Manifold, state: number[]): number {
  const n = manifold.dim;
  const x = state.slice(0, n);
  const g = manifold.computeMetric(x).data;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const vi = state[n + i];
    for (let j = 0; j < n; j++) {
      sum += g[i * n + j] * vi * state[n + j];
    }
  }
  return sum;
}
