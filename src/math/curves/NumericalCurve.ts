/**
 * NumericalCurve.ts
 *
 * A curve defined by an array of points with smooth interpolation.
 * Perfect for visualizing geodesics, integral curves, or any
 * numerically-computed path.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable } from '@/types';
import type { Curve, CurveDomain, DifferentialCurve } from './types';

export interface NumericalCurveOptions {
  points: THREE.Vector3[];
  closed?: boolean;
  curveType?: 'centripetal' | 'chordal' | 'catmullrom';
  tension?: number;
}

/**
 * A curve defined by interpolating through a list of points
 *
 * Extends THREE.CatmullRomCurve3 to get smooth interpolation and
 * all the built-in curve utilities (arc-length, Frenet frames, etc.)
 *
 * @example
 * // Create from Vector3 array
 * const points = [
 *   new Vector3(0, 0, 0),
 *   new Vector3(1, 1, 1),
 *   new Vector3(2, 0, 2)
 * ];
 * const curve = new NumericalCurve({ points });
 *
 * // Use THREE.Curve methods
 * curve.getPointAt(0.5);      // Arc-length parameterization!
 * curve.getLength();          // Total arc length
 * curve.getTangent(0.5);      // Tangent vector
 * curve.computeFrenetFrames(64); // Frenet frames
 *
 * // Update the curve (rebuilds automatically)
 * const newPoints = computeGeodesic();
 * curve.updatePoints(newPoints);
 */
export class NumericalCurve extends THREE.CatmullRomCurve3 implements Curve, DifferentialCurve, Parametric, Rebuildable {

  readonly params = new Params(this);

  // Note: points, closed, curveType, tension inherited from CatmullRomCurve3
  // We redeclare them here for Params reactivity
  declare points: THREE.Vector3[];
  declare closed: boolean;
  declare curveType: 'centripetal' | 'chordal' | 'catmullrom';
  declare tension: number;

  constructor(options: NumericalCurveOptions) {
    // Initialize parent with points
    super(
      options.points,
      options.closed ?? false,
      options.curveType ?? 'centripetal',
      options.tension ?? 0.5
    );

    // Make properties reactive via Params
    // These will update the parent's properties and trigger rebuild
    this.params
      .define('points', options.points, { triggers: 'rebuild' })
      .define('closed', options.closed ?? false, { triggers: 'rebuild' })
      .define('curveType', options.curveType ?? 'centripetal', { triggers: 'rebuild' })
      .define('tension', options.tension ?? 0.5, { triggers: 'rebuild' });
  }

  rebuild(): void {
    // Update parent's arc-length cache when points change
    this.updateArcLengths();
  }

  /**
   * Evaluate the curve at parameter t ∈ [0, 1]
   *
   * Alias for THREE.Curve's getPoint() to match our Curve interface
   */
  evaluate(t: number): THREE.Vector3 {
    return this.getPoint(t);
  }

  /**
   * Get parameter domain [0, 1]
   */
  getDomain(): CurveDomain {
    return { tMin: 0, tMax: 1 };
  }

  /**
   * Compute tangent vector at t
   *
   * Alias for THREE.Curve's getTangent()
   */
  computeTangent(t: number): THREE.Vector3 {
    return this.getTangent(t);
  }

  /**
   * Update the curve with new points
   *
   * This is the main method you'll use to redraw the curve.
   * Just pass in new points and the curve rebuilds automatically.
   */
  updatePoints(points: THREE.Vector3[]): void {
    this.params.set('points', points);
  }

  dispose(): void {
    this.params.dispose();
  }
}
