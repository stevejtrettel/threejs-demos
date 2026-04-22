/**
 * Surface types and interfaces
 *
 * Surfaces are 2D manifolds embedded in 3D space, parameterized by (u, v) coordinates.
 */

import * as THREE from 'three';

/**
 * Domain bounds for a parametric surface
 */
export interface SurfaceDomain {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/**
 * Basic parametric surface
 *
 * A surface is a function R² → R³ that maps (u,v) coordinates to 3D points.
 */
export interface Surface {
  /**
   * Evaluate the surface at parameter coordinates (u, v)
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Point in 3D space
   */
  evaluate(u: number, v: number): THREE.Vector3;

  /**
   * Get the parameter domain for this surface
   *
   * @returns Domain bounds { uMin, uMax, vMin, vMax }
   */
  getDomain(): SurfaceDomain;
}

/**
 * Partial derivatives of a surface
 */
export interface SurfacePartials {
  du: THREE.Vector3; // ∂r/∂u - tangent in u direction
  dv: THREE.Vector3; // ∂r/∂v - tangent in v direction
}

/**
 * First fundamental form (metric tensor) coefficients
 *
 * The metric tensor measures distances and angles on the surface.
 * For a surface r(u,v):
 * - E = ⟨∂r/∂u, ∂r/∂u⟩
 * - F = ⟨∂r/∂u, ∂r/∂v⟩
 * - G = ⟨∂r/∂v, ∂r/∂v⟩
 */
export interface FirstFundamentalForm {
  E: number;
  F: number;
  G: number;
}

/**
 * Second fundamental form coefficients
 *
 * The second fundamental form measures how the surface curves in 3D space.
 * - L = ⟨∂²r/∂u², n⟩
 * - M = ⟨∂²r/∂u∂v, n⟩
 * - N = ⟨∂²r/∂v², n⟩
 */
export interface SecondFundamentalForm {
  L: number;
  M: number;
  N: number;
}

/**
 * Christoffel symbols of a 2D Riemannian metric
 *
 * Γᵏᵢⱼ encodes how the coordinate system changes as you move around the patch.
 * Purely derived from the metric tensor and its first partials; symmetric in (i, j).
 *
 * Lives here (not in geodesics/) because it is metric-derived data, shared by
 * geodesic integration, parallel transport, intrinsic curvature, etc.
 */
export interface ChristoffelSymbols {
  // Γ¹₁₁, Γ¹₁₂, Γ¹₂₂
  gamma_1_11: number;
  gamma_1_12: number;
  gamma_1_22: number;

  // Γ²₁₁, Γ²₁₂, Γ²₂₂
  gamma_2_11: number;
  gamma_2_12: number;
  gamma_2_22: number;
}

/**
 * A coordinate patch carrying a Riemannian metric.
 *
 * Intrinsic-only: knows its domain and its metric tensor g(u, v). It does
 * NOT carry any embedding or know where the patch sits in an ambient space.
 *
 * This is the input type for intrinsic geometric operations — geodesic
 * integration, parallel transport, Gaussian curvature. Those consumers
 * never need evaluate(), computeNormal(), or any extrinsic data.
 *
 * `DifferentialSurface` (embedding + induced metric) satisfies this
 * automatically; an abstract metric (e.g. pullback of a kinetic-energy
 * metric, or a hand-written metric on a rectangle) satisfies it directly.
 *
 * Optional methods are analytic overrides of quantities the library can
 * derive numerically from `computeMetric`. Provide them for speed or when
 * finite differences would be unstable.
 */
export interface MetricPatch {
  /**
   * Get the parameter domain for this patch
   */
  getDomain(): SurfaceDomain;

  /**
   * Compute the metric tensor at (u, v)
   */
  computeMetric(u: number, v: number): FirstFundamentalForm;

  /**
   * Compute Christoffel symbols at (u, v) analytically.
   *
   * Optional — the library derives this numerically from `computeMetric`
   * when absent. Provide an analytic version for speed or near singularities.
   */
  computeChristoffel?(u: number, v: number): ChristoffelSymbols;

  /**
   * Compute Gaussian curvature at (u, v) analytically.
   *
   * Optional — derivable from `computeMetric` via the Brioschi formula
   * (purely intrinsic). For `DifferentialSurface` this agrees with
   * (LN − M²)/(EG − F²) by Theorema Egregium.
   */
  computeGaussianCurvature?(u: number, v: number): number;
}

/**
 * Differential surface with geometry computations
 *
 * A parametric surface in R³ (extends `Surface`) that additionally carries
 * the standard differential-geometric operations on that embedding —
 * partials, normals, and the induced Riemannian metric.
 *
 * Because it also satisfies `MetricPatch`, every `DifferentialSurface` works
 * directly with geodesic / curvature / parallel-transport code. The induced
 * metric is computed as g_ij = ∂r/∂xⁱ · ∂r/∂xʲ (Euclidean pullback from R³).
 *
 * Extrinsic curvature data (second fundamental form, mean curvature) lives
 * on this interface, not on `MetricPatch`, because it requires the embedding.
 */
export interface DifferentialSurface extends Surface, MetricPatch {
  /**
   * Compute unit normal vector at (u, v)
   */
  computeNormal(u: number, v: number): THREE.Vector3;

  /**
   * Compute partial derivatives at (u, v)
   */
  computePartials(u: number, v: number): SurfacePartials;

  /**
   * Compute second fundamental form at (u, v)
   *
   * Optional — extrinsic, requires the embedding.
   */
  computeSecondFundamentalForm?(u: number, v: number): SecondFundamentalForm;

  /**
   * Compute mean curvature at (u, v)
   *
   * Optional — extrinsic, requires the embedding.
   * H = (EN − 2FM + GL) / (2(EG − F²))
   */
  computeMeanCurvature?(u: number, v: number): number;
}
