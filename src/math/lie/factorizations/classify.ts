/**
 * Element classification for `SL(2, ℝ)` (and similar low-dim non-compact
 * groups). Conjugacy class is determined by `tr(g)`:
 *
 *   |tr(g)| < 2:   **elliptic**     — fixed point inside ℍ², orbits are circles
 *   |tr(g)| = 2:   **parabolic**    — single fixed point on ∂ℍ²
 *   |tr(g)| > 2:   **hyperbolic**   — two fixed points on ∂ℍ², geodesic flow
 *
 * (For `g ≠ ±I` only — the identities `±I` are degenerate edge cases.)
 *
 * The classification has a precise meaning for `SL(2, ℝ)` *as Möbius
 * transformations*: it determines the dynamics of the action on the
 * upper half plane and on the boundary `∂ℍ² ≅ ℝℙ¹`.
 */

import type { Matrix, ComplexMatrix } from '@/math/linear-algebra';
import type { Complex } from '@/math/algebra';

export type SL2RClass = 'elliptic' | 'parabolic' | 'hyperbolic';

const TRACE_TOLERANCE = 1e-9;

export function classifySL2R(g: Matrix): SL2RClass {
  const T = Math.abs(g.data[0] + g.data[3]);
  if (T < 2 - TRACE_TOLERANCE) return 'elliptic';
  if (T > 2 + TRACE_TOLERANCE) return 'hyperbolic';
  return 'parabolic';
}

/**
 * `SL(2, ℂ)` Möbius classification. Same as `SL(2, ℝ)` plus a fourth
 * "loxodromic" type when the trace is genuinely complex (non-real).
 *
 *   trace real, |tr| < 2:    elliptic    (rotation-like, fp inside disk model)
 *   trace real, |tr| = 2:    parabolic   (one boundary fp, accumulation)
 *   trace real, |tr| > 2:    hyperbolic  (two boundary fps, geodesic flow)
 *   trace complex (Im ≠ 0):  loxodromic  (combines hyperbolic + rotation,
 *                                          spiral on the Riemann sphere)
 */
export type SL2CClass = SL2RClass | 'loxodromic';

export function classifySL2C(g: ComplexMatrix): SL2CClass {
  // tr(g) = α + δ
  const a = g.get(0, 0);
  const d = g.get(1, 1);
  const tr: Complex = [a[0] + d[0], a[1] + d[1]];
  if (Math.abs(tr[1]) > TRACE_TOLERANCE) return 'loxodromic';
  const T = Math.abs(tr[0]);
  if (T < 2 - TRACE_TOLERANCE) return 'elliptic';
  if (T > 2 + TRACE_TOLERANCE) return 'hyperbolic';
  return 'parabolic';
}
