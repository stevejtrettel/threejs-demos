import type {
  Surface,
  SurfaceDomain,
  FirstFundamentalForm,
  ChristoffelSymbols,
  MetricPatch,
} from './types';

/**
 * Options for `MetricSurface`
 */
export interface MetricSurfaceOptions {
  /** Domain of (u, v) */
  domain: SurfaceDomain;
  /** Metric tensor g(u, v) in coordinates. */
  metric: (u: number, v: number) => FirstFundamentalForm;
  /** Optional analytic Christoffel symbols. Falls back to finite differences. */
  christoffel?: (u: number, v: number) => ChristoffelSymbols;
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
 * An intrinsic Riemannian patch with an optional decorative R³ embedding.
 *
 * Satisfies `MetricPatch` — plug directly into `GeodesicIntegrator`,
 * `gaussianCurvatureFromMetric`, parallel transport, etc. The `display`
 * field, if set, is a `Surface` used only for drawing; it is *not* used by
 * any intrinsic computation and its induced metric is generally unrelated
 * to this patch's metric.
 *
 * @example
 *   // Abstract metric on a rectangle; round-sphere shell just for picture
 *   const patch = new MetricSurface({
 *     domain: { uMin: -Math.PI/2, uMax: Math.PI/2, vMin: 0, vMax: 2*Math.PI },
 *     metric: (phi, t) => myPullbackMetric(phi, t, L),
 *     display: unitSphereEmbedding,
 *   });
 *   const mesh = new SurfaceMesh(patch.display!);
 *   const integrator = new GeodesicIntegrator(patch);
 */
export class MetricSurface implements MetricPatch {
  readonly display?: Surface;

  /** Present only when an analytic `christoffel` was supplied. */
  readonly computeChristoffel?: (u: number, v: number) => ChristoffelSymbols;

  /** Present only when an analytic `gaussianCurvature` was supplied. */
  readonly computeGaussianCurvature?: (u: number, v: number) => number;

  private readonly _domain: SurfaceDomain;
  private readonly _metric: (u: number, v: number) => FirstFundamentalForm;

  constructor(options: MetricSurfaceOptions) {
    this._domain = options.domain;
    this._metric = options.metric;
    if (options.display) this.display = options.display;
    if (options.christoffel) this.computeChristoffel = options.christoffel;
    if (options.gaussianCurvature) this.computeGaussianCurvature = options.gaussianCurvature;
  }

  getDomain(): SurfaceDomain {
    return this._domain;
  }

  computeMetric(u: number, v: number): FirstFundamentalForm {
    return this._metric(u, v);
  }
}
