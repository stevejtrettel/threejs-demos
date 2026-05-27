import type { CP2Point } from './point';

/**
 * Moment map μ: CP^2 → Δ² (standard 2-simplex).
 *
 *   μ([X:Y:Z]) = (w₀|X|², w₁|Y|², w₂|Z|²) / Σ_k w_k|·|²
 *
 * With default weights [1,1,1] this is the standard Fubini–Study moment map
 * for CP². Passing [1, 3, 1] gives the moment map for the weighted projective
 * space P(1, 3, 1), where Y has weight 3 — natural home for genus-2
 * hyperelliptic curves y² = (deg-6 in x).
 */
export function momentMap(
  p: CP2Point,
  weights: [number, number, number] = [1, 1, 1],
): [number, number, number] {
  const u = (p[0].re * p[0].re + p[0].im * p[0].im) * weights[0];
  const v = (p[1].re * p[1].re + p[1].im * p[1].im) * weights[1];
  const w = (p[2].re * p[2].re + p[2].im * p[2].im) * weights[2];
  const s = u + v + w;
  return s > 0 ? [u / s, v / s, w / s] : [0, 0, 0];
}

/**
 * Barycentric (u, v, w) with u + v + w = 1 → 2D Cartesian.
 * Vertex assignment: X-vertex at (0,0), Y-vertex at (1,0), Z-vertex at (0.5, √3/2).
 */
export function triangleTo2D([u, v, w]: [number, number, number]): [number, number] {
  // u contributes (0,0), v contributes (1,0), w contributes (0.5, √3/2).
  void u;
  const x = v + 0.5 * w;
  const y = (Math.sqrt(3) / 2) * w;
  return [x, y];
}

export const TRIANGLE_VERTICES: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0.5, Math.sqrt(3) / 2],
];
