/**
 * Domain types for parametric objects
 *
 * Domains define the valid parameter space for curves, surfaces, and volumes.
 * They support various topologies (periodic, bounded, arbitrary) and dimensions.
 */

import * as THREE from 'three';

/**
 * Boundary behavior for a domain dimension
 */
export type BoundaryType = 'open' | 'closed' | 'periodic';

/**
 * Base domain interface
 *
 * All domains must provide:
 * - Dimension
 * - Containment testing
 * - Uniform sampling
 * - Boundary information
 */
export interface Domain {
  /** Number of dimensions (1 for curves, 2 for surfaces, 3 for volumes) */
  readonly dim: number;

  /**
   * Check if a point is inside the domain
   *
   * @param coords - Coordinate array [u] or [u, v] or [u, v, w]
   * @returns true if point is in domain
   */
  contains(...coords: number[]): boolean;

  /**
   * Clamp coordinates to domain (for bounded domains)
   *
   * @param coords - Input coordinates
   * @returns Clamped coordinates
   */
  clamp(...coords: number[]): number[];

  /**
   * Wrap coordinates for periodic domains
   *
   * @param coords - Input coordinates
   * @returns Wrapped coordinates
   */
  wrap(...coords: number[]): number[];

  /**
   * Get boundary type for each dimension
   */
  getBoundaryTypes(): BoundaryType[];

  /**
   * Get approximate bounding box (for non-rectangular domains)
   * Returns [min1, max1, min2, max2, ...]
   */
  getBounds(): number[];

  /**
   * Sample uniformly within domain
   *
   * @param resolution - Resolution per dimension (e.g., [64, 64] for 2D)
   * @returns Array of sample points
   */
  sample(resolution: number[]): number[][];
}

/**
 * 1D domain for curves
 */
export interface Domain1D extends Domain {
  readonly dim: 1;
  tMin: number;
  tMax: number;
  periodic?: boolean;

  contains(t: number): boolean;
  clamp(t: number): number;
  wrap(t: number): number;
  sample(resolution: number): number[];
}

/**
 * 2D domain for surfaces
 */
export interface Domain2D extends Domain {
  readonly dim: 2;

  contains(u: number, v: number): boolean;
  clamp(u: number, v: number): [number, number];
  wrap(u: number, v: number): [number, number];
  sample(resolution: [number, number]): Array<[number, number]>;

  /**
   * Get boundary curves (useful for visualization)
   * Returns arrays of [u, v] points for each boundary component
   */
  getBoundaries?(): Array<Array<[number, number]>>;
}

/**
 * 3D domain for volumes
 */
export interface Domain3D extends Domain {
  readonly dim: 3;

  contains(u: number, v: number, w: number): boolean;
  clamp(u: number, v: number, w: number): [number, number, number];
  wrap(u: number, v: number, w: number): [number, number, number];
  sample(resolution: [number, number, number]): Array<[number, number, number]>;
}

/**
 * Implicit domain defined by a predicate function
 *
 * Useful for arbitrary shapes: disks, annuli, etc.
 */
export interface ImplicitDomain2D extends Domain2D {
  /** Predicate function defining the domain */
  predicate: (u: number, v: number) => boolean;
  /** Distance to domain boundary (optional, for advanced features) */
  signedDistance?: (u: number, v: number) => number;
}
