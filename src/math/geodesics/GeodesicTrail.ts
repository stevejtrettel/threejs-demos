import * as THREE from 'three';
import { Params, subscribeTo, unsubscribeFrom } from '@/Params';
import type { DifferentialSurface } from '@/math/surfaces/types';
import type { TangentVector } from './types';
import { GeodesicIntegrator } from './GeodesicIntegrator';

/**
 * Options for GeodesicTrail component
 */
export interface GeodesicTrailOptions {
  /**
   * Initial position on surface in parameter coordinates (u, v)
   */
  initialPosition: [number, number];

  /**
   * Initial velocity in tangent space (du/dt, dv/dt)
   */
  initialVelocity: [number, number];

  /**
   * Trail color (default: 0xff0000)
   */
  color?: number;

  /**
   * Line width (default: 1)
   * Note: Only works with WebGLRenderer when using Line2 material
   */
  lineWidth?: number;

  /**
   * Maximum number of points in trail (default: 500)
   * Older points are removed when exceeded
   */
  maxPoints?: number;

  /**
   * Integration step size (default: 0.01)
   * Passed to GeodesicIntegrator
   */
  stepSize?: number;

  /**
   * Fixed number of integration steps (optional)
   * If specified, geodesic will integrate exactly this many steps and stop.
   * When surface parameters change, it will recompute from scratch.
   * If not specified, geodesic continues growing via animate() calls.
   */
  fixedSteps?: number;
}

/**
 * GeodesicTrail component
 *
 * Visualizes a geodesic curve flowing on a differential surface.
 * Extends THREE.Line and animates by integrating the geodesic equation.
 *
 * The trail maintains a history of points, creating a visible path that
 * shows where the geodesic has been. Call animate() in your render loop
 * to integrate forward in time.
 *
 * @example
 *   const torus = new Torus({ R: 2, r: 1 });
 *   const geodesic = new GeodesicTrail(torus, {
 *     initialPosition: [0, 0],
 *     initialVelocity: [1, 0],
 *     color: 0xff0000,
 *     maxPoints: 500
 *   });
 *   scene.add(geodesic);
 *
 *   // In animation loop
 *   function animate(time, delta) {
 *     geodesic.animate(time, delta);
 *     renderer.render(scene, camera);
 *   }
 *
 * @example Reset geodesic
 *   geodesic.reset();  // Starts over from initial position/velocity
 *
 * @example Multiple geodesics from same point
 *   const geodesics = [];
 *   for (let i = 0; i < 8; i++) {
 *     const angle = (i / 8) * Math.PI * 2;
 *     geodesics.push(new GeodesicTrail(torus, {
 *       initialPosition: [0, 0],
 *       initialVelocity: [Math.cos(angle), Math.sin(angle)]
 *     }));
 *   }
 */
export class GeodesicTrail extends THREE.Line {
  readonly params = new Params(this);

  private surface: DifferentialSurface;
  private integrator: GeodesicIntegrator;
  private state: TangentVector;
  private readonly initialState: TangentVector;
  private readonly fixedSteps?: number;

  // Pre-allocated buffer for trail points (avoids per-frame allocation)
  private positionBuffer!: Float32Array;
  private pointCount = 0;
  private headIndex = 0;  // Ring buffer head for maxPoints limit

  /**
   * Trail color
   * Changing this triggers material update
   */
  declare color: number;

  /**
   * Line width (limited support in WebGL)
   * Changing this triggers material update
   */
  declare lineWidth: number;

  /**
   * Maximum number of points to keep in trail
   * Changing this triggers rebuild (trim points if needed)
   */
  declare maxPoints: number;

  constructor(
    surface: DifferentialSurface,
    options: GeodesicTrailOptions
  ) {
    // Call parent constructor
    super();

    // Store surface reference
    this.surface = surface;

    // Store fixed steps mode
    this.fixedSteps = options.fixedSteps;

    // Store initial state
    this.initialState = {
      position: [...options.initialPosition] as [number, number],
      velocity: [...options.initialVelocity] as [number, number]
    };
    this.state = {
      position: [...options.initialPosition] as [number, number],
      velocity: [...options.initialVelocity] as [number, number]
    };

    // Create integrator
    this.integrator = new GeodesicIntegrator(surface, {
      stepSize: options.stepSize ?? 0.01
    });

    // Define parameters
    this.params.define('color', options.color ?? 0xff0000, {
      triggers: 'update'
    });
    this.params.define('lineWidth', options.lineWidth ?? 1, {
      triggers: 'update'
    });
    this.params.define('maxPoints', options.maxPoints ?? 500, {
      triggers: 'rebuild'
    });

    // Subscribe to surface parameter changes for reactive recomputation
    subscribeTo(surface, this);

    // Create material
    this.material = new THREE.LineBasicMaterial();

    // Create geometry with pre-allocated buffer
    this.initializeGeometry(this.maxPoints);

    // Initial update
    this.update();

    // If fixedSteps mode, compute initial geodesic
    if (this.fixedSteps !== undefined) {
      this.recompute();
    }
  }

  /**
   * Initialize geometry with pre-allocated buffer
   */
  private initializeGeometry(maxPoints: number): void {
    // Allocate buffer for maxPoints * 3 floats (x, y, z per point)
    this.positionBuffer = new Float32Array(maxPoints * 3);
    this.pointCount = 0;
    this.headIndex = 0;

    // Create geometry with buffer attribute
    this.geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(this.positionBuffer, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);  // Hint for frequent updates
    this.geometry.setAttribute('position', positionAttr);
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Animate geodesic forward in time
   *
   * Call this in your render loop to integrate the geodesic equation
   * and update the visual trail.
   *
   * @param time - Current time (not used, but standard animation signature)
   * @param delta - Time step since last frame
   */
  animate(time: number, delta: number): void {
    // Skip if in fixedSteps mode (geodesic is pre-computed)
    if (this.fixedSteps !== undefined) {
      return;
    }

    // Integrate one step forward
    this.state = this.integrator.integrate(this.state, delta);

    // Convert parameter coordinates to 3D point on surface
    const point = this.surface.evaluate(
      this.state.position[0],
      this.state.position[1]
    );

    // Add point to pre-allocated buffer (ring buffer behavior when full)
    this.addPoint(point);
  }

  /**
   * Add a point to the trail buffer
   *
   * Uses ring buffer approach when maxPoints is reached - overwrites oldest points.
   */
  private addPoint(point: THREE.Vector3): void {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;

    if (this.pointCount < this.maxPoints) {
      // Buffer not full yet - append at end
      const idx = this.pointCount * 3;
      this.positionBuffer[idx] = point.x;
      this.positionBuffer[idx + 1] = point.y;
      this.positionBuffer[idx + 2] = point.z;
      this.pointCount++;
      this.geometry.setDrawRange(0, this.pointCount);
    } else {
      // Buffer full - overwrite oldest point (ring buffer)
      const idx = this.headIndex * 3;
      this.positionBuffer[idx] = point.x;
      this.positionBuffer[idx + 1] = point.y;
      this.positionBuffer[idx + 2] = point.z;
      this.headIndex = (this.headIndex + 1) % this.maxPoints;
    }

    posAttr.needsUpdate = true;
  }

  /**
   * Reset geodesic to initial state
   *
   * Clears the trail and resets to the initial position and velocity
   * specified in the constructor.
   */
  reset(): void {
    this.state = {
      position: [...this.initialState.position] as [number, number],
      velocity: [...this.initialState.velocity] as [number, number]
    };

    // Clear buffer without reallocating
    this.pointCount = 0;
    this.headIndex = 0;
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Rebuild geometry
   *
   * Called when:
   * - maxPoints changes (reallocates buffer)
   * - Surface parameters change (recomputes geodesic in fixedSteps mode)
   */
  rebuild(): void {
    // If in fixedSteps mode, recompute entire geodesic when surface changes
    if (this.fixedSteps !== undefined) {
      this.recompute();
      return;
    }

    // maxPoints changed - need to reallocate buffer
    // Dispose old geometry and create new one with new size
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.initializeGeometry(this.maxPoints);
  }

  /**
   * Recompute geodesic from initial state
   *
   * Resets to initial position/velocity and integrates forward
   * for the specified number of steps (fixedSteps).
   *
   * This is automatically called when surface parameters change
   * if fixedSteps was specified in constructor.
   */
  recompute(): void {
    // Reset state
    this.state = {
      position: [...this.initialState.position] as [number, number],
      velocity: [...this.initialState.velocity] as [number, number]
    };

    // Clear buffer
    this.pointCount = 0;
    this.headIndex = 0;

    // Ensure buffer is large enough for fixedSteps
    const steps = this.fixedSteps ?? 0;
    if (steps > this.maxPoints) {
      // Reallocate if needed
      if (this.geometry) {
        this.geometry.dispose();
      }
      this.initializeGeometry(steps);
    }

    // Integrate for fixed number of steps
    for (let i = 0; i < steps; i++) {
      // Convert current position to 3D point
      const point = this.surface.evaluate(
        this.state.position[0],
        this.state.position[1]
      );

      // Add to buffer directly (faster than using addPoint for bulk operations)
      const idx = this.pointCount * 3;
      this.positionBuffer[idx] = point.x;
      this.positionBuffer[idx + 1] = point.y;
      this.positionBuffer[idx + 2] = point.z;
      this.pointCount++;

      // Integrate one step
      this.state = this.integrator.integrate(this.state, 1.0);
    }

    // Update geometry
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.pointCount);
  }

  /**
   * Update material properties
   *
   * Called when color or lineWidth changes.
   */
  update(): void {
    const mat = this.material as THREE.LineBasicMaterial;
    mat.color.set(this.color);
    mat.linewidth = this.lineWidth;
    mat.needsUpdate = true;
  }

  /**
   * Dispose resources
   *
   * Call this when removing the geodesic trail from the scene
   * to prevent memory leaks.
   *
   * @example
   *   scene.remove(geodesic);
   *   geodesic.dispose();
   */
  dispose(): void {
    // Dispose geometry
    if (this.geometry) {
      this.geometry.dispose();
    }

    // Dispose material
    if (this.material) {
      (this.material as THREE.Material).dispose();
    }

    // Unsubscribe from surface parameter changes
    unsubscribeFrom(this.surface, this);
  }
}
