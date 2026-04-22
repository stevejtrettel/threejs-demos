/**
 * Differential-form types.
 *
 * A `k`-form on a `dim`-dim manifold assigns an antisymmetric rank-`k`
 * tensor to each point. For the degrees we actually use (1 and 2) we give
 * those concrete interfaces here; higher-rank forms stay in flat-array
 * convention (`Float64Array` of length `dim^k`) when a demo needs them.
 *
 * Storage conventions (matching `math/linear-algebra/` and `math/manifolds/`):
 *   - 1-form: `Float64Array(dim)`, `ω[i]`
 *   - 2-form: `Matrix(dim, dim)`, antisymmetric — `ω[i][j] = −ω[j][i]`,
 *             diagonal is zero
 *
 * Forms are intrinsic structure: they do not require a metric (Hodge is the
 * exception — see `hodge.ts`). The interfaces here deliberately do not
 * depend on `Manifold`.
 */

import type { Matrix } from '@/math/linear-algebra';

/**
 * A differential 1-form `ω(p)`. Returns a length-`dim` `Float64Array`:
 * `ω[i] = ω(∂/∂x^i)`.
 */
export interface OneForm {
  readonly dim: number;
  evaluate(p: number[]): Float64Array;
}

/**
 * A differential 2-form `ω(p)`. Returns an antisymmetric `dim × dim`
 * `Matrix`: `ω.data[i*dim + j] = ω(∂/∂x^i, ∂/∂x^j)`. The antisymmetry
 * constraint `ω[i][j] = −ω[j][i]` (and `ω[i][i] = 0`) is a contract on
 * implementations; not enforced by the type system.
 */
export interface TwoForm {
  readonly dim: number;
  evaluate(p: number[]): Matrix;
}
