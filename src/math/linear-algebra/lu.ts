/**
 * LU decomposition with partial pivoting.
 *
 * Factors a square matrix A as `P·A = L·U` where `P` is a row permutation,
 * `L` is unit lower-triangular, and `U` is upper-triangular.
 *
 * Shared workhorse for `det`, `solve`, and `invert`. Kept as a free function
 * so each of those can layer on top without its own pivoting pass.
 */

import { Matrix } from './Matrix';

export interface LUDecomposition {
  /** Combined LU matrix: strictly-lower of `L` (unit diagonal implicit) + upper of `U`. */
  readonly LU: Matrix;
  /** Row permutation: after applying `permutation`, row `i` of `A` became row `permutation[i]`. */
  readonly permutation: number[];
  /** Parity of the permutation: +1 (even) or −1 (odd). Needed for `det`. */
  readonly parity: 1 | -1;
}

/** Threshold for declaring a pivot "zero". */
const SINGULAR_EPS = 0;

/**
 * Compute the LU decomposition of a square matrix with partial pivoting.
 *
 * Does not mutate `A`. Returns a compact `LU` matrix where `L` (unit diagonal
 * implicit) occupies the strictly-lower triangle and `U` occupies the upper
 * triangle — the standard in-place layout.
 *
 * Throws if `A` is singular or non-square.
 */
export function luDecompose(A: Matrix): LUDecomposition {
  if (A.rows !== A.cols) {
    throw new Error(`luDecompose: expected square matrix, got ${A.rows}×${A.cols}`);
  }
  const n = A.rows;
  const LU = A.clone();
  const permutation = new Array(n);
  for (let i = 0; i < n; i++) permutation[i] = i;
  let parity: 1 | -1 = 1;

  for (let k = 0; k < n; k++) {
    // Partial pivot: largest |·| in column k at or below row k.
    let pivot = k;
    let max = Math.abs(LU.get(k, k));
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(LU.get(i, k));
      if (v > max) { max = v; pivot = i; }
    }
    if (max <= SINGULAR_EPS) {
      throw new Error(`luDecompose: singular ${n}×${n} matrix at column ${k}`);
    }
    if (pivot !== k) {
      LU.swapRows(k, pivot);
      const tmp = permutation[k]; permutation[k] = permutation[pivot]; permutation[pivot] = tmp;
      parity = -parity as 1 | -1;
    }

    // Eliminate below, storing multipliers into the strictly-lower triangle.
    const pivVal = LU.get(k, k);
    for (let i = k + 1; i < n; i++) {
      const factor = LU.get(i, k) / pivVal;
      LU.set(i, k, factor);
      for (let j = k + 1; j < n; j++) {
        LU.set(i, j, LU.get(i, j) - factor * LU.get(k, j));
      }
    }
  }

  return { LU, permutation, parity };
}

/**
 * Solve `L·y = P·b` where `L` is unit lower-triangular in the strictly-lower
 * part of `LU`. Writes into `y` and returns it.
 */
export function luForwardSolve(
  LU: Matrix,
  permutation: number[],
  b: number[],
): number[] {
  const n = LU.rows;
  const y = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[permutation[i]];
    for (let j = 0; j < i; j++) sum -= LU.get(i, j) * y[j];
    y[i] = sum;
  }
  return y;
}

/** Solve `U·x = y`. Writes into `x` and returns it. */
export function luBackSolve(LU: Matrix, y: number[]): number[] {
  const n = LU.rows;
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) sum -= LU.get(i, j) * x[j];
    x[i] = sum / LU.get(i, i);
  }
  return x;
}

/** Solve `A·x = b` using a precomputed LU factorization. */
export function luSolve(lu: LUDecomposition, b: number[]): number[] {
  const y = luForwardSolve(lu.LU, lu.permutation, b);
  return luBackSolve(lu.LU, y);
}
