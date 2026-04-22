import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { MetricPatch, SurfaceDomain } from '@/math/surfaces/types';
import type { DifferentiableScalarField2D } from '@/math/functions/types';
import type { VectorField } from './types';

export interface GradientFieldOptions {
  /**
   * Flip sign so the flow *descends* the scalar (gradient descent).
   * Default: false, i.e. ascends the scalar.
   */
  descend?: boolean;
}

/**
 * Riemannian gradient of a scalar field on a `MetricPatch`.
 *
 * On a Euclidean patch `∇f = (∂f/∂u, ∂f/∂v)`, but on a surface with a
 * non-trivial metric the musical iso raises the index:
 *   `(∇f)^i = g^{ij} ∂_j f`.
 *
 * That is what this class computes, which is what matters if you want
 * gradient flows whose trajectories are orthogonal to the level sets of `f`
 * *in the induced metric* — e.g. steepest descent on the surface, not on the
 * parameter rectangle.
 *
 * Pass a `MetricPatch`; any `DifferentialSurface` satisfies that automatically.
 */
export class GradientField implements VectorField, Parametric {
  readonly params = new Params(this);

  private readonly scalar: DifferentiableScalarField2D;
  private readonly patch: MetricPatch;
  private readonly sign: number;

  constructor(
    scalar: DifferentiableScalarField2D,
    patch: MetricPatch,
    options: GradientFieldOptions = {},
  ) {
    this.scalar = scalar;
    this.patch = patch;
    this.sign = options.descend ? -1 : 1;

    // Depend on whatever parametric pieces we were handed. `dependOn` is a
    // no-op for non-Parametric sources, so passing a plain object literal
    // is fine. Framework auto-cascades through to our own dependents.
    this.params.dependOn(patch, scalar);
  }

  evaluate(u: number, v: number, _t?: number): [number, number] {
    const g = this.patch.computeMetric(u, v);
    const det = g.E * g.G - g.F * g.F;
    // Inverse metric components
    const g11 = g.G / det;
    const g12 = -g.F / det;
    const g22 = g.E / det;

    const { du: df_du, dv: df_dv } = this.scalar.computePartials(u, v);

    // Raise the index: ∇^i f = g^{ij} ∂_j f
    return [
      this.sign * (g11 * df_du + g12 * df_dv),
      this.sign * (g12 * df_du + g22 * df_dv),
    ];
  }

  getDomain(): SurfaceDomain {
    return this.patch.getDomain();
  }
}
