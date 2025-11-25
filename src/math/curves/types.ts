/**
 * Curve types and interfaces
 *
 * Curves are 1D manifolds embedded in 3D space, parameterized by t.
 */

import * as THREE from 'three';

/**
 * Domain bounds for a parametric curve
 */
export interface CurveDomain {
  tMin: number;
  tMax: number;
}

/**
 * Basic parametric curve
 *
 * A curve is a function R → R³ that maps t to 3D points.
 */
export interface Curve {
  /**
   * Evaluate the curve at parameter t
   *
   * @param t - Parameter value
   * @returns Point in 3D space
   */
  evaluate(t: number): THREE.Vector3;

  /**
   * Get the parameter domain for this curve
   *
   * @returns Domain bounds { tMin, tMax }
   */
  getDomain(): CurveDomain;
}

/**
 * Differential curve with geometry computations
 *
 * Extends basic Curve with differential geometry operations:
 * tangents, curvature, torsion, etc.
 */
export interface DifferentialCurve extends Curve {
  /**
   * Compute unit tangent vector at t
   *
   * T(t) = r'(t) / |r'(t)|
   *
   * @param t - Parameter value
   * @returns Unit tangent vector
   */
  computeTangent(t: number): THREE.Vector3;

  /**
   * Compute curvature at t
   *
   * κ(t) = |r'(t) × r''(t)| / |r'(t)|³
   *
   * Optional - not all curves need this.
   *
   * @param t - Parameter value
   * @returns Curvature value
   */
  computeCurvature?(t: number): number;

  /**
   * Compute normal vector at t
   *
   * N(t) = T'(t) / |T'(t)|
   *
   * Optional - requires second derivatives.
   *
   * @param t - Parameter value
   * @returns Unit normal vector
   */
  computeNormal?(t: number): THREE.Vector3;

  /**
   * Compute binormal vector at t
   *
   * B(t) = T(t) × N(t)
   *
   * Optional - requires tangent and normal.
   *
   * @param t - Parameter value
   * @returns Unit binormal vector
   */
  computeBinormal?(t: number): THREE.Vector3;

  /**
   * Compute torsion at t
   *
   * τ(t) measures how much the curve twists out of the osculating plane.
   *
   * Optional - requires third derivatives.
   *
   * @param t - Parameter value
   * @returns Torsion value
   */
  computeTorsion?(t: number): number;
}

/**
 * Frenet-Serret frame (moving coordinate system along curve)
 *
 * Forms an orthonormal basis at each point:
 * - T: tangent (direction of motion)
 * - N: normal (direction of curvature)
 * - B: binormal (perpendicular to osculating plane)
 */
export interface FrenetFrame {
  T: THREE.Vector3; // Tangent
  N: THREE.Vector3; // Normal
  B: THREE.Vector3; // Binormal
}
