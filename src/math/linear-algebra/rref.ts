/**
 * Reduced Row Echelon Form
 *
 * Gaussian elimination with partial pivoting.
 * Mutates the matrix in place and returns the pivot column indices.
 */

import type { Matrix } from './Matrix';

const EPS = 1e-10;

/**
 * Reduce a matrix to reduced row echelon form (in place).
 *
 * @returns Array of pivot column indices (one per pivot row)
 */
export function rref(m: Matrix): number[] {
  const pivots: number[] = [];
  let pivotRow = 0;

  for (let col = 0; col < m.cols && pivotRow < m.rows; col++) {
    // Find the best pivot in this column (partial pivoting)
    let bestRow = -1;
    let bestVal = EPS;
    for (let row = pivotRow; row < m.rows; row++) {
      const val = Math.abs(m.get(row, col));
      if (val > bestVal) {
        bestVal = val;
        bestRow = row;
      }
    }

    if (bestRow === -1) continue; // no pivot in this column

    // Swap to pivot position
    m.swapRows(pivotRow, bestRow);

    // Scale pivot row so pivot = 1
    m.scaleRow(pivotRow, 1 / m.get(pivotRow, col));

    // Eliminate all other rows in this column
    for (let row = 0; row < m.rows; row++) {
      if (row === pivotRow) continue;
      const factor = m.get(row, col);
      if (Math.abs(factor) > EPS) {
        m.addScaledRow(row, pivotRow, -factor);
      }
    }

    pivots.push(col);
    pivotRow++;
  }

  return pivots;
}
