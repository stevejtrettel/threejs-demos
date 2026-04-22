/**
 * Surface types and interfaces
 *
 * Surfaces are 2D manifolds embedded in 3D space, parameterized by (u, v)
 * coordinates. In the n-D core (`math/manifolds/`), a `Surface` is a
 * `Manifold` specialized to `dim = 2` with an additional ℝ³ embedding.
 */

import * as THREE from 'three';
import type { Manifold, ManifoldDomain } from '@/math/manifolds';
import type { Matrix } from '@/math/linear-algebra';

/**
 * Domain bounds for a parametric surface — 2D named-field form.
 *
 * The n-D `ManifoldDomain` uses length-`dim` `min`/`max` arrays. 2D code
 * reads by the named convention `{uMin, uMax, vMin, vMax}`. These two
 * shapes are kept as distinct types, bridged by `boundsFromSurfaceDomain`
 * when a `DifferentialSurface` needs to satisfy the `Manifold` interface's
 * `getDomainBounds()`.
 */
export interface SurfaceDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Convert a 2D `SurfaceDomain` into the n-D `ManifoldDomain` shape. */
export function boundsFromSurfaceDomain(d: SurfaceDomain): ManifoldDomain {
  return { min: [d.uMin, d.vMin], max: [d.uMax, d.vMax] };
}

/**
 * Basic parametric surface
 *
 * A surface is a function R² → R³ that maps (u, v) coordinates to 3D points.
 */
export interface Surface {
  /**
   * Evaluate the surface at parameter coordinates (u, v)
   */
  evaluate(u: number, v: number): THREE.Vector3;

  /**
   * Get the parameter domain for this surface
   */
  getDomain(): SurfaceDomain;
}

/**
 * Partial derivatives of a surface
 */
export interface SurfacePartials {
  du: THREE.Vector3; // ∂r/∂u
  dv: THREE.Vector3; // ∂r/∂v
}

/**
 * Second fundamental form coefficients (extrinsic curvature).
 *
 * For a surface `r(u, v)` with unit normal `n`:
 *   L = ⟨∂²r/∂u², n⟩,  M = ⟨∂²r/∂u∂v, n⟩,  N = ⟨∂²r/∂v², n⟩.
 *
 * Strictly 2D-into-ℝ³: requires both the 2D parameter space and the ℝ³
 * ambient. Does not generalize to higher codimension without becoming
 * vector-valued.
 */
export interface SecondFundamentalForm {
  L: number;
  M: number;
  N: number;
}

/**
 * Differential surface with the standard embedded-2D operations.
 *
 * A `Surface` in ℝ³ that additionally implements the n-D `Manifold`
 * interface at `dim = 2`. Intrinsic consumers (geodesic integration,
 * Riemannian gradient, generic Christoffel, future forms/symplectic) see
 * it as a `Manifold`; 2D-specific consumers (`SurfaceMesh`, `FieldArrows`,
 * principal curvatures) use the embedding-dependent methods below.
 *
 * Extrinsic and 2D-only accessors:
 * - `computeNormal`, `computePartials` — require the ℝ³ embedding.
 * - `computeGaussianCurvature` — intrinsic scalar curvature, a 2D-only
 *   concept (the n-D analog is the Riemann tensor, a separate future type).
 * - `computeSecondFundamentalForm`, `computeMeanCurvature` — extrinsic,
 *   defined only for codim-1 surfaces in ℝ³.
 */
export interface DifferentialSurface extends Surface, Manifold {
  readonly dim: 2;

  // Implements both:
  //   Surface.getDomain(): SurfaceDomain         — 2D named fields
  //   Manifold.getDomainBounds(): ManifoldDomain — n-D min/max arrays
  // The typical implementation is `boundsFromSurfaceDomain(this.getDomain())`.

  computeNormal(u: number, v: number): THREE.Vector3;
  computePartials(u: number, v: number): SurfacePartials;

  /**
   * Metric tensor at `(u, v)`, packed as `[u, v]` for the `Manifold`
   * interface. Concrete surfaces typically unpack `p` at the top of the
   * method and use the 2D formulas.
   */
  computeMetric(p: number[]): Matrix;

  /**
   * Christoffel symbols as a flat Float64Array of length 8 (for dim=2):
   * `Γ[k*4 + i*2 + j]`. Optional; derived numerically when absent.
   */
  computeChristoffel?(p: number[]): Float64Array;

  /**
   * Gaussian curvature at `(u, v)`. Scalar curvature is a 2D concept
   * (Brioschi formula, purely intrinsic). Optional; derivable via
   * `gaussianCurvatureFromMetric` when absent.
   */
  computeGaussianCurvature?(u: number, v: number): number;

  /** Second fundamental form — extrinsic, codim-1-specific. Optional. */
  computeSecondFundamentalForm?(u: number, v: number): SecondFundamentalForm;

  /** Mean curvature `H = (EN − 2FM + GL) / (2(EG − F²))`. Optional. */
  computeMeanCurvature?(u: number, v: number): number;
}
