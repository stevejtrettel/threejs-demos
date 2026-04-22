/**
 * Flat ℝⁿ as a reference `Manifold`.
 *
 * Metric is the identity at every point; Christoffel symbols are zero; domain
 * is `[-∞, ∞]` in every coordinate by default (callers that need a finite
 * box can override).
 *
 * Useful as a sanity check (Γ must vanish for any dimension) and as the
 * trivial ambient for demos where the interesting structure is carried by a
 * non-trivial vector field or Hamiltonian rather than by the geometry.
 */

import { Matrix } from '@/math/linear-algebra';
import type { Manifold, ManifoldDomain } from './types';

export interface EuclideanOptions {
  /** Optional domain override. Default: `[-∞, ∞]` in every coord. */
  domain?: ManifoldDomain;
}

export class Euclidean implements Manifold {
  readonly dim: number;
  private readonly domain: ManifoldDomain;
  private readonly metric: Matrix;
  private readonly christoffel: Float64Array;

  constructor(dim: number, options: EuclideanOptions = {}) {
    this.dim = dim;
    this.domain = options.domain ?? {
      min: new Array(dim).fill(-Infinity),
      max: new Array(dim).fill(Infinity),
    };
    this.metric = Matrix.identity(dim);
    this.christoffel = new Float64Array(dim * dim * dim); // all zero
  }

  getDomainBounds(): ManifoldDomain {
    return this.domain;
  }

  computeMetric(_p: number[]): Matrix {
    return this.metric;
  }

  computeChristoffel(_p: number[]): Float64Array {
    return this.christoffel;
  }
}
