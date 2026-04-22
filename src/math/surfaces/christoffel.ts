/**
 * 2D-only intrinsic curvature helpers for embedded surfaces.
 *
 * The general n-D Christoffel routine lives in `math/manifolds/`. This file
 * hosts the 2D-specific formulas that don't generalize — notably Brioschi
 * for scalar Gaussian curvature.
 */

import type { Manifold } from '@/math/manifolds';

/** Default finite-difference step in parameter space. */
const DEFAULT_H = 1e-4;

/**
 * Gaussian curvature of a 2D Riemannian metric — purely intrinsic.
 *
 * Uses the Brioschi formula, expressed as `K = (detB − detA) / (EG − F²)²`,
 * where A and B are 3×3 determinants built from g and its first and second
 * partials. Only the metric is needed — no embedding, no second fundamental
 * form.
 *
 * Accurate to O(h²). For a `DifferentialSurface` this agrees (up to
 * numerical error) with `(LN − M²)/(EG − F²)` computed from the second
 * fundamental form (Theorema Egregium).
 *
 * Gaussian curvature as a scalar is a 2D concept. The n-D analog is the
 * Riemann curvature tensor, which is a separate future type — hence this
 * helper stays here, not in `math/manifolds/`.
 */
export function gaussianCurvatureFromMetric(
  patch: Manifold,
  u: number,
  v: number,
  h: number = DEFAULT_H,
): number {
  if (patch.dim !== 2) {
    throw new Error(`gaussianCurvatureFromMetric: dim=${patch.dim}, only dim=2 is supported`);
  }

  // Read metrics directly from the Float64Array backing for speed.
  //   Layout: data[0]=E, data[1]=F, data[2]=F, data[3]=G.
  const g = patch.computeMetric([u, v]).data;
  const E = g[0], F = g[1], G = g[3];

  const gpu = patch.computeMetric([u + h, v]).data;
  const gmu = patch.computeMetric([u - h, v]).data;
  const gpv = patch.computeMetric([u, v + h]).data;
  const gmv = patch.computeMetric([u, v - h]).data;

  const inv2h = 1 / (2 * h);
  const invhh = 1 / (h * h);

  const E_u = (gpu[0] - gmu[0]) * inv2h;
  const E_v = (gpv[0] - gmv[0]) * inv2h;
  const F_u = (gpu[1] - gmu[1]) * inv2h;
  const F_v = (gpv[1] - gmv[1]) * inv2h;
  const G_u = (gpu[3] - gmu[3]) * inv2h;
  const G_v = (gpv[3] - gmv[3]) * inv2h;

  const E_vv = (gpv[0] - 2 * E + gmv[0]) * invhh;
  const G_uu = (gpu[3] - 2 * G + gmu[3]) * invhh;

  // Mixed partial of F: 4-corner stencil.
  const gpp = patch.computeMetric([u + h, v + h]).data;
  const gpm = patch.computeMetric([u + h, v - h]).data;
  const gmp = patch.computeMetric([u - h, v + h]).data;
  const gmm = patch.computeMetric([u - h, v - h]).data;
  const F_uv = (gpp[1] - gpm[1] - gmp[1] + gmm[1]) / (4 * h * h);

  // Brioschi: K = (det(B) − det(A)) / (EG − F²)²
  //
  // A = | −½ E_vv + F_uv − ½ G_uu    ½ E_u        F_u − ½ E_v |
  //     |  F_v − ½ G_u                E             F           |
  //     |  ½ G_v                      F             G           |
  //
  // B = | 0             ½ E_v       ½ G_u |
  //     | ½ E_v         E           F     |
  //     | ½ G_u         F           G     |

  const a11 = -0.5 * E_vv + F_uv - 0.5 * G_uu;
  const a12 = 0.5 * E_u;
  const a13 = F_u - 0.5 * E_v;
  const a21 = F_v - 0.5 * G_u;
  const a22 = E;
  const a23 = F;
  const a31 = 0.5 * G_v;
  const a32 = F;
  const a33 = G;
  const detA =
    a11 * (a22 * a33 - a23 * a32) -
    a12 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * a32 - a22 * a31);

  const b12 = 0.5 * E_v;
  const b13 = 0.5 * G_u;
  const b22 = E;
  const b23 = F;
  const b32 = F;
  const b33 = G;
  // b11 = 0
  const detB =
    -b12 * (b12 * b33 - b23 * b13) +
    b13 * (b12 * b32 - b22 * b13);

  const denom = (E * G - F * F);
  return (detA - detB) / (denom * denom);
}
