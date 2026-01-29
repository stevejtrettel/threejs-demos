/**
 * Nullspace
 *
 * Computes a basis for the nullspace (kernel) of a matrix via RREF.
 */

import { Matrix } from './Matrix';
import { rref } from './rref';

/**
 * Compute a basis for the nullspace of the given matrix.
 *
 * Returns an array of basis vectors (each a number[] of length cols).
 * If the nullspace is trivial, returns an empty array.
 */
export function nullspace(m: Matrix): number[][] {
  const work = m.clone();
  const pivots = rref(work);

  const pivotSet = new Set(pivots);
  const freeCols: number[] = [];
  for (let j = 0; j < m.cols; j++) {
    if (!pivotSet.has(j)) freeCols.push(j);
  }

  // For each free column, build a nullspace basis vector.
  // The free variable gets 1, other free variables get 0,
  // and pivot variables are read off from the RREF.
  const basis: number[][] = [];

  for (const freeCol of freeCols) {
    const vec = new Array(m.cols).fill(0);
    vec[freeCol] = 1;

    for (let k = 0; k < pivots.length; k++) {
      vec[pivots[k]] = -work.get(k, freeCol);
    }

    basis.push(vec);
  }

  return basis;
}
