import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { VectorField } from './types';

/**
 * Wrap a plain function `(p, t?) => Float64Array` as an n-D `VectorField`.
 *
 * The quickest way to get a field: provide a closure, a dimension, and a
 * domain.
 *
 * @example Rotation field in ℝ²
 *   const field = new FromFunction(2,
 *     { min: [-2, -2], max: [2, 2] },
 *     (p) => {
 *       const out = new Float64Array(2);
 *       out[0] = -p[1];
 *       out[1] =  p[0];
 *       return out;
 *     });
 */
export class FromFunction implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);

  private readonly fn: (p: number[], t?: number) => Float64Array;
  private readonly domain: ManifoldDomain;

  constructor(
    dim: number,
    domain: ManifoldDomain,
    fn: (p: number[], t?: number) => Float64Array,
  ) {
    this.dim = dim;
    this.domain = { min: domain.min.slice(), max: domain.max.slice() };
    this.fn = fn;
  }

  evaluate(p: number[], t?: number): Float64Array {
    return this.fn(p, t);
  }

  getDomain(): ManifoldDomain {
    return this.domain;
  }
}
