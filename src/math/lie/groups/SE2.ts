/**
 * `SE(2)` — group of rigid motions in the plane.
 *
 * Elements are 3×3 homogeneous matrices
 *
 *   g = [[  R(θ),  t ],
 *        [    0,   1 ]]
 *
 * with `R(θ) ∈ SO(2)`, `t ∈ ℝ²`. Algebra 𝔰𝔢(2) is 3-dim: `(ω, v_x, v_y)`.
 *
 * Bracket (base-class commutator default):
 *   [(ω₁, v₁), (ω₂, v₂)] = (0, ω₁ · J · v₂ − ω₂ · J · v₁)
 * where `J = hat_SO2(1)`. Verified in smoke tests.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat: ℝ³ → 𝔰𝔢(2)`.
 *
 * Convention: `ξ = (ω, v_x, v_y)` with the rotation angle first and the
 * 2D translation second. Matrix form:
 *
 *   hat([ω, v_x, v_y]) = [[ 0, −ω, v_x ],
 *                         [ ω,  0, v_y ],
 *                         [ 0,  0,  0  ]]
 *
 * Bottom row zero on the algebra, vs `[0, 0, 1]` on the group.
 */
export function hatSE2(xi: number[]): Matrix {
  const w = xi[0], vx = xi[1], vy = xi[2];
  const m = new Matrix(3, 3);
  m.data[0] = 0;  m.data[1] = -w; m.data[2] = vx;
  m.data[3] = w;  m.data[4] = 0;  m.data[5] = vy;
  return m;
}

/**
 * `vee: 𝔰𝔢(2) → ℝ³` — inverse of `hatSE2`. Reads `ω` from `X[1][0]` and
 * `(v_x, v_y)` from the first two entries of column 2.
 */
export function veeSE2(X: Matrix): number[] {
  return [
    X.data[3],   // ω = X[1][0]
    X.data[2],   // v_x = X[0][2]
    X.data[5],   // v_y = X[1][2]
  ];
}

// ── exp / log (closed form, 2D left-Jacobian) ──────────────────────

/**
 *   exp(hat([ω, v])) = [[ R(ω),  V(ω) · v ],
 *                       [  0,       1      ]]
 *
 *   R(ω) = [[cos ω, −sin ω], [sin ω, cos ω]]
 *   V(ω) = (sin ω / ω) · I + ((1 − cos ω) / ω) · J,   J = [[0, −1], [1, 0]]
 *
 * Integrating `exp(s · hat([ω, v]))` along `s ∈ [0, 1]` gives the left
 * Jacobian `V`. The removable singularity at `ω = 0` is handled by a
 * Taylor expansion.
 */
export function expSE2(xi: number[]): Matrix {
  const w = xi[0], vx = xi[1], vy = xi[2];
  const w2 = w * w;

  let c1: number, c2: number;   // coefficients of I and J in V
  if (Math.abs(w) < TAYLOR_THRESHOLD) {
    c1 = 1 - w2 / 6;
    c2 = w / 2 - (w2 * w) / 24;
  } else {
    c1 = Math.sin(w) / w;
    c2 = (1 - Math.cos(w)) / w;
  }

  // V · v = (c₁ · v_x − c₂ · v_y,  c₁ · v_y + c₂ · v_x)
  const Vv_x = c1 * vx - c2 * vy;
  const Vv_y = c1 * vy + c2 * vx;

  const cW = Math.cos(w);
  const sW = Math.sin(w);

  const m = new Matrix(3, 3);
  m.data[0] = cW;   m.data[1] = -sW;  m.data[2] = Vv_x;
  m.data[3] = sW;   m.data[4] = cW;   m.data[5] = Vv_y;
  m.data[8] = 1;
  return m;
}

/**
 * `log` on SE(2): extract `ω = atan2(R[1][0], R[0][0])`, then apply
 * `V(ω)⁻¹` to the translation. Because `V = c₁ I + c₂ J`, its inverse
 * is `(1/det V) · (c₁ I − c₂ J)` with `det V = 2(1 − cos ω)/ω²`.
 */
export function logSE2(g: Matrix): number[] {
  const w = Math.atan2(g.data[3], g.data[0]);
  const tx = g.data[2];
  const ty = g.data[5];

  let c1: number, c2: number;
  if (Math.abs(w) < TAYLOR_THRESHOLD) {
    c1 = 1 - (w * w) / 6;
    c2 = w / 2 - (w * w * w) / 24;
  } else {
    c1 = Math.sin(w) / w;
    c2 = (1 - Math.cos(w)) / w;
  }
  const det = c1 * c1 + c2 * c2;

  // V⁻¹ · t = (1/det) · (c₁ · t_x + c₂ · t_y,  −c₂ · t_x + c₁ · t_y)
  const vx = (c1 * tx + c2 * ty) / det;
  const vy = (-c2 * tx + c1 * ty) / det;

  return [w, vx, vy];
}

// ── Group class ────────────────────────────────────────────────────

class SE2Group extends MatrixLieGroup {
  readonly dim = 3;
  readonly matrixSize = 3;

  identity(): Matrix {
    return Matrix.identity(3);
  }

  /** Closed form: g⁻¹ = [[Rᵀ, −Rᵀ·t], [0, 1]]. */
  inverse(g: Matrix): Matrix {
    const out = new Matrix(3, 3);
    out.data[0] = g.data[0]; out.data[1] = g.data[3];
    out.data[3] = g.data[1]; out.data[4] = g.data[4];
    out.data[2] = -(g.data[0] * g.data[2] + g.data[3] * g.data[5]);
    out.data[5] = -(g.data[1] * g.data[2] + g.data[4] * g.data[5]);
    out.data[8] = 1;
    return out;
  }

  hat(xi: number[]): Matrix { return hatSE2(xi); }
  vee(X: Matrix): number[]  { return veeSE2(X); }
  exp(xi: number[]): Matrix { return expSE2(xi); }
  log(g: Matrix): number[]  { return logSE2(g); }
}

export const SE2 = new SE2Group();
