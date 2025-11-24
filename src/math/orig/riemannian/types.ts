/**
 * Differential geometry types and interfaces
 */

import * as THREE from 'three';

/**
 * Tangent vector at a point in parameter space
 * Represents position (u,v) and velocity (du/dt, dv/dt)
 */
export class TangentVector {
  constructor(
    public pos: THREE.Vector2,  // (u, v) position in parameter space
    public vel: THREE.Vector2   // (du/dt, dv/dt) velocity
  ) {}

  clone(): TangentVector {
    return new TangentVector(this.pos.clone(), this.vel.clone());
  }
}

/**
 * First fundamental form: g_ij = <∂_i, ∂_j>
 * Encodes intrinsic geometry (distances, angles)
 */
export interface FirstFundamentalForm {
  E: number;  // g_11 = <∂u, ∂u>
  F: number;  // g_12 = <∂u, ∂v>
  G: number;  // g_22 = <∂v, ∂v>
}

/**
 * Second fundamental form: h_ij = <∂_ij, N>
 * Encodes extrinsic geometry (curvature)
 */
export interface SecondFundamentalForm {
  L: number;  // h_11 = <∂uu, N>
  M: number;  // h_12 = <∂uv, N>
  N: number;  // h_22 = <∂vv, N>
}

/**
 * Christoffel symbols of the second kind: Γ^k_ij
 * Describe how tangent vectors change along the surface
 */
export type ChristoffelSymbols = {
  [k in 'u' | 'v']: {
    [i in 'u' | 'v']: {
      [j in 'u' | 'v']: number;
    };
  };
};

/**
 * Interface for surfaces with differential geometry structure
 *
 * Provides everything needed for:
 * - Computing geodesics
 * - Parallel transport
 * - Curvature calculations
 */
export interface DifferentialSurface {
  /**
   * Parameterization: (u,v) → (x,y,z)
   */
  parameterization(u: number, v: number): THREE.Vector3;

  /**
   * Surface normal at (u,v)
   */
  surfaceNormal(u: number, v: number): THREE.Vector3;

  /**
   * First fundamental form at (u,v)
   * Computed from partial derivatives
   */
  firstFundamentalForm(u: number, v: number): FirstFundamentalForm;

  /**
   * Christoffel symbols at (u,v)
   * Used for geodesic equations
   */
  christoffelSymbols(u: number, v: number): ChristoffelSymbols;

  /**
   * Optional: Second fundamental form
   */
  secondFundamentalForm?(u: number, v: number): SecondFundamentalForm;
}
