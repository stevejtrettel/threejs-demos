/**
 * `SL(2, ℂ)` — 2×2 complex matrices with `det = 1`.
 *
 * 6-dimensional (real) Lie group. Acts on the **Riemann sphere** `Ĉ`
 * by Möbius transformations `g · z = (a z + b) / (c z + d)`. Double
 * cover of `SO⁺(1, 3)`. Contains `SU(2)` (compact part) and `SU(1, 1)`
 * (= `SL(2, ℝ)` in disguise) as real subgroups.
 *
 * ## Storage
 *
 * `ComplexMatrix(2, 2)` — native 2×2 complex matrices, with eight reals
 * total (four complex entries). All arithmetic uses `ComplexMatrix`'s
 * complex multiply / inverse / etc. directly, no embedding gymnastics.
 *
 * `matrixSize = 2`, `dim = 6`.
 *
 * ## Closed-form `exp` via Cayley-Hamilton
 *
 * For traceless 2×2 complex `X`, `X² = −det(X) · I`. With `q = −det(X) ∈ ℂ`,
 *
 *   exp(X) = c · I + s · X,   c = cosh(√q),   s = sinh(√q)/√q
 *
 * Both are entire functions of `q ∈ ℂ`. We branch on `|q| ≈ 0` to use a
 * Taylor expansion (avoiding the removable `0/0` in `s`); otherwise
 * compute via complex `cosh` and `sinh`.
 *
 * Branches by trace:
 *   - `q` real and positive → "hyperbolic-like" (real `√q`)
 *   - `q` real and negative → "elliptic-like" (imaginary `√q`)
 *   - `q` genuinely complex → loxodromic (full complex `√q`)
 *   - `q ≈ 0`               → parabolic (Taylor)
 *
 * ## `log` deferred
 *
 * Element classification on `SL(2, ℂ)` only needs the trace, so the
 * Riemann-sphere demo doesn't depend on `log`. We'll add it via
 * Cayley-Hamilton dispatch when a demo specifically needs it.
 */

import { ComplexMatrix } from '@/math/linear-algebra';
import {
  type Complex,
  cadd, csub, cmul, cdiv, cneg, csqrt, ccosh, csinh, cabs,
  CZERO, CONE,
} from '@/math/algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

/**
 * `hat: ℝ⁶ → 𝔰𝔩(2, ℂ)`. The 6 real components are
 *
 *   ξ = (a_re, a_im, b_re, b_im, c_re, c_im)
 *
 * giving the traceless complex 2×2
 *
 *   X = [[α, β], [γ, −α]],  α = (a_re, a_im),  β = (b_re, b_im),  γ = (c_re, c_im).
 */
export function hatSL2C(xi: number[]): ComplexMatrix {
  const a: Complex = [xi[0], xi[1]];
  const b: Complex = [xi[2], xi[3]];
  const c: Complex = [xi[4], xi[5]];
  const m = new ComplexMatrix(2, 2);
  m.set(0, 0, a);
  m.set(0, 1, b);
  m.set(1, 0, c);
  m.set(1, 1, cneg(a));
  return m;
}

export function veeSL2C(X: ComplexMatrix): number[] {
  // Robust to non-traceless inputs (commutators may have small drift):
  // extract α as (X[0][0] − X[1][1]) / 2.
  const a00 = X.get(0, 0);
  const a11 = X.get(1, 1);
  const aHalf = csub(a00, a11);
  aHalf[0] *= 0.5; aHalf[1] *= 0.5;
  const b = X.get(0, 1);
  const c = X.get(1, 0);
  return [aHalf[0], aHalf[1], b[0], b[1], c[0], c[1]];
}

// ── exp ────────────────────────────────────────────────────────────

export function expSL2C(xi: number[]): ComplexMatrix {
  const a: Complex = [xi[0], xi[1]];
  const b: Complex = [xi[2], xi[3]];
  const c: Complex = [xi[4], xi[5]];

  // q = α² + βγ = −det(X)  for X = [[α, β], [γ, −α]].
  const q = cadd(cmul(a, a), cmul(b, c));

  let cf: Complex;
  let sf: Complex;
  if (cabs(q) < TAYLOR_THRESHOLD) {
    // Smooth Taylor through q = 0 covers the parabolic case.
    //   cosh(√q)     = 1 + q/2 + q²/24 + …
    //   sinh(√q)/√q  = 1 + q/6 + q²/120 + …
    const q2 = cmul(q, q);
    cf = [1 + q[0] / 2 + q2[0] / 24, q[1] / 2 + q2[1] / 24];
    sf = [1 + q[0] / 6 + q2[0] / 120, q[1] / 6 + q2[1] / 120];
  } else {
    const sq = csqrt(q);
    cf = ccosh(sq);
    sf = cdiv(csinh(sq), sq);
  }

  // exp(X) = cf · I + sf · X with X = [[α, β], [γ, −α]].
  const sfA = cmul(sf, a);
  const sfB = cmul(sf, b);
  const sfC = cmul(sf, c);

  const out = new ComplexMatrix(2, 2);
  out.set(0, 0, cadd(cf, sfA));
  out.set(0, 1, sfB);
  out.set(1, 0, sfC);
  out.set(1, 1, csub(cf, sfA));
  return out;
}

// ── Group class ────────────────────────────────────────────────────

class SL2CGroup extends MatrixLieGroup<ComplexMatrix> {
  readonly dim = 6;
  readonly matrixSize = 2;

  identity(): ComplexMatrix {
    return ComplexMatrix.identity(2);
  }

  /** Closed form for det = 1: g⁻¹ = [[d, −b], [−c, a]]. */
  inverse(g: ComplexMatrix): ComplexMatrix {
    const a = g.get(0, 0);
    const b = g.get(0, 1);
    const c = g.get(1, 0);
    const d = g.get(1, 1);
    const out = new ComplexMatrix(2, 2);
    out.set(0, 0, d);
    out.set(0, 1, cneg(b));
    out.set(1, 0, cneg(c));
    out.set(1, 1, a);
    return out;
  }

  hat(xi: number[]): ComplexMatrix { return hatSL2C(xi); }
  vee(X: ComplexMatrix): number[]  { return veeSL2C(X); }
  exp(xi: number[]): ComplexMatrix { return expSL2C(xi); }

  log(_g: ComplexMatrix): number[] {
    throw new Error('SL2C.log is not yet implemented (use trace for classification)');
  }

  /** Complex trace `tr(g) = α + δ`. */
  trace(g: ComplexMatrix): Complex {
    return cadd(g.get(0, 0), g.get(1, 1));
  }
}

export const SL2C = new SL2CGroup();

// Re-export some complex helpers used by the renderer / classify code,
// so callers don't need to import from `@/math/algebra` separately.
export { CZERO, CONE };
