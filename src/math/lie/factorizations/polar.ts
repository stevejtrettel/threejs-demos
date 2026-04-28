/**
 * Polar decomposition of an invertible real square matrix.
 *
 *   A = Q · P
 *
 * where Q is orthogonal (`QᵀQ = I`) and P is symmetric positive-definite.
 * Equivalent to the polar form of the SVD: if `A = U Σ Vᵀ` then
 * `Q = U Vᵀ` and `P = V Σ Vᵀ`.
 *
 * Visual interpretation: any invertible linear map factors as "rotate
 * without stretching" composed with "stretch along orthogonal axes" —
 * exactly the kind of decomposition the KAK / Cartan framework
 * generalizes to other Lie groups.
 *
 * Algorithm: eigendecompose `AᵀA = V D Vᵀ` (symmetric PSD), then
 *   P = V · √D · Vᵀ,   Q = A · V · (1/√D) · Vᵀ.
 *
 * Uses `Matrix.eigensym` (cyclic Jacobi) and is plenty accurate at
 * `n ≤ 8` or so — the regime of Lie-group matrix reps.
 */

import { Matrix } from '@/math/linear-algebra';

export interface PolarResult {
  /** Orthogonal factor (`QᵀQ = I`). */
  Q: Matrix;
  /** Symmetric positive-definite factor. */
  P: Matrix;
}

export function polar(A: Matrix): PolarResult {
  if (A.rows !== A.cols) {
    throw new Error(`polar: expected square matrix, got ${A.rows}×${A.cols}`);
  }
  const n = A.rows;

  const AtA = A.transpose().multiply(A);
  const { values, vectors: V } = AtA.eigensym();

  const sqrtD = new Matrix(n, n);
  const invSqrtD = new Matrix(n, n);
  for (let i = 0; i < n; i++) {
    if (values[i] <= 0) {
      throw new Error('polar: A is singular (non-positive eigenvalue of AᵀA)');
    }
    const s = Math.sqrt(values[i]);
    sqrtD.data[i * n + i] = s;
    invSqrtD.data[i * n + i] = 1 / s;
  }
  const Vt = V.transpose();
  const P = V.multiply(sqrtD).multiply(Vt);
  const Pinv = V.multiply(invSqrtD).multiply(Vt);
  const Q = A.multiply(Pinv);

  return { Q, P };
}
