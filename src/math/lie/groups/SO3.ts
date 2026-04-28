/**
 * `SO(3)` — group of 3×3 proper rotations (`R Rᵀ = I`, `det R = 1`).
 *
 * Lie algebra `so(3)` is the skew-symmetric 3×3 matrices, isomorphic to `ℝ³`
 * via the `hat` map. Under that identification the Lie bracket becomes the
 * cross product, and the adjoint action becomes ordinary matrix-vector
 * multiplication: `Ad_R(ξ) = R · ξ`.
 *
 * Exported as a singleton `SO3` since the group has no parameters.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat: ℝ³ → so(3)` — skew-symmetric matrix from a 3-vector.
 *
 *   hat([ω₀, ω₁, ω₂]) = [[  0,  −ω₂,   ω₁],
 *                        [ ω₂,    0,  −ω₀],
 *                        [−ω₁,   ω₀,    0]]
 *
 * Fundamental property: `hat(ω) · v = ω × v` for any `v ∈ ℝ³`. This is the
 * identification `so(3) ≅ ℝ³` under which the Lie bracket on `so(3)`
 * (matrix commutator) becomes the cross product on `ℝ³`.
 */
export function hatSO3(xi: number[]): Matrix {
  const [a, b, c] = xi;
  const m = new Matrix(3, 3);
  m.data[0] =  0; m.data[1] = -c; m.data[2] =  b;
  m.data[3] =  c; m.data[4] =  0; m.data[5] = -a;
  m.data[6] = -b; m.data[7] =  a; m.data[8] =  0;
  return m;
}

/**
 * `vee: so(3) → ℝ³` — inverse of `hatSO3`.
 */
export function veeSO3(X: Matrix): number[] {
  // X[1][2] = -a, X[0][2] = b, X[1][0] = c   in row-major flat indexing.
  return [X.data[7], X.data[2], X.data[3]];
}

// ── exp / log (closed form: Rodrigues) ──────────────────────────────

/**
 * Rodrigues' formula: `exp: so(3) → SO(3)` from a 3-vector.
 *
 *   exp(hat(ω)) = I + sin(θ)/θ · hat(ω) + (1 − cos θ)/θ² · hat(ω)²
 *
 * where θ = |ω|. For θ ≈ 0 we Taylor-expand in place to avoid the
 * removable singularity in `sin(θ)/θ` and `(1 − cos θ)/θ²`.
 */
export function expSO3(xi: number[]): Matrix {
  const [a, b, c] = xi;
  const theta2 = a * a + b * b + c * c;
  const theta = Math.sqrt(theta2);

  const R = new Matrix(3, 3);
  R.data[0] = 1; R.data[4] = 1; R.data[8] = 1;   // start as identity

  const K = hatSO3(xi);
  const K2 = K.multiply(K);

  // Coefficients of K and K² in the Rodrigues series.
  // For small θ use Taylor: sin(θ)/θ = 1 − θ²/6 + …, (1−cos θ)/θ² = ½ − θ²/24 + …
  let s: number;   // coefficient of K
  let c2: number;  // coefficient of K²
  if (theta < TAYLOR_THRESHOLD) {
    s = 1 - theta2 / 6;
    c2 = 0.5 - theta2 / 24;
  } else {
    s = Math.sin(theta) / theta;
    c2 = (1 - Math.cos(theta)) / theta2;
  }

  for (let i = 0; i < 9; i++) {
    R.data[i] += s * K.data[i] + c2 * K2.data[i];
  }
  return R;
}

/**
 * Inverse Rodrigues: `log: SO(3) → so(3)` near the identity.
 *
 * Given `R ∈ SO(3)`, `θ = arccos((tr R − 1) / 2)` and
 *
 *   hat(ω) = (θ / (2 sin θ)) · (R − Rᵀ)
 *
 * Well-defined and smooth for `θ ∈ [0, π)`. Callers targeting the
 * boundary `θ = π` should guard.
 */
export function logSO3(R: Matrix): number[] {
  const trR = R.data[0] + R.data[4] + R.data[8];
  const cosTheta = Math.max(-1, Math.min(1, (trR - 1) / 2));
  const theta = Math.acos(cosTheta);

  if (theta < TAYLOR_THRESHOLD) {
    return [
      0.5 * (R.data[7] - R.data[5]),
      0.5 * (R.data[2] - R.data[6]),
      0.5 * (R.data[3] - R.data[1]),
    ];
  }

  const s = theta / (2 * Math.sin(theta));
  return [
    s * (R.data[7] - R.data[5]),
    s * (R.data[2] - R.data[6]),
    s * (R.data[3] - R.data[1]),
  ];
}

// ── Group class ────────────────────────────────────────────────────

class SO3Group extends MatrixLieGroup {
  readonly dim = 3;
  readonly matrixSize = 3;

  identity(): Matrix {
    const m = new Matrix(3, 3);
    m.data[0] = 1; m.data[4] = 1; m.data[8] = 1;
    return m;
  }

  /** `R⁻¹ = Rᵀ` for rotations — O(n²) instead of LU. */
  inverse(R: Matrix): Matrix {
    return R.transpose();
  }

  hat(xi: number[]): Matrix { return hatSO3(xi); }
  vee(X: Matrix): number[]  { return veeSO3(X); }
  exp(xi: number[]): Matrix { return expSO3(xi); }
  log(g: Matrix): number[]  { return logSO3(g); }

  /** `[ξ, η] = ξ × η` on `so(3)` — cross product, no matrix work. */
  bracket(xi: number[], eta: number[]): number[] {
    return [
      xi[1] * eta[2] - xi[2] * eta[1],
      xi[2] * eta[0] - xi[0] * eta[2],
      xi[0] * eta[1] - xi[1] * eta[0],
    ];
  }

  /** `Ad_R(ξ) = R · ξ` — rotation acts on `so(3) ≅ ℝ³` by matrix-vector product. */
  adjoint(R: Matrix, xi: number[]): number[] {
    return R.mulVec(xi);
  }

  /**
   * On `so(3)` with the Euclidean inner product, `Ad` is orthogonal
   * (`R` is), so `Ad*_R = Ad_{R⁻¹}ᵀ = Ad_R` under the identification
   * `so(3)* ≅ ℝ³`. Coadjoint is simply `R · μ`.
   */
  coadjoint(R: Matrix, mu: number[]): number[] {
    return R.mulVec(mu);
  }
}

export const SO3 = new SO3Group();
