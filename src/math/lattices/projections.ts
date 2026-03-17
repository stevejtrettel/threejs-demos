/**
 * Geometric projections of lattices into S³ and R³.
 *
 * Maps a lattice to a point on S³ via its weighted Eisenstein invariants
 * (g₂, g₃), then optionally projects to R³ via stereographic projection.
 */

import { cabs2, cscale } from '../algebra/complex';
import type { Lattice2D } from './Lattice2D';
import { latticeInvariants } from './invariants';

const TOL_STEREO_POLE = 1e-12;

/**
 * Map a lattice to a point on S³ via weighted projection.
 *
 * The Eisenstein invariants (g₂, g₃) live in ℂ² ≅ ℝ⁴ with weights (4, 6)
 * under lattice scaling. The weighted ℂ* action is:
 *   (g₂, g₃) → (t²g₂, t³g₃)  for t ∈ ℝ₊
 *
 * We normalize to the round S³ by finding t > 0 such that
 *   t⁴|g₂|² + t⁶|g₃|² = 1
 *
 * Returns [Re(g₂'), Im(g₂'), Re(g₃'), Im(g₃')] where primes denote
 * the normalized values.
 */
export function toS3(lat: Lattice2D): [number, number, number, number] {
  const { g2: g2val, g3: g3val } = latticeInvariants(lat);

  const a = cabs2(g2val); // |g₂|²
  const b = cabs2(g3val); // |g₃|²

  // Solve t⁴·a + t⁶·b = 1 for t > 0
  // Let u = t², then u²·a + u³·b = 1
  // Newton's method on f(u) = b·u³ + a·u² − 1
  let u = 1 / Math.pow(a + b, 0.25); // initial guess
  for (let i = 0; i < 50; i++) {
    const u2 = u * u;
    const u3 = u2 * u;
    const f = b * u3 + a * u2 - 1;
    const fp = 3 * b * u2 + 2 * a * u;
    if (Math.abs(fp) < 1e-30) break;
    const du = f / fp;
    u -= du;
    if (u < 0) u = 1e-10; // stay positive
    if (Math.abs(du) < 1e-14 * u) break;
  }

  const t = Math.sqrt(u);
  const t2 = u;
  const t3 = u * t;

  // Normalized: g₂' = t²g₂, g₃' = t³g₃
  const g2n = cscale(t2, g2val);
  const g3n = cscale(t3, g3val);

  return [g2n[0], g2n[1], g3n[0], g3n[1]];
}

/**
 * Map a lattice to ℝ³ via stereographic projection of the S³ point.
 *
 * Stereographic projection from the north pole (0,0,0,1):
 *   (x₁, x₂, x₃, x₄) → (x₁, x₂, x₃) / (1 − x₄)
 */
export function toR3(lat: Lattice2D): [number, number, number] {
  const [x1, x2, x3, x4] = toS3(lat);
  const denom = 1 - x4;
  if (Math.abs(denom) < TOL_STEREO_POLE) {
    return [x1 * 1e6, x2 * 1e6, x3 * 1e6];
  }
  return [x1 / denom, x2 / denom, x3 / denom];
}
