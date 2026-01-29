/**
 * Ambient Spaces
 *
 * An ambient space defines the geometry of the space points live in:
 * how to measure distance, interpolate, and project back onto the space.
 *
 * Points are represented as number[] of length `dim`. For hot paths
 * (energy minimization, integration), the same data can be stored in a
 * Float32Array with `dim` floats per point — the space operations work
 * with both representations.
 */

import * as THREE from 'three';

/**
 * A point in the ambient space.
 *
 * Plain number array — readable, easy to work with.
 * Length should equal the space's `dim`.
 */
export type Point = number[];

/**
 * An ambient space that points, curves, surfaces, and meshes can live in.
 *
 * Defines the intrinsic geometry: distance, geodesic interpolation,
 * and projection. Also provides a bridge to Three.js for display.
 */
export interface AmbientSpace {
  /** Dimension of the space (3 for R³, 4 for S³, etc.) */
  readonly dim: number;

  /** Euclidean/intrinsic distance between two points */
  distance(a: Point, b: Point): number;

  /**
   * Geodesic interpolation between two points.
   *
   * t=0 returns a, t=1 returns b.
   * In Euclidean space this is linear interpolation.
   * On S³ this is spherical interpolation (slerp).
   */
  geodesic(a: Point, b: Point, t: number): Point;

  /**
   * Project a point back onto the space (in place).
   *
   * Identity for R^n. Normalization for S³.
   * Used after gradient steps to stay on the manifold.
   */
  project(p: Point): Point;

  /**
   * Convert a point to a THREE.Vector3 for display.
   *
   * For R³ this is the identity (take x, y, z).
   * For S³ this could be stereographic projection.
   */
  toDisplay(p: Point): THREE.Vector3;
}
