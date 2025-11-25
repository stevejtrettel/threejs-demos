import * as THREE from 'three';
import { Params } from '@/Params';
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
  private points: THREE.Vector3[] = [];
  private readonly fixedSteps?: number;

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
    if ('params' in surface) {
      (surface as Parametric).params.addDependent(this);
    }

    // Create material and geometry
    this.material = new THREE.LineBasicMaterial();
    this.geometry = new THREE.BufferGeometry();

    // Initial update
    this.update();

    // If fixedSteps mode, compute initial geodesic
    if (this.fixedSteps !== undefined) {
      this.recompute();
    }
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
    // Integrate one step forward
    this.state = this.integrator.integrate(this.state, delta);

    // Convert parameter coordinates to 3D point on surface
    const point = this.surface.evaluate(
      this.state.position[0],
      this.state.position[1]
    );

    // Add to trail
    this.points.push(point.clone());

    // Limit trail length
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    // Update geometry - dispose and recreate to avoid buffer size issues
    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setFromPoints(this.points);
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
    this.points = [];
    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setFromPoints([]);
  }

  /**
   * Rebuild geometry
   *
   * Called when:
   * - maxPoints changes (trims the trail if it's too long)
   * - Surface parameters change (recomputes geodesic in fixedSteps mode)
   */
  rebuild(): void {
    // If in fixedSteps mode, recompute entire geodesic when surface changes
    if (this.fixedSteps !== undefined) {
      this.recompute();
      return;
    }

    // Otherwise, just trim points if maxPoints decreased
    if (this.points.length > this.maxPoints) {
      this.points = this.points.slice(-this.maxPoints);
      this.geometry.dispose();
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setFromPoints(this.points);
    }
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
    this.points = [];

    // Integrate for fixed number of steps
    const steps = this.fixedSteps ?? 0;
    for (let i = 0; i < steps; i++) {
      // Convert current position to 3D point
      const point = this.surface.evaluate(
        this.state.position[0],
        this.state.position[1]
      );
      this.points.push(point.clone());

      // Integrate one step
      this.state = this.integrator.integrate(this.state, 1.0);
    }

    // Update geometry
    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setFromPoints(this.points);
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
    if ('params' in this.surface) {
      (this.surface as Parametric).params.removeDependent(this);
    }
  }
}
