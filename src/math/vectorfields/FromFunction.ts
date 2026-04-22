import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { SurfaceDomain } from '@/math/surfaces/types';
import type { VectorField } from './types';

/**
 * Wrap a plain function `(u, v, t?) => [du, dv]` as a `VectorField`.
 *
 * The quickest way to get a field: provide a closure and a domain.
 *
 * @example Van der Pol oscillator
 *   const field = new FromFunction(
 *     (u, v) => [v, (1 - u * u) * v - u],
 *     { uMin: -3, uMax: 3, vMin: -3, vMax: 3 }
 *   );
 */
export class FromFunction implements VectorField, Parametric {
  readonly params = new Params(this);

  private readonly fn: (u: number, v: number, t?: number) => [number, number];
  private readonly domain: SurfaceDomain;

  constructor(
    fn: (u: number, v: number, t?: number) => [number, number],
    domain: SurfaceDomain,
  ) {
    this.fn = fn;
    this.domain = { ...domain };
  }

  evaluate(u: number, v: number, t?: number): [number, number] {
    return this.fn(u, v, t);
  }

  getDomain(): SurfaceDomain {
    return this.domain;
  }
}
