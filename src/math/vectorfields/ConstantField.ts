import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { VectorField } from './types';

export interface ConstantFieldOptions {
  /** Length-`dim` vector of components. Stored; components are reactive via `params`. */
  direction: number[];
  domain: ManifoldDomain;
}

/**
 * A uniform n-D field: `(p) ↦ direction`.
 *
 * Useful for sanity checks and baseline demos. Components are reactive
 * (named `c0`, `c1`, …, `c{dim-1}` on the `params` system).
 */
export class ConstantField implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);

  private readonly domain: ManifoldDomain;
  private readonly buf: Float64Array;

  constructor(options: ConstantFieldOptions) {
    this.dim = options.direction.length;
    this.domain = { min: options.domain.min.slice(), max: options.domain.max.slice() };
    this.buf = new Float64Array(this.dim);

    for (let i = 0; i < this.dim; i++) {
      const name = `c${i}`;
      this.params.define(name, options.direction[i]);
    }
  }

  evaluate(_p: number[], _t?: number): Float64Array {
    for (let i = 0; i < this.dim; i++) {
      this.buf[i] = (this as unknown as Record<string, number>)[`c${i}`];
    }
    return this.buf;
  }

  getDomain(): ManifoldDomain {
    return this.domain;
  }
}
