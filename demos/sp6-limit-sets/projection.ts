/**
 * Projection types and fitters.
 *
 * A projection is a pair (R, d) where R is 3×6, d is a 6-vector, and
 *   π(v) = (R · v) / (d · v)   ∈ R³.
 * The chart-singular hyperplane is {v : |d · v| < EPS_V0}; points in it
 * are filtered out before rendering.
 *
 * Three flavors:
 *   - chart projection         : d = e_k (axis-aligned), R picks 3 of the
 *                                other 5 axes.
 *   - chart-PCA projection     : d = e_k, R = top-3 eigenvectors of the
 *                                centered affine covariance.
 *   - auto-chart (projective PCA): d = top eigenvector of (1/n) Σ v v^T on S⁵,
 *                                R = next three eigenvectors of the same
 *                                decomposition.
 */

import type { Orbit } from './orbit';

export const EPS_V0 = 1e-3;

export type Vec6 = [number, number, number, number, number, number];

export interface Projection {
  denom: Vec6;
  rows: [Vec6, Vec6, Vec6];
  label: string;        // for filenames / logs
  pretty: string;       // for the status line
  denomIdx: number;     // 0..5 for axis-aligned charts, -1 for auto-chart
  isPca: boolean;
  isAutoChart: boolean;
}

// ─── Chart-mode helpers ─────────────────────────────────────────────────────

export function makeChartProjection(
  denomIdx: number,
  projIdxs: [number, number, number],
): Projection {
  const denom: Vec6 = [0, 0, 0, 0, 0, 0];
  denom[denomIdx] = 1;
  const rows = projIdxs.map((j) => {
    const r: Vec6 = [0, 0, 0, 0, 0, 0];
    r[j] = 1;
    return r;
  }) as [Vec6, Vec6, Vec6];
  const k1 = denomIdx + 1;
  const a1 = projIdxs.map((j) => j + 1);
  return {
    denom,
    rows,
    label: `v${k1}-${a1.join('')}`,
    pretty: `(v${a1[0]}, v${a1[1]}, v${a1[2]}) / v${k1}`,
    denomIdx,
    isPca: false,
    isAutoChart: false,
  };
}

export function enumerateSubsets(denomIdx: number): {
  idxs: [number, number, number];
  label: string;
}[] {
  const nonDenom: number[] = [];
  for (let i = 0; i < 6; i++) if (i !== denomIdx) nonDenom.push(i);
  const out: { idxs: [number, number, number]; label: string }[] = [];
  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 5; b++) {
      for (let c = b + 1; c < 5; c++) {
        const idxs: [number, number, number] = [nonDenom[a], nonDenom[b], nonDenom[c]];
        out.push({
          idxs,
          label: `(v${idxs[0] + 1}, v${idxs[1] + 1}, v${idxs[2] + 1})`,
        });
      }
    }
  }
  return out;
}

// ─── Symmetric eigendecomposition (Jacobi, n×n) ─────────────────────────────

function jacobiSymmetricEig(
  M: number[][],
  n: number,
): { vals: number[]; vecs: number[][] } {
  const A = M.map((r) => r.slice());
  const V: number[][] = [];
  for (let j = 0; j < n; j++) {
    V.push(Array(n).fill(0));
    V[j][j] = 1;
  }

  for (let iter = 0; iter < 100; iter++) {
    let p = 0, q = 1, maxOff = Math.abs(A[0][1]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxOff) {
          maxOff = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-14) break;

    const tau = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = tau >= 0
      ? 1 / (tau + Math.sqrt(tau * tau + 1))
      : 1 / (tau - Math.sqrt(tau * tau + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    const Apq = A[p][q];
    A[p][p] -= t * Apq;
    A[q][q] += t * Apq;
    A[p][q] = 0;
    A[q][p] = 0;
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Aip = A[i][p];
        const Aiq = A[i][q];
        A[i][p] = c * Aip - s * Aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * Aip + c * Aiq;
        A[q][i] = A[i][q];
      }
    }
    for (let j = 0; j < n; j++) {
      const Vjp = V[j][p];
      const Vjq = V[j][q];
      V[j][p] = c * Vjp - s * Vjq;
      V[j][q] = s * Vjp + c * Vjq;
    }
  }

  const vals = new Array<number>(n);
  for (let i = 0; i < n; i++) vals[i] = A[i][i];
  const vecs: number[][] = [];
  for (let i = 0; i < n; i++) {
    const v = new Array<number>(n);
    for (let j = 0; j < n; j++) v[j] = V[j][i];
    vecs.push(v);
  }
  return { vals, vecs };
}

// ─── PCA inside an affine chart (used by chart-PCA) ─────────────────────────
//
// u(v) = v / (denom · v),  a 6-vector on {y : denom · y = 1}.
// Centered 6×6 covariance is rank ≤ 5 with null direction = denom.
// Projection rows: row_i = e_i − (e_i · mean) denom.

function fitPCAInChart(
  orbit: Orbit,
  denom: Vec6,
): { rows: [Vec6, Vec6, Vec6]; topEigs: number[]; kept: number } | null {
  const { vecs, count } = orbit;

  const mean: Vec6 = [0, 0, 0, 0, 0, 0];
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    let dv = 0;
    for (let j = 0; j < 6; j++) dv += denom[j] * vecs[off + j];
    if (Math.abs(dv) < EPS_V0) continue;
    kept++;
    for (let j = 0; j < 6; j++) mean[j] += vecs[off + j] / dv;
  }
  if (kept === 0) return null;
  for (let j = 0; j < 6; j++) mean[j] /= kept;

  const cov: number[][] = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
  const u = new Array<number>(6);
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    let dv = 0;
    for (let j = 0; j < 6; j++) dv += denom[j] * vecs[off + j];
    if (Math.abs(dv) < EPS_V0) continue;
    for (let j = 0; j < 6; j++) u[j] = vecs[off + j] / dv - mean[j];
    for (let a = 0; a < 6; a++) {
      for (let b = a; b < 6; b++) cov[a][b] += u[a] * u[b];
    }
  }
  for (let a = 0; a < 6; a++) {
    for (let b = a; b < 6; b++) {
      cov[a][b] /= kept;
      if (a !== b) cov[b][a] = cov[a][b];
    }
  }

  const { vals, vecs: eigvecs } = jacobiSymmetricEig(cov, 6);
  const order = vals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .map((x) => x.i);

  const rows: Vec6[] = [];
  for (let r = 0; r < 3; r++) {
    const e = eigvecs[order[r]];
    let eDotMean = 0;
    for (let j = 0; j < 6; j++) eDotMean += e[j] * mean[j];
    const row: Vec6 = [0, 0, 0, 0, 0, 0];
    for (let j = 0; j < 6; j++) row[j] = e[j] - eDotMean * denom[j];
    rows.push(row);
  }

  return {
    rows: rows as [Vec6, Vec6, Vec6],
    topEigs: order.slice(0, 3).map((i) => vals[i]),
    kept,
  };
}

export function fitPCAProjection(orbit: Orbit, denomIdx: number): Projection {
  const denom: Vec6 = [0, 0, 0, 0, 0, 0];
  denom[denomIdx] = 1;
  const pca = fitPCAInChart(orbit, denom);
  if (!pca) {
    const fallback: number[] = [];
    for (let i = 0; i < 6; i++) if (i !== denomIdx) fallback.push(i);
    return makeChartProjection(
      denomIdx,
      [fallback[0], fallback[1], fallback[2]] as [number, number, number],
    );
  }
  const k1 = denomIdx + 1;
  return {
    denom,
    rows: pca.rows,
    label: `v${k1}-pca`,
    pretty: `PCA on v${k1} chart`,
    denomIdx,
    isPca: true,
    isAutoChart: false,
  };
}

// ─── Auto-chart (projective PCA, single eigendecomposition) ─────────────────
//
// Top eigenvector of M = (1/n) Σ v v^T on S⁵ becomes the chart denominator;
// the next three become the projection rows. Since the eigenvectors of M are
// mutually orthogonal, v_2..v_4 already form an orthonormal 3-frame inside
// v_1⊥ — no centering offset is needed in the rows.

export function fitAutoChartProjection(orbit: Orbit): Projection {
  const { vecs, count } = orbit;

  const M: number[][] = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    for (let a = 0; a < 6; a++) {
      for (let b = a; b < 6; b++) M[a][b] += vecs[off + a] * vecs[off + b];
    }
  }
  for (let a = 0; a < 6; a++) {
    for (let b = a; b < 6; b++) {
      M[a][b] /= count;
      if (a !== b) M[b][a] = M[a][b];
    }
  }

  const { vals, vecs: eigvecs } = jacobiSymmetricEig(M, 6);
  const order = vals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);

  const v1 = eigvecs[order[0]].slice() as Vec6;
  const v2 = eigvecs[order[1]].slice() as Vec6;
  const v3 = eigvecs[order[2]].slice() as Vec6;
  const v4 = eigvecs[order[3]].slice() as Vec6;

  let centroidDotV1 = 0;
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    for (let j = 0; j < 6; j++) centroidDotV1 += v1[j] * vecs[off + j];
  }
  if (centroidDotV1 < 0) for (let j = 0; j < 6; j++) v1[j] = -v1[j];

  return {
    denom: v1,
    rows: [v2, v3, v4],
    label: 'autochart',
    pretty: 'auto-chart (projective PCA)',
    denomIdx: -1,
    isPca: true,
    isAutoChart: true,
  };
}

// ─── Instance attribute packing ─────────────────────────────────────────────

/**
 * Family colors, indexed by generator (0 = A, 1 = A⁻¹, 2 = B, 3 = B⁻¹).
 * Two warm shades for A, a; two cool shades for B, b.
 */
const FAMILY: readonly (readonly [number, number, number])[] = [
  [0.65, 0.20, 0.15], // A   — warm red
  [0.70, 0.40, 0.10], // A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // B   — cool blue
  [0.10, 0.40, 0.55], // B⁻¹ — cool teal
];

const GRAY: readonly [number, number, number] = [0.35, 0.35, 0.35];
const BASEPOINT: readonly [number, number, number] = [0.95, 0.95, 0.95];

/**
 * Color for orbit node `idx` at the given color depth.
 *
 * colorDepth = 0: grayscale.
 *
 * colorDepth = k ≥ 1: 4-color family palette, keyed off the letter at
 * position (k − 1) back from the end of the word. So:
 *   k = 1 → color by g_n (last letter; outermost contraction).
 *   k = 2 → color by g_{n−1} (second-to-last; contraction applied just
 *           inside the outermost). Within each k=1 blob you should see
 *           the same 4-color pattern repeated at smaller scale — a direct
 *           visual signature of self-similarity.
 *   k = 3 → color by g_{n−2}. Etc.
 *
 * If the word has fewer than k letters (i.e. we hit the basepoint while
 * walking back), the point is colored as the basepoint.
 */
function colorAt(
  orbit: Orbit,
  idx: number,
  colorDepth: number,
): readonly [number, number, number] {
  if (colorDepth === 0) return GRAY;

  // Walk back colorDepth − 1 steps to the ancestor whose lastGen is the
  // letter at position (colorDepth − 1) back from the end.
  let cur = idx;
  for (let k = 1; k < colorDepth; k++) {
    if (orbit.lastGen[cur] === 255) return BASEPOINT;
    cur = orbit.parents[cur];
  }
  const lg = orbit.lastGen[cur];
  if (lg === 255) return BASEPOINT;
  return FAMILY[lg];
}

export function buildInstanceArrays(
  orbit: Orbit,
  denom: Vec6,
  colorDepth: number,
) {
  const { vecs, count } = orbit;
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    let d = 0;
    for (let j = 0; j < 6; j++) d += denom[j] * vecs[off + j];
    if (Math.abs(d) >= EPS_V0) kept++;
  }

  const aV0 = new Float32Array(kept * 3);
  const aV1 = new Float32Array(kept * 3);
  const aColor = new Float32Array(kept * 3);

  let w = 0;
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    let d = 0;
    for (let j = 0; j < 6; j++) d += denom[j] * vecs[off + j];
    if (Math.abs(d) < EPS_V0) continue;
    aV0[w * 3]     = vecs[off];
    aV0[w * 3 + 1] = vecs[off + 1];
    aV0[w * 3 + 2] = vecs[off + 2];
    aV1[w * 3]     = vecs[off + 3];
    aV1[w * 3 + 1] = vecs[off + 4];
    aV1[w * 3 + 2] = vecs[off + 5];
    const col = colorAt(orbit, i, colorDepth);
    aColor[w * 3]     = col[0];
    aColor[w * 3 + 1] = col[1];
    aColor[w * 3 + 2] = col[2];
    w++;
  }

  return { aV0, aV1, aColor, kept };
}
