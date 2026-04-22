/**
 * n-D Christoffel symbols from a metric via finite differences.
 *
 *   Γ^k_ij = ½ g^{kl} ( ∂_i g_lj + ∂_j g_li − ∂_l g_ij )
 *
 * Returns a flat `Float64Array` of length `n³` laid out as
 * `Γ[k*n*n + i*n + j]`. Accurate to O(h²) in the step size.
 *
 * Single-allocation contract: one `Float64Array` per call, no intermediate
 * nested-array snapshots on the hot path. For formulas that want index
 * notation, read from the flat storage directly: `chr[k*n*n + i*n + j]`.
 */

import { Matrix } from '@/math/linear-algebra';

/** Default finite-difference step in parameter space. */
const DEFAULT_H = 1e-4;

type MetricFn = (p: number[]) => Matrix;

/**
 * Flat index for rank-3 tensor storage.
 *
 * `Γ[k][i][j]` is at `chr[chrIndex(k, i, j, n)]`.
 */
export function chrIndex(k: number, i: number, j: number, n: number): number {
  return k * n * n + i * n + j;
}

/**
 * Compute all `n³` Christoffel symbols at point `p`.
 *
 * Internal allocations (hot path, per call):
 *   - 1 metric `Matrix` (from caller's `metric` fn) × (2n + 1) for p and its
 *     perturbations — unavoidable without out-param API.
 *   - 1 inverse `Matrix` (2×2 fast-path or LU) + its Float64Array.
 *   - 1 rank-3 partials `Float64Array(n³)`.
 *   - 1 output `Float64Array(n³)`.
 *
 * Output layout: `Γ[k*n*n + i*n + j]` — symmetric in `(i, j)`.
 */
export function christoffelFromMetric(
  metric: MetricFn,
  p: number[],
  h: number = DEFAULT_H,
): Float64Array {
  const n = p.length;
  const n2 = n * n;
  const n3 = n2 * n;

  // Metric at p and its inverse. Raw Float64Array for fast repeated index
  // access inside the contraction below.
  const gInv = metric(p).invert().data;

  // Partials ∂_l g_ij as a flat Float64Array: dg[l*n*n + i*n + j].
  const dg = new Float64Array(n3);
  const pPlus = p.slice();
  const pMinus = p.slice();
  const inv2h = 1 / (2 * h);

  for (let l = 0; l < n; l++) {
    pPlus[l] = p[l] + h;
    pMinus[l] = p[l] - h;
    const gPlus = metric(pPlus).data;
    const gMinus = metric(pMinus).data;
    pPlus[l] = p[l];
    pMinus[l] = p[l];

    const lOff = l * n2;
    for (let i = 0; i < n; i++) {
      const rowOff = i * n;
      for (let j = 0; j < n; j++) {
        dg[lOff + rowOff + j] = (gPlus[rowOff + j] - gMinus[rowOff + j]) * inv2h;
      }
    }
  }

  // Γ^k_ij = ½ Σ_l g^{kl} ( ∂_i g_lj + ∂_j g_li − ∂_l g_ij )
  const G = new Float64Array(n3);
  for (let k = 0; k < n; k++) {
    const kRow = k * n;               // row of gInv^{k·}
    const kOut = k * n2;
    for (let i = 0; i < n; i++) {
      const iOff = i * n2;
      for (let j = 0; j < n; j++) {
        const jOff = j * n2;
        let sum = 0;
        for (let l = 0; l < n; l++) {
          const di_lj = dg[iOff + l * n + j];
          const dj_li = dg[jOff + l * n + i];
          const dl_ij = dg[l * n2 + i * n + j];
          sum += gInv[kRow + l] * (di_lj + dj_li - dl_ij);
        }
        G[kOut + i * n + j] = 0.5 * sum;
      }
    }
  }

  return G;
}
