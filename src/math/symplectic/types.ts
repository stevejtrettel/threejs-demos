/**
 * Symplectic-manifold types.
 *
 * A symplectic manifold is a pair (M, ω) where M is an even-dimensional
 * manifold and ω is a closed, non-degenerate 2-form. Unlike a Riemannian
 * manifold, there is no canonical metric — the symplectic form is the
 * primary structure.
 *
 * `SymplecticManifold` intentionally does NOT extend `Manifold` (our n-D
 * Riemannian interface). They are siblings, not one-inherits-other.
 */

import type { ManifoldDomain } from '@/math/manifolds';
import type { TwoForm } from '@/math/forms';

/**
 * An even-dim manifold equipped with a symplectic 2-form.
 *
 * `dim` must be even (= 2n); `symplecticForm` must be closed
 * (`dω = 0`) and non-degenerate pointwise. The library does not enforce
 * these algebraically — the contract is on the implementation.
 */
export interface SymplecticManifold {
  /** Dimension — must be even. */
  readonly dim: number;

  /** Parameter-space bounds of the phase space. */
  getDomainBounds(): ManifoldDomain;

  /** The symplectic 2-form. */
  readonly symplecticForm: TwoForm;
}
