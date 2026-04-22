/**
 * Complex projective space CP^{N-1} and its geometry.
 *
 * Points in CP^{N-1} are represented as Complex[] (homogeneous coordinates).
 * Operations: toric moment map, U(N) action, Givens rotations.
 */

import {
  type Complex,
  cadd,
  cmul,
  cabs2,
  CZERO,
  CONE,
} from './complex';

// ── Moment map ───────────────────────────────────────────

/**
 * Toric moment map: [z₀, ..., z_{N-1}] → [|z₀|², ..., |z_{N-1}|²]
 * normalized to sum = 1.
 *
 * The result lives in the standard (N-1)-simplex (barycentric coordinates).
 */
export function momentMap(point: Complex[]): number[] {
  const abs2 = point.map(cabs2);
  const sum = abs2.reduce((a, b) => a + b, 0);
  if (sum === 0) return abs2;
  return abs2.map(v => v / sum);
}

// ── U(N) action ──────────────────────────────────────────

/**
 * Apply a complex N×N matrix to a complex vector.
 *
 *   w_i = Σ_j M[i][j] · v[j]
 */
export function unitaryAction(M: Complex[][], v: Complex[]): Complex[] {
  const N = v.length;
  const result: Complex[] = new Array(N);
  for (let i = 0; i < N; i++) {
    let sum: Complex = CZERO;
    for (let j = 0; j < N; j++) {
      sum = cadd(sum, cmul(M[i][j], v[j]));
    }
    result[i] = sum;
  }
  return result;
}

// ── Matrix builders ──────────────────────────────────────

/**
 * N×N complex identity matrix.
 */
export function identity(N: number): Complex[][] {
  const M: Complex[][] = new Array(N);
  for (let i = 0; i < N; i++) {
    M[i] = new Array(N);
    for (let j = 0; j < N; j++) {
      M[i][j] = i === j ? CONE : CZERO;
    }
  }
  return M;
}

/**
 * Givens rotation in the (i, j)-plane of ℂ^N by angle θ.
 *
 * The result is a real orthogonal matrix (hence unitary):
 *   M[i][i] = cos θ,  M[i][j] = −sin θ
 *   M[j][i] = sin θ,  M[j][j] = cos θ
 *   M[k][k] = 1 for k ≠ i, j
 */
export function givensRotation(
  N: number,
  i: number,
  j: number,
  angle: number,
): Complex[][] {
  const M = identity(N);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  M[i][i] = [c, 0];
  M[i][j] = [-s, 0];
  M[j][i] = [s, 0];
  M[j][j] = [c, 0];
  return M;
}

/**
 * Compose two N×N complex matrices: C = A · B.
 */
export function matMul(A: Complex[][], B: Complex[][]): Complex[][] {
  const N = A.length;
  const C: Complex[][] = new Array(N);
  for (let i = 0; i < N; i++) {
    C[i] = new Array(N);
    for (let j = 0; j < N; j++) {
      let sum: Complex = CZERO;
      for (let k = 0; k < N; k++) {
        sum = cadd(sum, cmul(A[i][k], B[k][j]));
      }
      C[i][j] = sum;
    }
  }
  return C;
}
