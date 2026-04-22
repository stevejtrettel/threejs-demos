import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { Manifold, ManifoldDomain } from '@/math/manifolds';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { VectorField } from './types';

export interface GradientFieldOptions {
  /**
   * Flip sign so the flow *descends* the scalar (gradient descent).
   * Default: false, i.e. ascends the scalar.
   */
  descend?: boolean;
}

/**
 * Riemannian gradient of a scalar field on an n-D `Manifold`.
 *
 * On a Euclidean patch `∇f = (∂f/∂x^i)`, but on a curved manifold the
 * musical iso raises the index:
 *   `(∇f)^i = g^{ij} ∂_j f`.
 *
 * Uses the full `Matrix.invert()` on the metric at each evaluation — fast
 * for the small n where this is useful (2, 3, 4); if a larger-n demo needs
 * this in a hot loop, optimize later.
 */
export class GradientField implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);

  private readonly scalar: DifferentiableScalarField;
  private readonly patch: Manifold;
  private readonly sign: number;
  private readonly buf: Float64Array;

  constructor(
    scalar: DifferentiableScalarField,
    patch: Manifold,
    options: GradientFieldOptions = {},
  ) {
    if (patch.dim !== scalar.dim) {
      throw new Error(
        `GradientField: dim mismatch — patch.dim=${patch.dim}, scalar.dim=${scalar.dim}`,
      );
    }
    this.dim = patch.dim;
    this.scalar = scalar;
    this.patch = patch;
    this.sign = options.descend ? -1 : 1;
    this.buf = new Float64Array(this.dim);

    this.params.dependOn(patch, scalar);
  }

  evaluate(p: number[], _t?: number): Float64Array {
    const n = this.dim;
    // 2×2 fast path — metric inverse as closed form, avoids Matrix.invert.
    if (n === 2) {
      const g = this.patch.computeMetric(p).data;
      const E = g[0], F = g[1], G = g[3];
      const det = E * G - F * F;
      const g11 =  G / det;
      const g12 = -F / det;
      const g22 =  E / det;
      const df = this.scalar.computePartials(p);
      this.buf[0] = this.sign * (g11 * df[0] + g12 * df[1]);
      this.buf[1] = this.sign * (g12 * df[0] + g22 * df[1]);
      return this.buf;
    }
    // General n×n path.
    const gInv = this.patch.computeMetric(p).invert().data;
    const df = this.scalar.computePartials(p);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += gInv[i * n + j] * df[j];
      this.buf[i] = this.sign * s;
    }
    return this.buf;
  }

  getDomain(): ManifoldDomain {
    return this.patch.getDomainBounds();
  }
}
