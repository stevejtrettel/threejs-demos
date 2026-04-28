/**
 * Generic matrix exponential via Padé approximation + scaling-and-squaring.
 *
 * Algorithm (Higham, *Functions of Matrices*, §10.3):
 *
 *   1. Scale: pick smallest `s ≥ 0` with `‖A/2^s‖_1 ≤ θ`, set `B = A/2^s`.
 *   2. Approximate `exp(B)` by the (p, p) Padé rational `N(B) · D(B)^{-1}`.
 *   3. Square: `exp(A) = exp(B)^{2^s}`, via `s` repeated squarings.
 *
 * We use order `p = 3` with scaling threshold `θ = 0.125`. Padé-3 truncation
 * error at `‖B‖ ≤ θ` is `O(θ⁷)` ≈ 1e-8; after s squarings the amplification
 * is `~2^s`, so the final relative error stays well below 1e-7 for any
 * matrix of interest. Good enough for demos; ergonomic implementation.
 *
 * Use as a fallback in `MatrixLieGroup.exp` — a concrete group overrides
 * `exp` with a closed form (Rodrigues for SO(3), quaternion for SU(2),
 * etc.) and falls back here when none is available.
 */

import { Matrix } from '@/math/linear-algebra';

const THRESHOLD = 0.125;

function norm1(A: Matrix): number {
  let max = 0;
  const n = A.rows, m = A.cols;
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(A.data[i * m + j]);
    if (s > max) max = s;
  }
  return max;
}

/**
 * Matrix exponential `exp(A)` for a square `Matrix` via Padé-3 plus
 * scaling-and-squaring.
 */
export function padeExp(A: Matrix): Matrix {
  const n = A.rows;
  if (A.cols !== n) {
    throw new Error(`padeExp: expected square matrix, got ${A.rows}×${A.cols}`);
  }

  // 1. Scale.
  const normA = norm1(A);
  let s = 0;
  if (normA > THRESHOLD) s = Math.ceil(Math.log2(normA / THRESHOLD));
  const scale = Math.pow(2, s);
  const B = A.scale(1 / scale);

  // 2. Padé-3 approximation.
  //      N(B) = I + B/2 + B²/10  + B³/120
  //      D(B) = I − B/2 + B²/10  − B³/120
  //    exp(B) ≈ D(B)^{-1} · N(B)
  const I = Matrix.identity(n);
  const B2 = B.multiply(B);
  const B3 = B2.multiply(B);

  const N = I
    .add(B.scale(0.5))
    .add(B2.scale(1 / 10))
    .add(B3.scale(1 / 120));
  const D = I
    .add(B.scale(-0.5))
    .add(B2.scale(1 / 10))
    .add(B3.scale(-1 / 120));

  let R = D.invert().multiply(N);

  // 3. Squaring: undo the scaling.
  for (let i = 0; i < s; i++) R = R.multiply(R);

  return R;
}
