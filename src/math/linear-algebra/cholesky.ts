/**
 * Cholesky factorization for symmetric positive-definite matrices.
 *
 * Returns a lower-triangular `L` with `A = L·Lᵀ`. ~2× faster than LU for SPD
 * inputs and fails loudly when `A` is not SPD — a useful correctness check
 * for metric tensors (a negative eigenvalue usually means a sign error).
 */

import { Matrix } from './Matrix';

/**
 * Cholesky factorization. Throws if `A` is not symmetric positive-definite.
 *
 * The input is not checked for symmetry — passing a non-symmetric matrix is
 * a programmer error that produces garbage. The positive-definite check is
 * implicit: the algorithm fails when a pivot would be non-positive.
 */
export function choleskyDecompose(A: Matrix): Matrix {
  if (A.rows !== A.cols) {
    throw new Error(`cholesky: expected square matrix, got ${A.rows}×${A.cols}`);
  }
  const n = A.rows;
  const L = new Matrix(n, n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A.get(i, j);
      for (let k = 0; k < j; k++) sum -= L.get(i, k) * L.get(j, k);

      if (i === j) {
        if (sum <= 0) {
          throw new Error(`cholesky: matrix is not positive-definite (pivot ${sum} at row ${i})`);
        }
        L.set(i, i, Math.sqrt(sum));
      } else {
        L.set(i, j, sum / L.get(j, j));
      }
    }
  }

  return L;
}
