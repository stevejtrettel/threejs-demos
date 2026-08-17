/**
 * Root-finding types.
 *
 * Two shapes appear throughout numerical solving: a differentiable *map*
 * ℝⁿ → ℝᵐ (whose zeros you want), and a differentiable *scalar* ℝⁿ → ℝ (whose
 * minima you descend to). They are related — `leastSquaresObjective` turns the
 * first into the second — but they are used by different algorithms, so they
 * stay separate interfaces.
 *
 * Convention, matching `math/manifolds` and `math/vectorfields`: points come in
 * as plain `number[]`, values go out as `Float64Array`.
 */

import type { Matrix } from '@/math/linear-algebra';

/**
 * A differentiable map `f: ℝⁿ → ℝᵐ`.
 *
 * `n = domainDim`, `m = codomainDim`. The Jacobian is `m × n`, so it is square
 * exactly when the system is (which is what `newton` requires).
 */
export interface DifferentiableMap {
  readonly domainDim: number;
  readonly codomainDim: number;

  /** @returns length-`codomainDim` `Float64Array` */
  value(p: number[]): Float64Array;

  /** @returns `codomainDim × domainDim` matrix of partials */
  jacobian(p: number[]): Matrix;
}

/**
 * A differentiable scalar function `φ: ℝⁿ → ℝ` — something to descend.
 */
export interface ScalarObjective {
  readonly dim: number;

  value(p: number[]): number;

  /** @returns length-`dim` `Float64Array` */
  gradient(p: number[]): Float64Array;
}
