/**
 * Canonical cotangent-bundle construction.
 *
 * Given an n-D manifold M with parameter-space domain `(min_M, max_M)`,
 * the cotangent bundle `T*M` is a 2n-dim symplectic manifold with:
 *   - Coordinates `(q^1, …, q^n, p_1, …, p_n)`, layout `[q; p]`
 *   - Canonical Liouville 1-form `θ = Σ p_i dq^i`
 *   - Canonical symplectic 2-form `ω = −dθ = Σ dq^i ∧ dp_i`
 *
 * In the `[q; p]` index layout, ω has the constant antisymmetric block form
 *   ω = [  0    I_n ]
 *       [ −I_n   0  ]
 *
 * Momentum coordinates range over ℝ (unbounded); position coordinates
 * inherit the base manifold's bounds.
 */

import type { Manifold, ManifoldDomain } from '@/math/manifolds';
import type { TwoForm } from '@/math/forms';
import { Matrix } from '@/math/linear-algebra';
import type { SymplecticManifold } from './types';

/**
 * Build `T*M` as a symplectic manifold with the canonical form.
 *
 * The base manifold `M`'s domain becomes the position half; momenta are
 * `[-∞, ∞]` in each component. The canonical ω is constant over the bundle,
 * so the `Matrix` is built once and reused on every evaluation.
 */
export function cotangentBundle(M: Manifold): SymplecticManifold {
  const n = M.dim;
  const dim = 2 * n;

  // Precomputed canonical ω — constant, so allocate once.
  const omegaMatrix = new Matrix(dim, dim);
  for (let i = 0; i < n; i++) {
    omegaMatrix.data[i * dim + (n + i)] = 1;        // ω_{i, n+i} = +1
    omegaMatrix.data[(n + i) * dim + i] = -1;       // ω_{n+i, i} = -1
  }

  const symplecticForm: TwoForm = {
    dim,
    evaluate: (_p: number[]) => omegaMatrix,
  };

  const baseBounds = M.getDomainBounds();
  const bounds: ManifoldDomain = {
    min: [...baseBounds.min, ...new Array(n).fill(-Infinity)],
    max: [...baseBounds.max, ...new Array(n).fill(Infinity)],
  };

  return {
    dim,
    getDomainBounds: () => bounds,
    symplecticForm,
  };
}
