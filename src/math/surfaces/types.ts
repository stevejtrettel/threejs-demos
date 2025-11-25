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
 * Differential surface with geometry computations
 *
 * Extends basic Surface with differential geometry operations:
 * normals, tangents, curvatures, etc.
 */
export interface DifferentialSurface extends Surface {
  /**
   * Compute unit normal vector at (u, v)
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Unit normal vector
   */
  computeNormal(u: number, v: number): THREE.Vector3;

  /**
   * Compute partial derivatives at (u, v)
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Object with du and dv tangent vectors
   */
  computePartials(u: number, v: number): SurfacePartials;

  /**
   * Compute first fundamental form (metric tensor) at (u, v)
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Metric coefficients { E, F, G }
   */
  computeMetric(u: number, v: number): FirstFundamentalForm;

  /**
   * Compute second fundamental form at (u, v)
   *
   * Optional - not all surfaces need this.
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Second fundamental form coefficients { L, M, N }
   */
  computeSecondFundamentalForm?(u: number, v: number): SecondFundamentalForm;

  /**
   * Compute Gaussian curvature at (u, v)
   *
   * Optional - can be derived from fundamental forms.
   * K = (LN - M²) / (EG - F²)
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Gaussian curvature
   */
  computeGaussianCurvature?(u: number, v: number): number;

  /**
   * Compute mean curvature at (u, v)
   *
   * Optional - can be derived from fundamental forms.
   * H = (EN - 2FM + GL) / (2(EG - F²))
   *
   * @param u - First parameter coordinate
   * @param v - Second parameter coordinate
   * @returns Mean curvature
   */
  computeMeanCurvature?(u: number, v: number): number;
}
