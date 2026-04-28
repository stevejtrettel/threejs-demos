/**
 * Matrix Lie group types.
 *
 * See `docs/planning/lie.md` for the design rationale and phased roadmap.
 *
 * ## Storage conventions
 *
 * - Group elements `g ∈ G` are stored as `Matrix` (real) by default, or as
 *   `ComplexMatrix` for genuinely complex groups (e.g. `SL(2, ℂ)`,
 *   `SU(p, q)` for `p+q ≥ 3`). The class is generic over the storage type,
 *   so each group picks the natural one.
 * - Lie-algebra elements `ξ ∈ 𝔤` are stored as length-`dim` `number[]`, with
 *   `hat` / `vee` bridging to/from matrix form. For `so(3)` and `su(2)` this
 *   is `dim = 3`; for `se(3)` it's `dim = 6`; for `sl(2,ℂ)` it's `dim = 6`.
 * - Dual algebra `𝔤*` elements (used in Poisson geometry) are stored as
 *   length-`dim` `number[]`, identified with `𝔤` via the standard basis.
 *
 * ## Class design
 *
 * `MatrixLieGroup<M>` is an abstract base class generic over the matrix
 * storage type `M` (defaults to `Matrix`, so existing real groups continue
 * to work without parameterization). The constraint on `M` is structural:
 * it must support `add`, `scale`, and `multiply` operations of the right
 * shape, since the defaulted `bracket` / `adjoint` / `coadjoint` use them.
 *
 * Concrete groups override the required methods (`hat`, `vee`, `identity`,
 * `exp`, `log`) and optionally also `inverse` (closed form for e.g.
 * `SO(n)`, where `A⁻¹ = Aᵀ`). Every non-Padé operation (`bracket`,
 * `adjoint`, `coadjoint`, `leftTranslate`, `rightTranslate`, `multiply`)
 * is provided as a default implementation.
 */

import type { Matrix, ComplexMatrix } from '@/math/linear-algebra';

/**
 * Storage interface required by `MatrixLieGroup<M>`. Both `Matrix` and
 * `ComplexMatrix` satisfy this structurally — `add` and `scale` are used
 * by the default `bracket` implementation, `multiply` by all defaults.
 */
export interface MatrixLike<Self> {
  add(other: Self): Self;
  scale(s: number): Self;
  multiply(other: Self): Self;
}

// Both real and complex matrices satisfy MatrixLike — ensured by their
// respective class signatures. (We don't enforce structurally; TypeScript
// will catch a mismatch if you try to use the wrong storage type.)
export type MatrixStorage = Matrix | ComplexMatrix;

/**
 * A finite-dimensional matrix Lie group.
 *
 * Manifold / algebra dimension is `dim`; the matrix representation is
 * `matrixSize × matrixSize`. These two numbers differ whenever the algebra
 * sits in a strict subspace of `Mat(matrixSize)` — e.g. `so(3)` has `dim = 3`
 * and `matrixSize = 3` (skew-symmetric 3×3 matrices), `su(2)` has `dim = 3`
 * and `matrixSize = 2` (traceless anti-Hermitian 2×2), `se(3)` has `dim = 6`
 * and `matrixSize = 4`, `sl(2, ℂ)` has `dim = 6` and `matrixSize = 2`.
 *
 * Type parameter `M` is the matrix storage class. Defaults to `Matrix` for
 * real groups; complex groups use `ComplexMatrix`.
 */
export abstract class MatrixLieGroup<M extends MatrixLike<M> = Matrix> {
  /** Manifold / Lie-algebra dimension. */
  abstract readonly dim: number;

  /** Size of the matrix representation. */
  abstract readonly matrixSize: number;

  // ── Required: algebra ↔ matrix ────────────────────────────────

  /**
   * `hat: ℝ^dim → 𝔤 ⊂ Mat(matrixSize)`. Maps a Lie-algebra vector to its
   * matrix form.
   */
  abstract hat(xi: number[]): M;

  /** Inverse of `hat`: matrix-form algebra element → length-`dim` vector. */
  abstract vee(X: M): number[];

  // ── Required: group operations ────────────────────────────────

  /** Group identity `e`, as a `matrixSize × matrixSize` matrix. */
  abstract identity(): M;

  /** Matrix exponential `exp: 𝔤 → G`. Input is a length-`dim` algebra vector. */
  abstract exp(xi: number[]): M;

  /**
   * Inverse of `exp`, a local diffeomorphism near the identity. Returns a
   * length-`dim` algebra vector. Well-defined for `g` close to the identity;
   * behavior at conjugate/cut locus points is group-specific.
   */
  abstract log(g: M): number[];

  /**
   * `A⁻¹`. Subclasses must implement (groups choose between LU, transpose,
   * complex closed form, etc., depending on their storage).
   */
  abstract inverse(g: M): M;

  // ── Defaulted: group arithmetic ───────────────────────────────

  /** `A · B`. Default: delegate to the storage type's `multiply`. */
  multiply(A: M, B: M): M {
    return A.multiply(B);
  }

  /** Left translation `L_g(h) = g · h`. */
  leftTranslate(g: M, h: M): M {
    return this.multiply(g, h);
  }

  /** Right translation `R_g(h) = h · g`. */
  rightTranslate(g: M, h: M): M {
    return this.multiply(h, g);
  }

  // ── Defaulted: algebraic structure ────────────────────────────

  /**
   * Lie bracket `[ξ, η]` in vector form. Default: commutator of matrices,
   * `vee(hat(ξ)·hat(η) − hat(η)·hat(ξ))`. Override when a closed form is
   * cheaper (e.g. `so(3)` uses the cross product directly).
   *
   * Uses `this.multiply` rather than `M.prototype.multiply` directly so that
   * groups with non-standard storage (e.g. `SU(2)` stored as quaternions
   * inside a `Matrix`) can override `multiply` and have the default
   * `bracket` pick up the correct arithmetic for free.
   */
  bracket(xi: number[], eta: number[]): number[] {
    const X = this.hat(xi);
    const Y = this.hat(eta);
    const XY = this.multiply(X, Y);
    const YX = this.multiply(Y, X);
    return this.vee(XY.add(YX.scale(-1)));
  }

  /**
   * Adjoint action `Ad_g(ξ) = vee(g · hat(ξ) · g⁻¹)`, in vector form.
   * Override when a closed form exists — e.g. `SO(3).adjoint(R, ξ) = R · ξ`.
   */
  adjoint(g: M, xi: number[]): number[] {
    return this.vee(
      this.multiply(this.multiply(g, this.hat(xi)), this.inverse(g))
    );
  }

  /**
   * Coadjoint action `Ad*_g(μ)` on `𝔤*`, identified with `ℝ^dim` via the
   * standard basis.
   *
   * Convention: `Ad*_g = (Ad_{g⁻¹})ᵀ` so that `Ad*_{gh} = Ad*_g ∘ Ad*_h`
   * (group homomorphism). From `⟨Ad*_g(μ), ξ⟩ = ⟨μ, Ad_{g⁻¹}(ξ)⟩`,
   *
   *   `Ad*_g(μ)_i = Σ_j μ_j · [Ad_{g⁻¹}(e_i)]_j`
   *
   * Default: one `adjoint` call per basis vector, `O(dim²)` work plus
   * whatever `adjoint` costs. Override for compact groups where an
   * `Ad`-invariant inner product identifies `𝔤*` with `𝔤`.
   */
  coadjoint(g: M, mu: number[]): number[] {
    const n = this.dim;
    const ginv = this.inverse(g);
    const out = new Array(n);
    const ei = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      ei.fill(0);
      ei[i] = 1;
      const v = this.adjoint(ginv, ei); // = Ad_{g⁻¹}(e_i)
      let s = 0;
      for (let j = 0; j < n; j++) s += mu[j] * v[j];
      out[i] = s;
    }
    return out;
  }
}
