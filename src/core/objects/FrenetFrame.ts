import * as THREE from 'three';
import { Params } from '../../Params';
import type { ParametricFunction } from './ParametricCurve';

export interface FrenetFrameOptions {
  position?: number;  // Parameter value t
  scale?: number;     // Scale of the frame vectors
  colors?: {
    tangent?: number;
    normal?: number;
    binormal?: number;
  };
}

/**
 * Frenet-Serret frame visualization
 *
 * Displays the tangent (T), normal (N), and binormal (B) vectors
 * along a parametric curve, forming an orthonormal moving frame.
 *
 * @example
 *   const helix = (t) => ({
 *     x: Math.cos(t),
 *     y: Math.sin(t),
 *     z: t / 5
 *   });
 *
 *   const frame = new FrenetFrame(helix, { position: 0, scale: 0.5 });
 *   app.add(frame);
 */
export class FrenetFrame {
  mesh: THREE.Group;
  params: Params;

  private fn: ParametricFunction;
  private tangentArrow: THREE.ArrowHelper;
  private normalArrow: THREE.ArrowHelper;
  private binormalArrow: THREE.ArrowHelper;

  position!: number;
  scale!: number;

  constructor(fn: ParametricFunction, options: FrenetFrameOptions = {}) {
    this.fn = fn;
    this.params = new Params(this);

    const colors = {
      tangent: options.colors?.tangent ?? 0xff0000,    // Red
      normal: options.colors?.normal ?? 0x00ff00,      // Green
      binormal: options.colors?.binormal ?? 0x0000ff  // Blue
    };

    // Define parameters
    this.params.define('position', options.position ?? 0, {
      min: -10,
      max: 10,
      step: 0.01,
      label: 'Position (t)',
      onChange: () => this.updateFrame()
    });

    this.params.define('scale', options.scale ?? 0.5, {
      min: 0.1,
      max: 2,
      step: 0.1,
      label: 'Scale',
      onChange: () => this.updateFrame()
    });

    // Create arrows
    this.tangentArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      this.scale,
      colors.tangent
    );

    this.normalArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      this.scale,
      colors.normal
    );

    this.binormalArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      this.scale,
      colors.binormal
    );

    this.mesh = new THREE.Group();
    this.mesh.add(this.tangentArrow);
    this.mesh.add(this.normalArrow);
    this.mesh.add(this.binormalArrow);

    // Initial computation
    this.updateFrame();
  }

  /**
   * Compute the Frenet frame at parameter value t
   */
  private computeFrame(t: number): {
    position: THREE.Vector3;
    tangent: THREE.Vector3;
    normal: THREE.Vector3;
    binormal: THREE.Vector3;
  } {
    const epsilon = 0.001;

    // Position
    const p = this.fn(t);
    const position = new THREE.Vector3(p.x, p.y, p.z);

    // First derivative (velocity)
    const p1 = this.fn(t + epsilon);
    const p2 = this.fn(t - epsilon);
    const velocity = new THREE.Vector3(
      (p1.x - p2.x) / (2 * epsilon),
      (p1.y - p2.y) / (2 * epsilon),
      (p1.z - p2.z) / (2 * epsilon)
    );

    // Tangent (unit velocity)
    const tangent = velocity.clone().normalize();

    // Second derivative (acceleration)
    const p_next = this.fn(t + epsilon);
    const p_curr = this.fn(t);
    const p_prev = this.fn(t - epsilon);

    const v1 = new THREE.Vector3(
      (p_next.x - p_curr.x) / epsilon,
      (p_next.y - p_curr.y) / epsilon,
      (p_next.z - p_curr.z) / epsilon
    );

    const v2 = new THREE.Vector3(
      (p_curr.x - p_prev.x) / epsilon,
      (p_curr.y - p_prev.y) / epsilon,
      (p_curr.z - p_prev.z) / epsilon
    );

    const acceleration = new THREE.Vector3(
      (v1.x - v2.x) / epsilon,
      (v1.y - v2.y) / epsilon,
      (v1.z - v2.z) / epsilon
    );

    // Binormal (T × T')
    const tangentDeriv = new THREE.Vector3(
      (v1.x - v2.x) / epsilon,
      (v1.y - v2.y) / epsilon,
      (v1.z - v2.z) / epsilon
    ).normalize();

    const binormal = new THREE.Vector3();
    binormal.crossVectors(tangent, tangentDeriv);

    if (binormal.length() < 0.001) {
      // Curve is nearly straight, use arbitrary perpendicular
      binormal.set(0, 0, 1);
      if (Math.abs(tangent.dot(binormal)) > 0.9) {
        binormal.set(1, 0, 0);
      }
      binormal.crossVectors(tangent, binormal);
    }

    binormal.normalize();

    // Normal (B × T)
    const normal = new THREE.Vector3();
    normal.crossVectors(binormal, tangent).normalize();

    return { position, tangent, normal, binormal };
  }

  /**
   * Update frame visualization
   */
  private updateFrame(): void {
    const frame = this.computeFrame(this.position);

    // Update tangent arrow (red)
    this.tangentArrow.position.copy(frame.position);
    this.tangentArrow.setDirection(frame.tangent);
    this.tangentArrow.setLength(this.scale, this.scale * 0.2, this.scale * 0.1);

    // Update normal arrow (green)
    this.normalArrow.position.copy(frame.position);
    this.normalArrow.setDirection(frame.normal);
    this.normalArrow.setLength(this.scale, this.scale * 0.2, this.scale * 0.1);

    // Update binormal arrow (blue)
    this.binormalArrow.position.copy(frame.position);
    this.binormalArrow.setDirection(frame.binormal);
    this.binormalArrow.setLength(this.scale, this.scale * 0.2, this.scale * 0.1);
  }

  /**
   * Animate the frame along the curve
   */
  animate(time: number, delta: number): void {
    // Can be used for automatic animation
    // e.g., this.position = (time * 0.001) % (2 * Math.PI);
    // this.updateFrame();
  }

  dispose(): void {
    this.tangentArrow.dispose();
    this.normalArrow.dispose();
    this.binormalArrow.dispose();
  }
}
