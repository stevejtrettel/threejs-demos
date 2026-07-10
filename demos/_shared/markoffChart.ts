// The symmetric chart on the Markoff cubic: orthogonal projection along the
// (1,1,1) axis.
//
// The cubic x² + y² + z² = xyz is invariant under permuting (x, y, z), and the
// (1,1,1) direction is the axis of that symmetry. Projecting the Teichmüller
// sheet orthogonally to (1,1,1) centers the modular torus (3,3,3) at the origin
// and turns the S₃ trace symmetry into a 3-fold (hexagonal) symmetry of the
// plane — the chart in which the stable-norm-volume level sets look their best.
//
// Orthonormal frame:  n = (1,1,1)/√3 (the axis),  u = (1,−1,0)/√2,
// v = (1,1,−2)/√6 (spanning the plane).  A structure projects to (a, b) =
// (X·u, X·v); inverting requires choosing the height h = X·n on the sheet,
// which is a root of a cubic (below).

import type { TraceTriple } from './markoff';

const S2 = Math.SQRT2;       // √2
const S3 = Math.sqrt(3);     // √3
const S6 = Math.sqrt(6);     // √6
const INV_S3 = 1 / S3;       // height-axis component of each trace

/** Project a trace triple onto the (1,1,1)⊥ plane: (a, b). */
export function project(t: TraceTriple): [number, number] {
  const a = (t.x - t.y) / S2;
  const b = (t.x + t.y - 2 * t.z) / S6;
  return [a, b];
}

/** Height of a structure along the (1,1,1) axis, h = X·n. */
export function height(t: TraceTriple): number {
  return (t.x + t.y + t.z) / S3;
}

/**
 * Real roots of a monic cubic t³ + At² + Bt + C, via the depressed form.
 * Returns one or three reals (ascending).
 */
function cubicRealRoots(A: number, B: number, C: number): number[] {
  // Depress: t = w − A/3  ⇒  w³ + p w + q = 0.
  const p = B - (A * A) / 3;
  const q = (2 * A * A * A) / 27 - (A * B) / 3 + C;
  const shift = -A / 3;

  const disc = -4 * p * p * p - 27 * q * q;
  if (Math.abs(p) < 1e-14 && Math.abs(q) < 1e-14) return [shift];

  if (disc >= 0) {
    // Three real roots — trigonometric solution.
    const m = 2 * Math.sqrt(-p / 3);
    const arg = Math.max(-1, Math.min(1, (3 * q) / (p * m)));
    const phi = Math.acos(arg) / 3;
    const roots = [0, 1, 2].map((k) => m * Math.cos(phi - (2 * Math.PI * k) / 3) + shift);
    return roots.sort((s, t) => s - t);
  }

  // One real root — Cardano.
  const sqrtTerm = Math.sqrt(-disc / 108); // = √(q²/4 + p³/27)
  const half = -q / 2;
  const cbrt = (x: number) => Math.cbrt(x);
  const w = cbrt(half + sqrtTerm) + cbrt(half - sqrtTerm);
  return [w + shift];
}

/**
 * Invert the chart: the structure on the Teichmüller sheet projecting to
 * (a, b), or null if (a, b) lies outside it.
 *
 * On the sheet, the height h solves
 *   h³ − 3√3·h² − (3/2)ρ²·h − 3√3·(ρ² − e₃) = 0,
 * with ρ² = a² + b² and e₃ = b(3a² − b²)/(3√6) (the order-3 harmonic that
 * carries the symmetry). The Teichmüller sheet is the largest real root; the
 * structure is valid while every generator trace stays ≥ 2 (a curve pinches to
 * a cusp at 2 — the boundary of the chart).
 */
export function liftToTriple(a: number, b: number): TraceTriple | null {
  const rho2 = a * a + b * b;
  const e3 = (b * (3 * a * a - b * b)) / (3 * S6);

  const roots = cubicRealRoots(-3 * S3, -1.5 * rho2, -3 * S3 * (rho2 - e3));
  const h = roots[roots.length - 1]!; // Teichmüller sheet = largest height

  // Reconstruct (x, y, z) = h·n + (planar part), in the standard basis.
  const px = a / S2 + b / S6;
  const py = -a / S2 + b / S6;
  const pz = (-2 * b) / S6;
  const x = INV_S3 * h + px;
  const y = INV_S3 * h + py;
  const z = INV_S3 * h + pz;

  if (x < 2 || y < 2 || z < 2 || !Number.isFinite(h)) return null;
  return { x, y, z };
}
