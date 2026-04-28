/**
 * `SO(2)` — group of 2×2 proper rotations (`R Rᵀ = I`, `det R = 1`).
 *
 * Abelian and 1-dimensional; isomorphic to `U(1)` and to the unit
 * circle `S¹`. Intrinsic holonomy on a 2-dim Riemannian surface takes
 * values here — the single angle of rotation within the tangent plane.
 *
 * All Lie-algebraic structure is trivial:
 *   - `[ξ, η] = 0` (abelian)
 *   - `Ad_R(ξ) = ξ`, `Ad*_R(μ) = μ`
 *
 * Singleton export `SO2` since the group has no parameters.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat: ℝ → so(2)` — skew-symmetric 2×2 matrix from a scalar angular rate.
 *
 *   hat([ω]) = [[ 0, −ω],
 *               [ ω,  0]]
 *
 * The Lie algebra `so(2)` is 1-dimensional — SO(2) is abelian — so the
 * algebra element is a single real number, carried as a length-1
 * `number[]` for uniformity with the rest of the library.
 */
export function hatSO2(xi: number[]): Matrix {
  const w = xi[0];
  const m = new Matrix(2, 2);
  m.data[0] =  0; m.data[1] = -w;
  m.data[2] =  w; m.data[3] =  0;
  return m;
}

/**
 * `vee: so(2) → ℝ` — inverse of `hatSO2`.
 */
export function veeSO2(X: Matrix): number[] {
  return [X.data[2]];
}

// ── exp / log (closed form) ────────────────────────────────────────

/**
 *   exp(hat([θ])) = [[cos θ, −sin θ],
 *                    [sin θ,  cos θ]]
 *
 *   log([[c, −s], [s, c]]) = [atan2(s, c)]
 *
 * SO(2) is abelian and 1-dimensional, so exp is a diffeomorphism from
 * `ℝ` onto the universal cover — on SO(2) itself the map is periodic
 * with period 2π. `log` returns the principal branch `(−π, π]`.
 */
export function expSO2(xi: number[]): Matrix {
  const theta = xi[0];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const m = new Matrix(2, 2);
  m.data[0] = c; m.data[1] = -s;
  m.data[2] = s; m.data[3] =  c;
  return m;
}

export function logSO2(R: Matrix): number[] {
  return [Math.atan2(R.data[2], R.data[0])];
}

// ── Group class ────────────────────────────────────────────────────

class SO2Group extends MatrixLieGroup {
  readonly dim = 1;
  readonly matrixSize = 2;

  identity(): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] = 1; m.data[3] = 1;
    return m;
  }

  /** `R⁻¹ = Rᵀ` for rotations. */
  inverse(R: Matrix): Matrix {
    return R.transpose();
  }

  hat(xi: number[]): Matrix    { return hatSO2(xi); }
  vee(X: Matrix): number[]     { return veeSO2(X); }
  exp(xi: number[]): Matrix    { return expSO2(xi); }
  log(g: Matrix): number[]     { return logSO2(g); }

  /** Abelian: `[ξ, η] = 0`. */
  bracket(_xi: number[], _eta: number[]): number[] { return [0]; }

  /** Abelian: `Ad_R(ξ) = ξ`. */
  adjoint(_R: Matrix, xi: number[]): number[] { return [xi[0]]; }

  /** Abelian: `Ad*_R(μ) = μ`. */
  coadjoint(_R: Matrix, mu: number[]): number[] { return [mu[0]]; }
}

export const SO2 = new SO2Group();
