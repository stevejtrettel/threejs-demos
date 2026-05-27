/**
 * Jacobi eigenvalue routine for a 4x4 real symmetric matrix.
 * Returns eigenvalues sorted ascending and eigenvectors as columns of O.
 */

const N = 4;

export interface EigResult {
  values: number[];
  vectors: number[][];   // O[i][j]: rows index components, columns index modes
}

export function jacobiEig(A: number[][]): EigResult {
  const M: number[][] = A.map(r => r.slice());
  const O: number[][] = [];
  for (let i = 0; i < N; i++) {
    const row = new Array(N).fill(0);
    row[i] = 1;
    O.push(row);
  }

  const MAX_ITER = 100;
  const TOL = 1e-13;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let p = 0, q = 1, max = 0;
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        const v = Math.abs(M[i][j]);
        if (v > max) { max = v; p = i; q = j; }
      }
    }
    if (max < TOL) break;

    const Mpp = M[p][p], Mqq = M[q][q], Mpq = M[p][q];
    const theta = 0.5 * Math.atan2(2 * Mpq, Mpp - Mqq);
    const c = Math.cos(theta), s = Math.sin(theta);

    for (let k = 0; k < N; k++) {
      if (k === p || k === q) continue;
      const Mpk = M[p][k], Mqk = M[q][k];
      M[p][k] = c * Mpk + s * Mqk;
      M[q][k] = -s * Mpk + c * Mqk;
      M[k][p] = M[p][k];
      M[k][q] = M[q][k];
    }
    M[p][p] = c * c * Mpp + 2 * c * s * Mpq + s * s * Mqq;
    M[q][q] = s * s * Mpp - 2 * c * s * Mpq + c * c * Mqq;
    M[p][q] = 0;
    M[q][p] = 0;

    for (let k = 0; k < N; k++) {
      const Okp = O[k][p], Okq = O[k][q];
      O[k][p] = c * Okp + s * Okq;
      O[k][q] = -s * Okp + c * Okq;
    }
  }

  const values: number[] = [];
  for (let i = 0; i < N; i++) values.push(M[i][i]);

  const order = [0, 1, 2, 3].sort((a, b) => values[a] - values[b]);
  const sortedValues = order.map(i => values[i]);
  const sortedVectors: number[][] = [];
  for (let i = 0; i < N; i++) {
    sortedVectors.push(order.map(j => O[i][j]));
  }

  return { values: sortedValues, vectors: sortedVectors };
}
