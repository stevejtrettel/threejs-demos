/**
 * `SL(2, ℝ)` — group of 2×2 real matrices with `det = 1`.
 *
 * 3-dimensional, non-compact. Acts on the upper half plane `ℍ²` and on
 * the real projective line by Möbius transformations. Doubly covers
 * the connected component of `SO(2,1)`. Closely related to
 * `Sp(2, ℝ)` (in fact isomorphic).
 *
 * ## Algebra basis
 *
 * `𝔰𝔩(2, ℝ)` = traceless real 2×2 matrices, with the standard basis
 *
 *   H = [[1, 0], [0, −1]]    E = [[0, 1], [0, 0]]    F = [[0, 0], [1, 0]]
 *
 * and brackets `[H, E] = 2E`, `[H, F] = −2F`, `[E, F] = H`.
 *
 * Convention: `hat([a, b, c]) = a H + b E + c F = [[a, b], [c, −a]]`.
 *
 * ## Closed-form `exp` via Cayley-Hamilton
 *
 * For `X` traceless 2×2, Cayley-Hamilton gives `X² = −det(X) · I`. Set
 * `q = a² + bc = −det(X)`. Then for any traceless `X`:
 *
 *   exp(X) = c · I + s · X
 *   c = cosh(√q),  s = sinh(√q)/√q     (q > 0,   "hyperbolic")
 *   c = cos(√−q),  s = sin(√−q)/√−q    (q < 0,   "elliptic")
 *   c = 1,         s = 1                (q = 0,   "parabolic")
 *
 * The two formulas analytically continue through `q = 0` — both `cosh(√q)`
 * and `sinh(√q)/√q` are entire smooth functions of `q ∈ ℝ`, with Taylor
 * series `1 + q/2 + q²/24 + …` and `1 + q/6 + q²/120 + …`. We branch on
 * `q` for stability.
 *
 * ## Closed-form `log`
 *
 * From `tr(g) = 2c`: read off `c`, infer `q` from the appropriate
 * branch, recover `s`, and solve `X = (g − c · I) / s`.
 *
 * Caveat: `exp` is **not surjective** on `SL(2, ℝ)`. Elements with
 * `tr(g) ≤ −2` (other than `−I`) are not in the image of `exp`. We
 * throw on such inputs rather than return an inaccurate result.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat([a, b, c]) = [[a, b], [c, −a]]` — the traceless 2×2 with the
 * standard `H, E, F` decomposition.
 */
export function hatSL2R(xi: number[]): Matrix {
  const a = xi[0], b = xi[1], c = xi[2];
  const m = new Matrix(2, 2);
  m.data[0] =  a; m.data[1] = b;
  m.data[2] =  c; m.data[3] = -a;
  return m;
}

/**
 * `vee` reads `(a, b, c)` from a 2×2 matrix. If the input isn't exactly
 * traceless we extract `a` symmetrically as `(X[0][0] − X[1][1]) / 2`,
 * which is robust to floating-point drift in computed commutators.
 */
export function veeSL2R(X: Matrix): number[] {
  return [
    (X.data[0] - X.data[3]) / 2,
    X.data[1],
    X.data[2],
  ];
}

// ── exp / log (closed form) ────────────────────────────────────────

export function expSL2R(xi: number[]): Matrix {
  const a = xi[0], b = xi[1], c = xi[2];
  const q = a * a + b * c;   // = −det(hat(xi))

  let cf: number;   // I-coefficient
  let sf: number;   // X-coefficient
  if (Math.abs(q) < TAYLOR_THRESHOLD) {
    // Smooth Taylor through q = 0 covers the parabolic case and a
    // robust neighborhood for both signs of q.
    cf = 1 + q / 2 + (q * q) / 24;
    sf = 1 + q / 6 + (q * q) / 120;
  } else if (q > 0) {
    const d = Math.sqrt(q);
    cf = Math.cosh(d);
    sf = Math.sinh(d) / d;
  } else {
    const theta = Math.sqrt(-q);
    cf = Math.cos(theta);
    sf = Math.sin(theta) / theta;
  }

  const m = new Matrix(2, 2);
  m.data[0] = cf + sf * a;
  m.data[1] = sf * b;
  m.data[2] = sf * c;
  m.data[3] = cf - sf * a;
  return m;
}

export function logSL2R(g: Matrix): number[] {
  const T = g.data[0] + g.data[3];

  // exp not surjective on SL(2, ℝ): tr ≤ -2 (except g = -I) is not in image.
  if (T <= -2 - 1e-12) {
    throw new Error(
      `logSL2R: g has tr = ${T} ≤ −2; not in the image of exp on SL(2, ℝ)`,
    );
  }

  // tr(g) = 2c (the I-coefficient of exp). Infer the branch from |c|.
  const cf = T / 2;
  let sf: number;

  if (cf > 1 + TAYLOR_THRESHOLD) {
    // Hyperbolic.
    const d = Math.acosh(cf);
    sf = Math.sinh(d) / d;
  } else if (cf < 1 - TAYLOR_THRESHOLD) {
    // Elliptic.
    const theta = Math.acos(cf);
    sf = Math.sin(theta) / theta;
  } else {
    // Parabolic / near-identity. Use Taylor: cf = 1 + q/2 + …, so q ≈ 2(cf−1),
    // and sf = 1 + q/6 + … = 1 + (cf−1)/3 + …
    const q = 2 * (cf - 1);
    sf = 1 + q / 6 + (q * q) / 120;
  }

  // X = (g − cf · I) / sf
  return [
    (g.data[0] - cf) / sf,
    g.data[1] / sf,
    g.data[2] / sf,
  ];
}

// ── Group class ────────────────────────────────────────────────────

class SL2RGroup extends MatrixLieGroup {
  readonly dim = 3;
  readonly matrixSize = 2;

  identity(): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] = 1; m.data[3] = 1;
    return m;
  }

  /** Closed form: g⁻¹ = [[d, −b], [−c, a]] for det(g) = 1. */
  inverse(g: Matrix): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] =  g.data[3];
    m.data[1] = -g.data[1];
    m.data[2] = -g.data[2];
    m.data[3] =  g.data[0];
    return m;
  }

  hat(xi: number[]): Matrix { return hatSL2R(xi); }
  vee(X: Matrix): number[]  { return veeSL2R(X); }
  exp(xi: number[]): Matrix { return expSL2R(xi); }
  log(g: Matrix): number[]  { return logSL2R(g); }
}

export const SL2R = new SL2RGroup();
