/**
 * Poisson manifolds — sibling to `SymplecticManifold`.
 *
 * A Poisson manifold `(M, π)` is a manifold equipped with a Poisson bivector
 * `π` such that the Poisson bracket `{f, g} = π(df, dg)` satisfies the
 * Jacobi identity. Unlike a symplectic manifold, `π` need not be invertible
 * — odd-dimensional Poisson manifolds are common and important (e.g.
 * `so(3)* ≅ ℝ³`, the Lie-Poisson structure for rigid-body dynamics).
 *
 * For a Hamiltonian `H` the Poisson-Hamiltonian vector field is
 *   `X_H^i = π^{ij}(p) · ∂_j H`.
 * On the canonical cotangent bundle `T*M`, `π` is the standard symplectic
 * matrix and this reduces to Hamilton's equations.
 *
 * `PoissonManifold` and `SymplecticManifold` are siblings: neither subsumes
 * the other. A symplectic manifold *has* a Poisson structure (the inverse of
 * the symplectic form), but not every Poisson manifold is symplectic. Both
 * are needed to cover the full Hamiltonian story.
 */

import type { ManifoldDomain } from '@/math/manifolds';

export interface PoissonManifold {
  /** Dimension of the manifold — may be odd. */
  readonly dim: number;

  /** Parameter-space bounds. */
  getDomainBounds(): ManifoldDomain;

  /**
   * Poisson tensor `π^{ij}(p)` as a `dim × dim` antisymmetric matrix
   * flat-packed in row-major order: `π.data[i*dim + j] = π^{ij}(p)`.
   *
   * Returned as a raw `Float64Array` (not `Matrix`) because consumers
   * contract it directly against `dH` in a tight loop; the `Matrix`
   * wrapper would add nothing.
   *
   * Antisymmetry is a contract on the implementation, not enforced.
   */
  computePoissonTensor(p: number[]): Float64Array;
}
