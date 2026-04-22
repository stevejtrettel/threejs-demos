import type { Surface, SurfaceDomain } from './types';
import { boundsFromSurfaceDomain } from './types';
import { Matrix } from '@/math/linear-algebra';
import type { Manifold, ManifoldDomain } from '@/math/manifolds';

/**
 * Options for `MetricSurface`.
 */
export interface MetricSurfaceOptions {
  /** Domain of (u, v). */
  domain: SurfaceDomain;
  /** Metric tensor g(u, v) as a 2×2 matrix. */
  metric: (u: number, v: number) => Matrix;
  /**
   * Optional analytic Christoffel symbols at (u, v), flat layout
   * `Γ[k*4 + i*2 + j]` (length 8). Falls back to numerical when absent.
   */
  christoffel?: (u: number, v: number) => Float64Array;
  /** Optional analytic Gaussian curvature. Falls back to Brioschi. */
  gaussianCurvature?: (u: number, v: number) => number;

  /**
   * Optional visualization-only embedding into R³.
   *
   * **Not mathematically linked to `metric`.** Intended for cases where the
   * "true" embedding of the surface lives somewhere that can't be drawn
   * directly — R⁴, hyperbolic space, etc. — and you pick an R³ projection
   * just for display. The library draws the patch using this `Surface` and
   * runs intrinsic operations (geodesics, curvature) against `metric`; it
   * never tries to reconcile the two.
   *
   * Equally useful when the embedding is in R³ but the metric is deformed
   * (conformal rescalings, kinetic-energy pullbacks, etc.) and you want to
   * keep the original look while using the custom metric intrinsically.
   */
  display?: Surface;
}

/**
 * An intrinsic Riemannian 2D patch with an optional decorative R³ embedding.
 *
 * Satisfies `Manifold` at `dim = 2` — plug directly into `GeodesicIntegrator`,
 * `gaussianCurvatureFromMetric`, parallel transport, etc. The `display`
 * field, if set, is a `Surface` used only for drawing; it is *not* used by
 * any intrinsic computation and its induced metric is generally unrelated
 * to this patch's metric.
 */
export class MetricSurface implements Manifold {
  readonly dim = 2;
  readonly display?: Surface;

  /** Present only when an analytic `christoffel` was supplied. */
  readonly computeChristoffel?: (p: number[]) => Float64Array;

  /** Present only when an analytic `gaussianCurvature` was supplied. */
  readonly computeGaussianCurvature?: (u: number, v: number) => number;

  private readonly _domain: SurfaceDomain;
  private readonly _metric: (u: number, v: number) => Matrix;

  constructor(options: MetricSurfaceOptions) {
    this._domain = options.domain;
    this._metric = options.metric;
    if (options.display) this.display = options.display;
    if (options.christoffel) {
      const chr = options.christoffel;
      this.computeChristoffel = (p: number[]) => chr(p[0], p[1]);
    }
    if (options.gaussianCurvature) this.computeGaussianCurvature = options.gaussianCurvature;
  }

  getDomain(): SurfaceDomain {
    return this._domain;
  }

  getDomainBounds(): ManifoldDomain {
    return boundsFromSurfaceDomain(this._domain);
  }

  computeMetric(p: number[]): Matrix {
    return this._metric(p[0], p[1]);
  }
}
