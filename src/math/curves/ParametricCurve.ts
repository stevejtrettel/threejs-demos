/**
 * ParametricCurve.ts
 *
 * A curve defined by an analytical parameterization function.
 * Perfect for helices, Lissajous curves, knots, and other
 * mathematically-defined curves.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable } from '@/types';
import type { Curve, CurveDomain, DifferentialCurve } from './types';

export type Parameterization = (t: number) => THREE.Vector3;

export interface ParametricCurveOptions {
  parameterization: Parameterization;
  domain?: { tMin: number; tMax: number };
}

/**
 * A curve defined by a parameterization function r(t) = (x(t), y(t), z(t))
 *
 * Extends THREE.Curve to get all the built-in utilities:
 * arc-length parameterization, Frenet frames, tangent computation, etc.
 *
 * @example
 * // Helix
 * const helix = new ParametricCurve({
 *   parameterization: (t) => new Vector3(
 *     Math.cos(t),
 *     Math.sin(t),
 *     t / (2 * Math.PI)
 *   ),
 *   domain: { tMin: 0, tMax: 4 * Math.PI }
 * });
 *
 * // Use THREE.Curve methods
 * helix.getPointAt(0.5);      // Arc-length parameterization!
 * helix.getLength();          // Total arc length
 * helix.computeFrenetFrames(64); // Frenet frames
 *
 * @example
 * // Trefoil knot
 * const trefoil = new ParametricCurve({
 *   parameterization: (t) => new Vector3(
 *     Math.sin(t) + 2 * Math.sin(2 * t),
 *     Math.cos(t) - 2 * Math.cos(2 * t),
 *     -Math.sin(3 * t)
 *   ),
 *   domain: { tMin: 0, tMax: 2 * Math.PI }
 * });
 */
export class ParametricCurve extends THREE.Curve<THREE.Vector3> implements Curve, DifferentialCurve, Parametric, Rebuildable {

  readonly params = new Params(this);

  declare parameterization: Parameterization;
  declare tMin: number;
  declare tMax: number;

  constructor(options: ParametricCurveOptions) {
    super();

    const domain = options.domain ?? { tMin: 0, tMax: 1 };

    this.params
      .define('parameterization', options.parameterization, { triggers: 'rebuild' })
      .define('tMin', domain.tMin, { triggers: 'rebuild' })
      .define('tMax', domain.tMax, { triggers: 'rebuild' });

    this.rebuild();
  }

  rebuild(): void {
    // Update arc-length cache when parameterization changes
    this.updateArcLengths();
  }

  /**
   * Required by THREE.Curve - evaluate at parameter t ∈ [0, 1]
   */
  getPoint(t: number, optionalTarget?: THREE.Vector3): THREE.Vector3 {
    const s = this.tMin + (this.tMax - this.tMin) * t;
    const point = this.parameterization(s);

    if (optionalTarget) {
      return optionalTarget.copy(point);
    }
    return point;
  }

  /**
   * Evaluate the curve at parameter t ∈ [0, 1]
   *
   * Alias for getPoint() to match our Curve interface
   */
  evaluate(t: number): THREE.Vector3 {
    return this.getPoint(t);
  }

  /**
   * Get parameter domain [0, 1] (normalized)
   */
  getDomain(): CurveDomain {
    return { tMin: 0, tMax: 1 };
  }

  /**
   * Compute tangent vector at t
   *
   * Uses THREE.Curve's built-in finite difference implementation
   */
  computeTangent(t: number): THREE.Vector3 {
    return this.getTangent(t);
  }

  /**
   * Compute curvature at t
   *
   * κ(t) = |r'(t) × r''(t)| / |r'(t)|³
   */
  computeCurvature(t: number): number {
    const h = 0.0001;

    // First derivative (velocity)
    const p0 = this.getPoint(t - h);
    const p1 = this.getPoint(t);
    const p2 = this.getPoint(t + h);

    const v = p2.clone().sub(p0).multiplyScalar(0.5 / h);
    const vLen = v.length();

    if (vLen < 1e-10) return 0;

    // Second derivative (acceleration)
    const a = p2.clone().sub(p1.clone().multiplyScalar(2)).add(p0).divideScalar(h * h);

    // Curvature: |v × a| / |v|³
    const cross = new THREE.Vector3().crossVectors(v, a);
    return cross.length() / (vLen * vLen * vLen);
  }

  /**
   * Update the parameterization function
   */
  updateParameterization(fn: Parameterization): void {
    this.params.set('parameterization', fn);
  }

  dispose(): void {
    this.params.dispose();
  }
}
