/**
 * Numerical intrinsic-geometry helpers over a `MetricPatch`.
 *
 * These compute quantities derivable from the metric tensor alone:
 * Christoffel symbols and Gaussian curvature. They do NOT need an embedding.
 *
 * Consumers (e.g. `GeodesicIntegrator`) typically fall back to these when a
 * `MetricPatch` does not provide an analytic `computeChristoffel` /
 * `computeGaussianCurvature`.
 */

import type { MetricPatch, ChristoffelSymbols } from './types';

/** Default finite-difference step in parameter space. */
const DEFAULT_H = 1e-4;

/**
 * Christoffel symbols of a 2D metric via central finite differences.
 *
 * Γ^k_ij = (1/2) g^kl (∂_i g_lj + ∂_j g_li − ∂_l g_ij)
 *
 * Accurate to O(h²). Fails silently near poles / singularities of the metric;
 * provide an analytic `computeChristoffel` on the patch in that regime.
 */
export function christoffelFromMetric(
  patch: MetricPatch,
  u: number,
  v: number,
  h: number = DEFAULT_H,
): ChristoffelSymbols {
  const g = patch.computeMetric(u, v);
  const E = g.E, F = g.F, G = g.G;

  const g_u_plus = patch.computeMetric(u + h, v);
  const g_u_minus = patch.computeMetric(u - h, v);
  const g_v_plus = patch.computeMetric(u, v + h);
  const g_v_minus = patch.computeMetric(u, v - h);

  const inv2h = 1 / (2 * h);
  const E_u = (g_u_plus.E - g_u_minus.E) * inv2h;
  const E_v = (g_v_plus.E - g_v_minus.E) * inv2h;
  const F_u = (g_u_plus.F - g_u_minus.F) * inv2h;
  const F_v = (g_v_plus.F - g_v_minus.F) * inv2h;
  const G_u = (g_u_plus.G - g_u_minus.G) * inv2h;
  const G_v = (g_v_plus.G - g_v_minus.G) * inv2h;

  // Inverse metric
  const det = E * G - F * F;
  const gi11 =  G / det;   // g^11
  const gi12 = -F / det;   // g^12 = g^21
  const gi22 =  E / det;   // g^22

  // Γ^k_ij = ½ g^kl (∂_i g_jl + ∂_j g_il − ∂_l g_ij), summed over l ∈ {0, 1}.
  // With E = g_00, F = g_01, G = g_11, ∂_0 = ∂_u, ∂_1 = ∂_v:

  // Γ^1_ij  (upper index = u)
  const gamma_1_11 = 0.5 * (gi11 * E_u        + gi12 * (2 * F_u - E_v));
  const gamma_1_12 = 0.5 * (gi11 * E_v        + gi12 * G_u);
  const gamma_1_22 = 0.5 * (gi11 * (2 * F_v - G_u) + gi12 * G_v);

  // Γ^2_ij  (upper index = v)
  const gamma_2_11 = 0.5 * (gi12 * E_u        + gi22 * (2 * F_u - E_v));
  const gamma_2_12 = 0.5 * (gi12 * E_v        + gi22 * G_u);
  const gamma_2_22 = 0.5 * (gi12 * (2 * F_v - G_u) + gi22 * G_v);

  return {
    gamma_1_11, gamma_1_12, gamma_1_22,
    gamma_2_11, gamma_2_12, gamma_2_22,
  };
}

/**
 * Gaussian curvature of a 2D Riemannian metric — purely intrinsic.
 *
 * Uses the Brioschi formula, expressed as K = (B − A) / (EG − F²)², where A and
 * B are 3×3 determinants built from g and its first and second partials. Only
 * the metric is needed — no embedding, no second fundamental form.
 *
 * Accurate to O(h²). For a `DifferentialSurface` this agrees (up to numerical
 * error) with (LN − M²)/(EG − F²) computed from the second fundamental form.
 */
export function gaussianCurvatureFromMetric(
  patch: MetricPatch,
  u: number,
  v: number,
  h: number = DEFAULT_H,
): number {
  const g = patch.computeMetric(u, v);
  const E = g.E, F = g.F, G = g.G;

  const gpu = patch.computeMetric(u + h, v);
  const gmu = patch.computeMetric(u - h, v);
  const gpv = patch.computeMetric(u, v + h);
  const gmv = patch.computeMetric(u, v - h);

  const inv2h = 1 / (2 * h);
  const invhh = 1 / (h * h);

  const E_u = (gpu.E - gmu.E) * inv2h;
  const E_v = (gpv.E - gmv.E) * inv2h;
  const F_u = (gpu.F - gmu.F) * inv2h;
  const F_v = (gpv.F - gmv.F) * inv2h;
  const G_u = (gpu.G - gmu.G) * inv2h;
  const G_v = (gpv.G - gmv.G) * inv2h;

  const E_vv = (gpv.E - 2 * E + gmv.E) * invhh;
  const G_uu = (gpu.G - 2 * G + gmu.G) * invhh;

  // Mixed partial of F: needs a 4-corner stencil
  const gpp = patch.computeMetric(u + h, v + h);
  const gpm = patch.computeMetric(u + h, v - h);
  const gmp = patch.computeMetric(u - h, v + h);
  const gmm = patch.computeMetric(u - h, v - h);
  const F_uv = (gpp.F - gpm.F - gmp.F + gmm.F) / (4 * h * h);

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
