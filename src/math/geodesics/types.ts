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

/**
 * Christoffel symbols for a surface
 *
 * These encode how the coordinate system changes as you move around the surface.
 * Used in the geodesic equation to compute acceleration.
 *
 * Γᵏᵢⱼ represents how ∂ₖ changes when moving in the ∂ᵢ and ∂ⱼ directions.
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
