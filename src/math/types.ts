/**
 * Core type system for mathematical visualization objects
 *
 * This defines the interfaces that all math objects should implement.
 * Objects can compose these interfaces based on their capabilities.
 */

import * as THREE from 'three';
import { Params } from '@/Params';

/**
 * SceneObject - Can be added to a THREE.js scene
 *
 * All visual objects must provide an Object3D that can be added to the scene.
 * This could be a Mesh, Group, Line, Points, InstancedMesh, etc.
 */
export interface SceneObject {
  /** The THREE.js object that can be added to the scene */
  readonly object3D: THREE.Object3D;

  /** Clean up resources (geometry, materials, textures, etc.) */
  dispose(): void;
}

/**
 * Parametric - Has configurable parameters
 *
 * Objects with parameters that can be adjusted by the user.
 */
export interface Parametric {
  /** The parameters object that controls this object */
  readonly params: Params;
}

/**
 * Rebuildable - Can rebuild geometry from scratch
 *
 * Called when parameters change that require regenerating the entire geometry.
 * This is a "heavy" operation (creates new buffers, reallocates memory).
 */
export interface Rebuildable {
  /** Rebuild the entire geometry from scratch */
  rebuild(): void;
}

/**
 * Updatable - Can update appearance without rebuilding
 *
 * Called when parameters change that only affect appearance (colors, materials, etc.)
 * This is a "light" operation (modifies existing data).
 */
export interface Updatable {
  /** Update colors, materials, or other lightweight properties */
  update(): void;
}

/**
 * Animatable - Changes over time
 *
 * Objects that animate should implement this interface.
 * They receive both absolute time and delta time each frame.
 */
export interface Animatable {
  /**
   * Update animation state
   * @param time - Absolute time in seconds since start
   * @param delta - Time elapsed since last frame in seconds
   */
  animate(time: number, delta: number): void;

  /** Reset animation to initial state */
  reset(): void;
}

/**
 * MathObject - Standard mathematical visualization component
 *
 * This is the standard interface for most math objects:
 * - Can be added to the scene (SceneObject)
 * - Has configurable parameters (Parametric)
 * - Can rebuild when parameters change (Rebuildable)
 * - Can update appearance (Updatable)
 *
 * Examples: ParametricCurve, ParametricSurface, VectorField
 */
export interface MathObject extends
  SceneObject,
  Parametric,
  Rebuildable,
  Updatable
{}

/**
 * AnimatedMathObject - Mathematical object with animation
 *
 * Like MathObject but also animated.
 *
 * Examples: Geodesic, ParticleSystem, FlowLine
 */
export interface AnimatedMathObject extends
  MathObject,
  Animatable
{}

/**
 * DifferentialSurface - Surface with differential geometry
 *
 * Surfaces that can compute differential geometry quantities.
 * This is the foundation for geodesics, parallel transport, etc.
 */
export interface DifferentialSurface extends Parametric {
  /** Evaluate position at (u,v) */
  evaluate(u: number, v: number): THREE.Vector3;

  /** Compute unit normal vector at (u,v) */
  computeNormal(u: number, v: number): THREE.Vector3;

  /** Compute partial derivatives at (u,v) */
  computePartials(u: number, v: number): {
    du: THREE.Vector3;
    dv: THREE.Vector3;
  };

  /** Compute first fundamental form (metric tensor) at (u,v) */
  computeMetric(u: number, v: number): {
    E: number;  // <du, du>
    F: number;  // <du, dv>
    G: number;  // <dv, dv>
  };
}

/**
 * DifferentialCurve - Curve with differential geometry
 *
 * Curves that can compute differential geometry quantities.
 */
export interface DifferentialCurve extends Parametric {
  /** Evaluate position at parameter t */
  evaluate(t: number): THREE.Vector3;

  /** Compute tangent vector at t */
  computeTangent(t: number): THREE.Vector3;

  /** Compute normal vector at t (for planar curves) */
  computeNormal?(t: number): THREE.Vector3;

  /** Compute binormal vector at t (for space curves) */
  computeBinormal?(t: number): THREE.Vector3;

  /** Compute curvature at t */
  computeCurvature?(t: number): number;
}
