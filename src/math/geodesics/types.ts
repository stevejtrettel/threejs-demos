/**
 * Geodesic types and interfaces
 *
 * Geodesics are the "straightest possible" curves on a surface,
 * generalizing the concept of straight lines to curved spaces.
 */

/**
 * A tangent vector on a surface
 *
 * Represents a point on the surface plus a velocity vector in the tangent plane.
 * Used to describe the state of a geodesic.
 */
export interface TangentVector {
  /**
   * Position on surface in parameter coordinates (u, v)
   */
  position: [number, number];

  /**
   * Velocity in tangent space (du/dt, dv/dt)
   */
  velocity: [number, number];
}

// Christoffel symbols are now returned as `Float64Array` (flat layout
// `Γ[k*n*n + i*n + j]`) by `Manifold.computeChristoffel`. No re-export
// needed here — consumers import from `@/math/manifolds`.

/**
 * Result of a geodesic integration step
 */
export interface GeodesicState {
  /**
   * Current tangent vector (position + velocity)
   */
  state: TangentVector;

  /**
   * Whether the geodesic is still valid
   * (false if it left the surface domain)
   */
  valid: boolean;

  /**
   * Optional: arc length traveled
   */
  arcLength?: number;
}

/**
 * Which boundary edge was hit
 */
export type BoundaryEdge = 'uMin' | 'uMax' | 'vMin' | 'vMax';

/**
 * Result of bounded geodesic integration
 *
 * Indicates whether the geodesic is still within the domain
 * and provides the exact boundary intersection if it exited.
 */
export interface BoundedIntegrationResult {
  /**
   * New state after integration
   */
  state: TangentVector;

  /**
   * Whether the geodesic hit a domain boundary
   */
  hitBoundary: boolean;

  /**
   * Which boundary edge was hit (if any)
   */
  boundaryEdge?: BoundaryEdge;

  /**
   * Fraction of step completed before hitting boundary (0-1)
   * Only set if hitBoundary is true
   */
  stepFraction?: number;
}
