/**
 * Symmetric eigendecomposition via cyclic Jacobi rotations.
 *
 * For a symmetric matrix `A`, finds an orthogonal `Q` and diagonal `D` with
 * `A = Q·D·Qᵀ`. Eigenvectors are columns of `Q`; eigenvalues are the
 * diagonal of `D`, returned as a plain array.
 *
 * The cyclic Jacobi scheme is simple, unconditionally convergent for
 * symmetric inputs, and produces eigenvectors that are orthonormal to
 * working precision. It is not the fastest method for large `n`, but for
 * the small symmetric matrices the math library cares about (metric
 * tensors, second fundamental forms, spectral decomposition of quadratic
 * forms) it is ideal.
 */

import { Matrix } from './Matrix';

export interface EigensymResult {
  /** Eigenvalues, sorted in descending order. */
  values: number[];
  /** Eigenvectors as columns. Column `i` corresponds to `values[i]`. */
  vectors: Matrix;
}

const MAX_SWEEPS = 50;
const OFFDIAG_TOL = 1e-14;

/**
 * Compute eigenvalues and eigenvectors of a symmetric matrix.
 *
 * The input is not checked for symmetry; passing a non-symmetric matrix is
 * a programmer error. The routine uses the lower triangle only and assumes
 * `A[i][j] === A[j][i]`.
 */
export function eigensym(A: Matrix): EigensymResult {
  if (A.rows !== A.cols) {
    throw new Error(`eigensym: expected square matrix, got ${A.rows}×${A.cols}`);
  }
  const n = A.rows;

  // Working copy of A; becomes diagonal as sweeps progress.
  const D = A.clone();
  // Accumulated orthogonal basis; starts at identity.
  const Q = Matrix.identity(n);

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    // Sum of squares of off-diagonal entries — convergence indicator.
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const v = D.get(p, q);
        off += v * v;
      }
    }
    if (off < OFFDIAG_TOL) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = D.get(p, q);
        if (apq === 0) continue;

        const app = D.get(p, p);
        const aqq = D.get(q, q);

        // Givens rotation that zeros D[p][q].
        const theta = (aqq - app) / (2 * apq);
        const t = theta >= 0
          ? 1 / (theta + Math.sqrt(1 + theta * theta))
          : 1 / (theta - Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        // Apply rotation to rows/columns p and q of D.
        D.set(p, p, app - t * apq);
        D.set(q, q, aqq + t * apq);
        D.set(p, q, 0);
        D.set(q, p, 0);

        for (let i = 0; i < n; i++) {
          if (i !== p && i !== q) {
            const dip = D.get(i, p);
            const diq = D.get(i, q);
            D.set(i, p, c * dip - s * diq);
            D.set(p, i, c * dip - s * diq);
            D.set(i, q, s * dip + c * diq);
            D.set(q, i, s * dip + c * diq);
          }
        }

        // Accumulate the rotation into Q.
        for (let i = 0; i < n; i++) {
          const qip = Q.get(i, p);
          const qiq = Q.get(i, q);
          Q.set(i, p, c * qip - s * qiq);
          Q.set(i, q, s * qip + c * qiq);
        }
      }
    }
  }

  // Collect eigenvalues from the diagonal, sort descending, permute Q columns.
  const values = new Array(n);
  for (let i = 0; i < n; i++) values[i] = D.get(i, i);

  const order = values
    .map((v: number, i: number) => ({ v, i }))
    .sort((a, b) => b.v - a.v);

  const sortedValues = order.map((o) => o.v);
  const sortedVectors = new Matrix(n, n);
  for (let j = 0; j < n; j++) {
    const src = order[j].i;
    for (let i = 0; i < n; i++) {
      sortedVectors.set(i, j, Q.get(i, src));
    }
  }

  return { values: sortedValues, vectors: sortedVectors };
}
