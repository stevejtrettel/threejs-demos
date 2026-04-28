/**
 * `SU(2)` — group of 2×2 complex unitary matrices with determinant 1.
 *
 * Topologically `SU(2) ≅ S³`, algebraically the unit quaternions.
 * Double-covers `SO(3)` via the adjoint action `q ↦ (v ↦ q·v·q*)` on
 * pure-imaginary quaternions ≅ ℝ³.
 *
 * ## Storage
 *
 * Each `SU(2)` element is a unit quaternion `(w, x, y, z)` packed into a
 * `Matrix(2, 2)` container with `data[0..3] = (w, x, y, z)`. The
 * "Matrix" shape here is **not** a real 2×2 matrix — arithmetic is
 * quaternion arithmetic, overridden below. All library code routes
 * through the `SU2` singleton's methods; no code should treat an `SU(2)`
 * element's raw `data` as a real 2×2 matrix.
 *
 * ## Relation to SO(3)
 *
 * For any `ξ ∈ ℝ³`, `SU2.exp(ξ)` is the quaternion whose adjoint action
 * equals `SO3.exp(ξ)`.
 *   - `|ξ| = 2π`:  `q = −identity` (double-cover anti-identity)
 *   - `|ξ| = 4π`:  `q = +identity`
 *
 * See `smokeTest.ts` for the `Ad_q(v) = SO3.exp(ξ) · v` verification.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat: ℝ³ → 𝔰𝔲(2)`, with the convention `hat(ξ) = −(i/2)(ξ·σ)` so that
 * `[hat(a), hat(b)] = hat(a × b)` (matching SO(3)'s bracket). This is
 * what makes the map `SU(2) → SO(3)`, `q ↦ Ad_q`, a (double-cover)
 * Lie-group homomorphism.
 *
 * 𝔰𝔲(2) elements are stored as pure-imaginary quaternions `(0, ξ/2)`.
 */
export function hatSU2(xi: number[]): Matrix {
  const m = new Matrix(2, 2);
  m.data[0] = 0;
  m.data[1] = xi[0] / 2;
  m.data[2] = xi[1] / 2;
  m.data[3] = xi[2] / 2;
  return m;
}

/**
 * `vee: 𝔰𝔲(2) → ℝ³` — inverse of `hatSU2`. Extracts the imaginary part
 * and doubles it. Doesn't check that the real part is zero.
 */
export function veeSU2(X: Matrix): number[] {
  return [2 * X.data[1], 2 * X.data[2], 2 * X.data[3]];
}

// ── exp / log (closed form: quaternion Rodrigues) ──────────────────

/**
 *   exp(hat(ξ)) = cos(|ξ|/2) + sin(|ξ|/2) · ξ̂
 *
 * stored as the unit quaternion `(w, x, y, z)` with `w = cos(|ξ|/2)`
 * and `(x, y, z) = sin(|ξ|/2) · ξ̂`.
 */
export function expSU2(xi: number[]): Matrix {
  const a = xi[0], b = xi[1], c = xi[2];
  const theta2 = a * a + b * b + c * c;
  const theta = Math.sqrt(theta2);

  const m = new Matrix(2, 2);
  if (theta < TAYLOR_THRESHOLD) {
    m.data[0] = 1 - theta2 / 8;
    const k = 0.5 - theta2 / 48;
    m.data[1] = k * a;
    m.data[2] = k * b;
    m.data[3] = k * c;
    return m;
  }
  m.data[0] = Math.cos(theta / 2);
  const s = Math.sin(theta / 2) / theta;
  m.data[1] = s * a;
  m.data[2] = s * b;
  m.data[3] = s * c;
  return m;
}

/**
 * `log` on the principal branch `|ξ| ≤ π`: normalize `q`'s sign first so
 * the scalar part is non-negative (hemisphere of identity).
 */
export function logSU2(q: Matrix): number[] {
  let w = q.data[0];
  let x = q.data[1], y = q.data[2], z = q.data[3];
  if (w < 0) { w = -w; x = -x; y = -y; z = -z; }

  const vNorm = Math.hypot(x, y, z);
  if (vNorm < TAYLOR_THRESHOLD) {
    return [2 * x, 2 * y, 2 * z];
  }
  const theta = 2 * Math.atan2(vNorm, w);
  const k = theta / vNorm;
  return [k * x, k * y, k * z];
}

// ── Group class ────────────────────────────────────────────────────

class SU2Group extends MatrixLieGroup {
  readonly dim = 3;
  readonly matrixSize = 2;

  identity(): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] = 1;   // w = 1, (x, y, z) = 0
    return m;
  }

  /** Quaternion multiplication. */
  multiply(A: Matrix, B: Matrix): Matrix {
    const w1 = A.data[0], x1 = A.data[1], y1 = A.data[2], z1 = A.data[3];
    const w2 = B.data[0], x2 = B.data[1], y2 = B.data[2], z2 = B.data[3];
    const m = new Matrix(2, 2);
    m.data[0] = w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2;
    m.data[1] = w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2;
    m.data[2] = w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2;
    m.data[3] = w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2;
    return m;
  }

  /** For a unit quaternion, inverse = conjugate = (w, −x, −y, −z). */
  inverse(q: Matrix): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] =  q.data[0];
    m.data[1] = -q.data[1];
    m.data[2] = -q.data[2];
    m.data[3] = -q.data[3];
    return m;
  }

  hat(xi: number[]): Matrix { return hatSU2(xi); }
  vee(X: Matrix): number[]  { return veeSU2(X); }
  exp(xi: number[]): Matrix { return expSU2(xi); }
  log(q: Matrix): number[]  { return logSU2(q); }
}

export const SU2 = new SU2Group();
