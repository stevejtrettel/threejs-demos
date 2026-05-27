/**
 * Numerical Goursat solver for the sine-Gordon equation ω_uv = sin ω.
 *
 * Sine-Gordon is hyperbolic with characteristics along the coordinate
 * axes, so the natural initial-value problem is the **Goursat problem**:
 * specify ω on two transverse characteristic lines (one segment of the
 * u-axis, one of the v-axis), then solve in the rectangle they bound.
 *
 * Discretization. Integrating ω_uv = sin ω over the cell [uᵢ, uᵢ₊₁] ×
 * [vⱼ, vⱼ₊₁] gives
 *
 *   ω(i+1, j+1) − ω(i+1, j) − ω(i, j+1) + ω(i, j)
 *     = ∫∫ sin ω du dv
 *     ≈ du · dv · sin( ¼ (ω(i,j) + ω(i+1,j) + ω(i,j+1) + ω(i+1,j+1)) ),
 *
 * an implicit equation in the unknown ω(i+1, j+1). Picard iteration —
 * starting from the linear guess ω(i+1, j+1) = ω(i+1, j) + ω(i, j+1) −
 * ω(i, j) — converges in a handful of passes when du, dv are not too
 * coarse and ω is well-behaved.
 *
 * Hazzidakis bound. Any Chebyshev quadrilateral on a K = -1 surface
 * has area ≤ 2π, so the rectangle size and the variation of ω on the
 * boundary together control whether the solution stays in (0, π). The
 * solver itself imposes no constraint — it integrates whatever you hand
 * it; geometric anomalies (cuspidal edges where ω crosses 0 or π) are
 * features of the resulting K = -1 surface, not bugs.
 */

export interface GoursatOptions {
  /**
   * Values of ω along the bottom edge v = vMin, indexed by i = 0..Nu-1.
   * Length must equal Nu.
   */
  omegaBottom: number[];

  /**
   * Values of ω along the left edge u = uMin, indexed by j = 0..Nv-1.
   * Length must equal Nv. Must satisfy omegaLeft[0] === omegaBottom[0]
   * (corner consistency).
   */
  omegaLeft: number[];

  /** Grid steps in u and v. */
  du: number;
  dv: number;

  /** Maximum Picard iterations per cell. Default 8. */
  maxIter?: number;
  /** Picard convergence tolerance per cell. Default 1e-10. */
  tol?: number;
}

/**
 * Solve the sine-Gordon Goursat problem on the rectangle determined by
 * the boundary data.
 *
 * Returns a 2D array `omega[i][j]` of size Nu × Nv (with Nu = omegaBottom.length
 * and Nv = omegaLeft.length).
 */
export function solveGoursat(opts: GoursatOptions): number[][] {
  const { omegaBottom, omegaLeft, du, dv } = opts;
  const Nu = omegaBottom.length;
  const Nv = omegaLeft.length;
  const maxIter = opts.maxIter ?? 8;
  const tol = opts.tol ?? 1e-10;

  if (Nu < 2 || Nv < 2) {
    throw new Error('solveGoursat: boundary arrays must each have length ≥ 2.');
  }
  if (Math.abs(omegaBottom[0] - omegaLeft[0]) > 1e-9) {
    throw new Error(
      `solveGoursat: corner inconsistency — omegaBottom[0] = ${omegaBottom[0]}, ` +
        `omegaLeft[0] = ${omegaLeft[0]}.`,
    );
  }

  const omega: number[][] = new Array(Nu);
  for (let i = 0; i < Nu; i++) omega[i] = new Array(Nv);
  // Seed the two boundaries.
  for (let i = 0; i < Nu; i++) omega[i][0] = omegaBottom[i];
  for (let j = 0; j < Nv; j++) omega[0][j] = omegaLeft[j];

  const k = du * dv;

  // March cell by cell. Order: for each i, fill column j = 1..Nv-1 by
  // moving up; needs (i, j), (i+1, j), (i, j+1). Equivalent loop nest:
  for (let i = 0; i < Nu - 1; i++) {
    for (let j = 0; j < Nv - 1; j++) {
      const o00 = omega[i][j];
      const o10 = omega[i + 1][j];
      const o01 = omega[i][j + 1];
      const linear = o10 + o01 - o00;
      let o11 = linear;
      for (let iter = 0; iter < maxIter; iter++) {
        const avg = 0.25 * (o00 + o10 + o01 + o11);
        const next = linear + k * Math.sin(avg);
        if (Math.abs(next - o11) < tol) {
          o11 = next;
          break;
        }
        o11 = next;
      }
      omega[i + 1][j + 1] = o11;
    }
  }

  return omega;
}
