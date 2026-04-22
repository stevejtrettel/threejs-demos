/**
 * n-D manifold types.
 *
 * A `Manifold` is a coordinate patch of any dimension carrying a (pseudo)
 * Riemannian metric. It generalizes the 2D `MetricPatch` that the surfaces
 * module currently uses; when `dim === 2`, the two concepts coincide.
 *
 * Points on the manifold are length-`dim` arrays. No embedding is implied —
 * that is the job of `DifferentialSurface` (2D) or future embedded types.
 */

import type { Params } from '@/Params';
import type { Matrix } from '@/math/linear-algebra';

/**
 * n-dim box in parameter space.
 *
 * `min[i]` and `max[i]` bound the i-th coordinate. Both arrays have length
 * equal to the manifold's `dim`.
 */
export interface ManifoldDomain {
  min: number[];
  max: number[];
}

/**
 * Intrinsic n-dim manifold with a Riemannian metric.
 *
 * The interface is deliberately minimal: dimension, domain, and the metric
 * at a point. Everything else (Christoffel symbols, curvature, inverse
 * metric) is derivable — see `christoffelFromMetric` in `christoffel.ts`.
 *
 * Concrete implementations that want reactivity expose a `params` field;
 * stateless implementations (e.g. flat ℝⁿ) may omit it.
 */
export interface Manifold {
  /** Dimension of the manifold. */
  readonly dim: number;

  /**
   * Parameter-space bounds as length-`dim` `min`/`max` arrays.
   *
   * Deliberately a different method name from `Surface.getDomain()` so 2D
   * surfaces can retain their named-field `SurfaceDomain` literal
   * (`{uMin, uMax, vMin, vMax}`) without having to also construct the
   * arrays. A `DifferentialSurface` implements both — the 2D named form
   * for surface-level code, the n-D array form for generic consumers.
   */
  getDomainBounds(): ManifoldDomain;

  /**
   * Metric tensor at point `p`. A `dim × dim` symmetric matrix.
   *
   * For a Riemannian metric the result is positive-definite; for
   * pseudo-Riemannian it is non-degenerate.
   */
  computeMetric(p: number[]): Matrix;

  /**
   * Christoffel symbols Γ^k_ij at point `p`, flat row-major:
   * `Γ[k*dim*dim + i*dim + j]`. Symmetric in `(i, j)`.
   *
   * The flat `Float64Array` layout mirrors `Matrix`'s internal storage —
   * one allocation per call, cache-friendly iteration. For readability
   * extract to nested arrays locally, or use the `chrIndex(k, i, j, n)`
   * helper.
   *
   * Optional: callers fall back to `christoffelFromMetric` (numerical)
   * when absent. Provide an analytic override for speed or near metric
   * singularities.
   */
  computeChristoffel?(p: number[]): Float64Array;

  /** Optional reactive parameters. */
  readonly params?: Params;
}
