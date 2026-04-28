/**
 * `SU(1, 1)` — the indefinite-unitary group of 2×2 complex matrices
 * preserving the Hermitian form `|z₀|² − |z₁|² = const`, with `det = 1`.
 *
 *   `SU(1, 1) = { g ∈ SL(2, ℂ) : g* J g = J,  J = diag(1, −1) }`
 *
 * Equivalently, `g = [[α, β], [β̄, ᾱ]]` with `|α|² − |β|² = 1`.
 *
 * 3-dimensional, isomorphic as a Lie group to `SL(2, ℝ)` via the Cayley
 * map (conjugation in `SL(2, ℂ)` by `C = [[1, −i], [1, i]]/√(2i)`).
 * Acts on the Poincaré disk `𝔻 = {|z| < 1}` by Möbius transformations
 *
 *   `g · z = (α z + β) / (β̄ z + ᾱ)`
 *
 * preserving the disk and its hyperbolic metric.
 *
 * ## Storage
 *
 * `Matrix(2, 2)` shell with `data = [Re α, Im α, Re β, Im β]` — the
 * four real DOF that parameterize the SU(1,1)-form group element. Like
 * `SU(2)`'s quaternion storage, this is **not** a real 2×2 matrix;
 * arithmetic is overridden below.
 *
 * ## Closed-form `exp` via Cayley-Hamilton
 *
 * Algebra `𝔰𝔲(1, 1) = { X = [[i·t, β], [β̄, −i·t]] : t ∈ ℝ, β ∈ ℂ }`.
 * For such `X`, direct computation gives `X² = (|β|² − t²) · I = q · I`,
 * so the matrix exponential collapses to a 2-term polynomial:
 *
 *   exp(X) = c · I + s · X
 *   c = cosh(√q),  s = sinh(√q)/√q   (q > 0,  hyperbolic)
 *   c = cos(√−q),  s = sin(√−q)/√−q  (q < 0,  elliptic)
 *   c = 1,         s = 1              (q = 0,  parabolic)
 *
 * Resulting `α = c + s · i · t`, `β_g = s · β` — four reals, packs
 * cleanly into our storage format.
 *
 * ## Convention for `hat`
 *
 * `hat([t, c, d]) = [[i·t, c + i·d], [c − i·d, −i·t]]` — i.e. the
 * three-component algebra vector is `(t, Re β, Im β)`.
 */

import { Matrix } from '@/math/linear-algebra';
import { MatrixLieGroup } from '../types';

const TAYLOR_THRESHOLD = 1e-8;

// ── hat / vee ───────────────────────────────────────────────────────

export function hatSU11(xi: number[]): Matrix {
  // Algebra element [[i·t, c+di], [c-di, -i·t]] stored as
  //   data = [Re α, Im α, Re β, Im β] = [0, t, c, d]
  const m = new Matrix(2, 2);
  m.data[0] = 0;       // Re α (algebra has α purely imaginary)
  m.data[1] = xi[0];   // Im α = t
  m.data[2] = xi[1];   // Re β
  m.data[3] = xi[2];   // Im β
  return m;
}

export function veeSU11(X: Matrix): number[] {
  // Returns (t, Re β, Im β). Drops Re α (which should be zero on a true
  // algebra element; we don't enforce).
  return [X.data[1], X.data[2], X.data[3]];
}

// ── exp / log (closed form, same trick as SL(2,ℝ)) ────────────────

export function expSU11(xi: number[]): Matrix {
  const t = xi[0], c = xi[1], d = xi[2];
  const q = c * c + d * d - t * t;   // = −det X = X²/I

  let cf: number, sf: number;
  if (Math.abs(q) < TAYLOR_THRESHOLD) {
    cf = 1 + q / 2 + (q * q) / 24;
    sf = 1 + q / 6 + (q * q) / 120;
  } else if (q > 0) {
    const r = Math.sqrt(q);
    cf = Math.cosh(r);
    sf = Math.sinh(r) / r;
  } else {
    const theta = Math.sqrt(-q);
    cf = Math.cos(theta);
    sf = Math.sin(theta) / theta;
  }

  // exp(X) = cf · I + sf · X
  //   α_g = cf + sf · i · t   →  Re α_g = cf,  Im α_g = sf · t
  //   β_g = sf · β             →  Re β_g = sf · c,  Im β_g = sf · d
  const m = new Matrix(2, 2);
  m.data[0] = cf;
  m.data[1] = sf * t;
  m.data[2] = sf * c;
  m.data[3] = sf * d;
  return m;
}

export function logSU11(g: Matrix): number[] {
  // tr(g) = α_g + ᾱ_g = 2 Re α_g.  Same regime selection as SL(2,ℝ).
  const cf = g.data[0];   // = Re α_g

  if (cf <= -1 - 1e-12) {
    throw new Error(
      `logSU11: g has Re α = ${cf} ≤ −1 (i.e., tr g ≤ −2); not in image of exp`,
    );
  }

  let sf: number;
  if (cf > 1 + TAYLOR_THRESHOLD) {
    const d = Math.acosh(cf);
    sf = Math.sinh(d) / d;
  } else if (cf < 1 - TAYLOR_THRESHOLD) {
    const theta = Math.acos(cf);
    sf = Math.sin(theta) / theta;
  } else {
    const q = 2 * (cf - 1);
    sf = 1 + q / 6 + (q * q) / 120;
  }

  // From exp formula: Im α_g = sf · t, β_g = sf · β.
  return [
    g.data[1] / sf,   // t
    g.data[2] / sf,   // Re β
    g.data[3] / sf,   // Im β
  ];
}

// ── Group class ────────────────────────────────────────────────────

class SU11Group extends MatrixLieGroup {
  readonly dim = 3;
  readonly matrixSize = 2;

  identity(): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] = 1;   // α = 1
    return m;        // (Im α, Re β, Im β) all zero
  }

  /**
   * Multiplication of two SU(1,1) elements in (α, β) form:
   *   α' = α₁ α₂ + β₁ β̄₂
   *   β' = α₁ β₂ + β₁ ᾱ₂
   */
  multiply(A: Matrix, B: Matrix): Matrix {
    const a1 = A.data[0], b1 = A.data[1], c1 = A.data[2], d1 = A.data[3];   // α₁=(a1,b1), β₁=(c1,d1)
    const a2 = B.data[0], b2 = B.data[1], c2 = B.data[2], d2 = B.data[3];

    // α₁ α₂ = (a1 + b1·i)(a2 + b2·i)
    const aa_re = a1 * a2 - b1 * b2;
    const aa_im = a1 * b2 + b1 * a2;

    // β₁ β̄₂ = (c1 + d1·i)(c2 − d2·i)
    const bb_re = c1 * c2 + d1 * d2;
    const bb_im = -c1 * d2 + d1 * c2;

    // α₁ β₂ = (a1 + b1·i)(c2 + d2·i)
    const ab_re = a1 * c2 - b1 * d2;
    const ab_im = a1 * d2 + b1 * c2;

    // β₁ ᾱ₂ = (c1 + d1·i)(a2 − b2·i)
    const ba_re = c1 * a2 + d1 * b2;
    const ba_im = -c1 * b2 + d1 * a2;

    const m = new Matrix(2, 2);
    m.data[0] = aa_re + bb_re;   // Re α'
    m.data[1] = aa_im + bb_im;   // Im α'
    m.data[2] = ab_re + ba_re;   // Re β'
    m.data[3] = ab_im + ba_im;   // Im β'
    return m;
  }

  /** g⁻¹ = [[ᾱ, −β], [−β̄, α]]. */
  inverse(g: Matrix): Matrix {
    const m = new Matrix(2, 2);
    m.data[0] =  g.data[0];   // Re ᾱ = Re α
    m.data[1] = -g.data[1];   // Im ᾱ = −Im α
    m.data[2] = -g.data[2];   // Re(−β) = −Re β
    m.data[3] = -g.data[3];   // Im(−β) = −Im β
    return m;
  }

  hat(xi: number[]): Matrix { return hatSU11(xi); }
  vee(X: Matrix): number[]  { return veeSU11(X); }
  exp(xi: number[]): Matrix { return expSU11(xi); }
  log(g: Matrix): number[]  { return logSU11(g); }
}

export const SU11 = new SU11Group();
