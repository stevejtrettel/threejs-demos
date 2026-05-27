/**
 * Connection matrices for the K = -1 moving-frame integrator.
 *
 * Given a sine-Gordon solution ω(u, v) governing the angle of the Chebyshev
 * net on a surface of constant negative Gaussian curvature, the orthonormal
 * frame (T₁, T₂, N) attached to the surface evolves as
 *
 *   ∂F/∂u = F · A_u(ω_u),    ∂F/∂v = F · A_v(ω),
 *
 * with the skew-symmetric connection matrices below. Position evolves as
 *
 *   ∂X/∂u = T₁,    ∂X/∂v = cos ω · T₁ + sin ω · T₂.
 *
 * The compatibility condition ∂_v A_u − ∂_u A_v + [A_u, A_v] = 0 reduces
 * to the scalar equation ω_uv = sin ω.
 *
 * State packing for the integrator: a length-12 array
 *   state[0..8]   = F (row-major 3×3), with the basis vectors as columns
 *                   T₁ = (F[0], F[3], F[6]),
 *                   T₂ = (F[1], F[4], F[7]),
 *                   N  = (F[2], F[5], F[8]).
 *   state[9..11]  = X (position in ℝ³).
 */

/** A_u(ω_u): 3×3 row-major skew matrix. */
export function connU(wu: number): number[] {
  return [
     0,   wu,  0,
    -wu,   0, -1,
     0,    1,  0,
  ];
}

/** A_v(ω): 3×3 row-major skew matrix. */
export function connV(omega: number): number[] {
  const s = Math.sin(omega);
  const c = Math.cos(omega);
  return [
    0,  0, -s,
    0,  0,  c,
    s, -c,  0,
  ];
}

/** C = A · B for 3×3 row-major matrices. */
function matMul3(A: number[], B: number[]): number[] {
  const C = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        s += A[i * 3 + k] * B[k * 3 + j];
      }
      C[i * 3 + j] = s;
    }
  }
  return C;
}

/**
 * Derivative ∂(F, X)/∂u given the current state and the value of ω_u
 * at the current (u, v). The caller is responsible for sampling ω_u at
 * the right position before invoking this.
 *
 * Returns a fresh length-12 array.
 */
export function derivU(state: number[], wu: number): number[] {
  const F = state; // we only read indices 0..8
  const dF = matMul3(F.slice(0, 9), connU(wu));
  // dX/du = T₁ = column 0 of F.
  return [
    dF[0], dF[1], dF[2],
    dF[3], dF[4], dF[5],
    dF[6], dF[7], dF[8],
    F[0], F[3], F[6],
  ];
}

/**
 * Derivative ∂(F, X)/∂v given the current state and the value of ω at
 * the current (u, v). Returns a fresh length-12 array.
 *
 * dX/dv = cos ω · T₁ + sin ω · T₂.
 */
export function derivV(state: number[], omega: number): number[] {
  const F = state;
  const dF = matMul3(F.slice(0, 9), connV(omega));
  const c = Math.cos(omega);
  const s = Math.sin(omega);
  return [
    dF[0], dF[1], dF[2],
    dF[3], dF[4], dF[5],
    dF[6], dF[7], dF[8],
    c * F[0] + s * F[1],
    c * F[3] + s * F[4],
    c * F[6] + s * F[7],
  ];
}

/** Identity frame, origin position: F = I, X = 0. Length 12. */
export const INIT_STATE: ReadonlyArray<number> = Object.freeze([
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
  0, 0, 0,
]);
