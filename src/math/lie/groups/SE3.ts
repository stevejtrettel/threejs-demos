/**
 * `SE(3)` — group of rigid motions in 3D space.
 *
 * A group element is a 4×4 homogeneous matrix
 *
 *   g = [[ R, t ],
 *        [ 0, 1 ]]
 *
 * with `R ∈ SO(3)`, `t ∈ ℝ³`. Lie algebra `𝔰𝔢(3)` is 6-dim: rotations
 * plus translations, parametrized as `(ω, v)` with `ω ∈ ℝ³` (rotation
 * part) and `v ∈ ℝ³` (translation part).
 *
 * ## Bracket on 𝔰𝔢(3)
 *
 * Using the base-class commutator default, `bracket([ω₁, v₁], [ω₂, v₂])`
 * evaluates to `(ω₁ × ω₂, ω₁ × v₂ − ω₂ × v₁)` — semidirect-product
 * structure. Verified in smoke tests.
 *
 * ## Storage and arithmetic
 *
 * Standard 4×4 real matrix; `Matrix.multiply` does the right thing. The
 * `inverse` method is overridden with the closed form
 *
 *   g⁻¹ = [[ Rᵀ, −Rᵀ·t ], [ 0, 1 ]]
 *
 * which avoids a full LU factorization.
 *
 * ## Exp / log
 *
 * Closed form via the 3D left Jacobian `V(ω)`:
 *
 *   exp(hat([ω, v])) = [[ R,  V·v ], [ 0, 1 ]]
 *   V(ω) = I + (1 − cos θ)/θ² · K + (θ − sin θ)/θ³ · K²,   K = hat_SO3(ω)
 *
 * `log` reverses via `ω = logSO3(R)` and `v = V⁻¹ · t`.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';
import { hatSO3, expSO3, logSO3 } from './SO3';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * Convention: ξ = (ω, v) with rotation part first, translation part
 * second. Algebra element as a 4×4 real matrix
 *
 *   hat([ω, v]) = [[ hat_SO3(ω),  v ],
 *                  [      0,      0 ]]
 *
 * (Bottom row zero on the algebra — contrast with group elements which
 * have `[0, 0, 0, 1]`.)
 */
export function hatSE3(xi: number[]): Matrix {
  const a = xi[0], b = xi[1], c = xi[2];      // ω
  const vx = xi[3], vy = xi[4], vz = xi[5];   // v

  const m = new Matrix(4, 4);
  m.data[0] = 0;  m.data[1] = -c; m.data[2] = b;  m.data[3] = vx;
  m.data[4] = c;  m.data[5] = 0;  m.data[6] = -a; m.data[7] = vy;
  m.data[8] = -b; m.data[9] = a;  m.data[10] = 0; m.data[11] = vz;
  // Row 3 — all zeros (default).
  return m;
}

/**
 * Reads `ω` from the skew-symmetric upper-left 3×3 and `v` from the
 * first three entries of column 3.
 */
export function veeSE3(X: Matrix): number[] {
  return [
    X.data[9],    // ω₀ = X[2][1]
    X.data[2],    // ω₁ = X[0][2]
    X.data[4],    // ω₂ = X[1][0]
    X.data[3],    // v₀  = X[0][3]
    X.data[7],    // v₁  = X[1][3]
    X.data[11],   // v₂  = X[2][3]
  ];
}

// ── exp / log (closed form, 3D left-Jacobian) ──────────────────────

export function expSE3(xi: number[]): Matrix {
  const a = xi[0], b = xi[1], c = xi[2];
  const vx = xi[3], vy = xi[4], vz = xi[5];
  const theta2 = a * a + b * b + c * c;
  const theta = Math.sqrt(theta2);

  const R = expSO3([a, b, c]);

  // Coefficients of K and K² in V.
  let A: number, B: number;
  if (theta < TAYLOR_THRESHOLD) {
    A = 0.5 - theta2 / 24;
    B = 1 / 6 - theta2 / 120;
  } else {
    A = (1 - Math.cos(theta)) / theta2;
    B = (theta - Math.sin(theta)) / (theta * theta2);
  }

  // V · v = v + A·(K·v) + B·(K·(K·v))  where K = hatSO3(ω).
  const K = hatSO3([a, b, c]);
  const Kv = K.mulVec([vx, vy, vz]);
  const K2v = K.mulVec(Kv);
  const Vv = [
    vx + A * Kv[0] + B * K2v[0],
    vy + A * Kv[1] + B * K2v[1],
    vz + A * Kv[2] + B * K2v[2],
  ];

  // Pack the 4×4 group element.
  const M = new Matrix(4, 4);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      M.data[i * 4 + j] = R.data[i * 3 + j];
    }
    M.data[i * 4 + 3] = Vv[i];
  }
  M.data[15] = 1;
  return M;
}

export function logSE3(g: Matrix): number[] {
  const R = new Matrix(3, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      R.data[i * 3 + j] = g.data[i * 4 + j];
    }
  }
  const t = [g.data[3], g.data[7], g.data[11]];

  const omega = logSO3(R);
  const theta2 = omega[0] * omega[0] + omega[1] * omega[1] + omega[2] * omega[2];
  const theta = Math.sqrt(theta2);

  let gamma: number;
  if (theta < TAYLOR_THRESHOLD) {
    // V⁻¹ ≈ I − (1/2)K + (1/12)K² + (θ²/720)K² + …
    gamma = 1 / 12 + theta2 / 720;
  } else {
    gamma = 1 / theta2 - (1 + Math.cos(theta)) / (2 * theta * Math.sin(theta));
  }

  const K = hatSO3(omega);
  const Kt = K.mulVec(t);
  const K2t = K.mulVec(Kt);
  const v = [
    t[0] - 0.5 * Kt[0] + gamma * K2t[0],
    t[1] - 0.5 * Kt[1] + gamma * K2t[1],
    t[2] - 0.5 * Kt[2] + gamma * K2t[2],
  ];

  return [omega[0], omega[1], omega[2], v[0], v[1], v[2]];
}

// ── Group class ────────────────────────────────────────────────────

class SE3Group extends MatrixLieGroup {
  readonly dim = 6;
  readonly matrixSize = 4;

  identity(): Matrix {
    return Matrix.identity(4);
  }

  /** Closed form: g⁻¹ = [[Rᵀ, −Rᵀ·t], [0, 1]]. */
  inverse(g: Matrix): Matrix {
    const out = new Matrix(4, 4);
    // Rᵀ into upper-left 3×3.
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out.data[i * 4 + j] = g.data[j * 4 + i];
      }
    }
    // −Rᵀ·t into column 3.
    for (let i = 0; i < 3; i++) {
      let s = 0;
      for (let j = 0; j < 3; j++) {
        s += g.data[j * 4 + i] * g.data[j * 4 + 3];
      }
      out.data[i * 4 + 3] = -s;
    }
    out.data[15] = 1;
    return out;
  }

  hat(xi: number[]): Matrix { return hatSE3(xi); }
  vee(X: Matrix): number[]  { return veeSE3(X); }
  exp(xi: number[]): Matrix { return expSE3(xi); }
  log(g: Matrix): number[]  { return logSE3(g); }
}

export const SE3 = new SE3Group();
