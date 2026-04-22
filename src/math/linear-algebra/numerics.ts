/**
 * Numerical helpers for tolerance-based comparisons and diagnostic norms.
 *
 * Useful in tests and sanity assertions — not typically in hot paths.
 */

import type { Matrix } from './Matrix';

const DEFAULT_TOL = 1e-9;

export function isClose(a: number, b: number, tol: number = DEFAULT_TOL): boolean {
  return Math.abs(a - b) <= tol;
}

export function isCloseVector(a: number[], b: number[], tol: number = DEFAULT_TOL): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tol) return false;
  }
  return true;
}

export function isCloseMatrix(A: Matrix, B: Matrix, tol: number = DEFAULT_TOL): boolean {
  if (A.rows !== B.rows || A.cols !== B.cols) return false;
  const n = A.rows * A.cols;
  for (let i = 0; i < n; i++) {
    if (Math.abs(A.data[i] - B.data[i]) > tol) return false;
  }
  return true;
}

/** Frobenius norm: `sqrt(Σ |a_ij|²)`. Useful as a matrix-magnitude diagnostic. */
export function frobenius(A: Matrix): number {
  let s = 0;
  const n = A.rows * A.cols;
  for (let i = 0; i < n; i++) s += A.data[i] * A.data[i];
  return Math.sqrt(s);
}
