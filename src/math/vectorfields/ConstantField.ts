import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { SurfaceDomain } from '@/math/surfaces/types';
import type { VectorField } from './types';

export interface ConstantFieldOptions {
  direction: [number, number];
  domain: SurfaceDomain;
}

/**
 * A uniform field: `(u, v) ↦ (a, b)`.
 *
 * Useful for sanity checks and baseline demos. On a flat patch the flow is
 * straight lines; on a curved surface it pushes forward to a coordinate flow
 * that generally is *not* geodesic.
 */
export class ConstantField implements VectorField, Parametric {
  readonly params = new Params(this);

  declare a: number;
  declare b: number;

  private readonly domain: SurfaceDomain;

  constructor(options: ConstantFieldOptions) {
    this.domain = { ...options.domain };

    this.params
      .define('a', options.direction[0])
      .define('b', options.direction[1]);
  }

  evaluate(_u: number, _v: number, _t?: number): [number, number] {
    return [this.a, this.b];
  }

  getDomain(): SurfaceDomain {
    return this.domain;
  }
}
