import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type {
  DifferentialSurface,
  SurfaceDomain,
  SurfacePartials,
  FirstFundamentalForm
} from './types';
import type { DifferentiableScalarField2D } from '@/math/functions/types';

/**
 * FunctionGraph surface
 *
 * Creates a surface from a scalar field f: R² → R via the graph embedding:
 *   (u, v) ↦ (u, v, f(u, v))
 *
 * This is the standard way to visualize a function of two variables as a surface.
 *
 * The surface automatically subscribes to the function's parameters (if it's Parametric)
 * and rebuilds when they change.
 *
 * @example
 *   const ripple = new RippleFunction({ amplitude: 1, frequency: 2 });
 *   const surface = new FunctionGraph(ripple);
 *
 *   // Surface updates automatically when ripple parameters change
 *   ripple.params.set('amplitude', 2);
 *
 * @example With scaling
 *   const surface = new FunctionGraph(ripple, { scale: 2 });
 *   // Now graph is (2u, 2v, 2*f(u,v))
 */
export class FunctionGraph implements DifferentialSurface, Parametric {
  readonly params = new Params(this);

  private field: DifferentiableScalarField2D;

  /**
   * Horizontal scale factor (multiplies u and v coordinates)
   */
  declare xyScale: number;

  /**
   * Vertical scale factor (multiplies z = f(u,v))
   */
  declare zScale: number;

  constructor(
    field: DifferentiableScalarField2D,
    options: { xyScale?: number; zScale?: number } = {}
  ) {
    this.field = field;

    this.params.define('xyScale', options.xyScale ?? 1, { triggers: 'rebuild' });
    this.params.define('zScale', options.zScale ?? 1, { triggers: 'rebuild' });

    // Subscribe to field parameter changes
    if ('params' in field) {
      (field as Parametric).params.addDependent(this);
    }
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    const z = this.field.evaluate(u, v);
    return new THREE.Vector3(u * this.xyScale, v * this.xyScale, z * this.zScale);
  }

  getDomain(): SurfaceDomain {
    const domain = this.field.getDomain();
    return {
      uMin: domain.uMin,
      uMax: domain.uMax,
      vMin: domain.vMin,
      vMax: domain.vMax
    };
  }

  computePartials(u: number, v: number): SurfacePartials {
    const partials = this.field.computePartials(u, v);

    // For (u, v, f(u,v)):
    // ∂/∂u = (1, 0, ∂f/∂u) scaled by (xyScale, xyScale, zScale)
    // ∂/∂v = (0, 1, ∂f/∂v) scaled by (xyScale, xyScale, zScale)

    const du = new THREE.Vector3(
      this.xyScale,
      0,
      partials.du * this.zScale
    );

    const dv = new THREE.Vector3(
      0,
      this.xyScale,
      partials.dv * this.zScale
    );

    return { du, dv };
  }

  computeNormal(u: number, v: number): THREE.Vector3 {
    const { du, dv } = this.computePartials(u, v);
    return du.cross(dv).normalize();
  }

  computeMetric(u: number, v: number): FirstFundamentalForm {
    const { du, dv } = this.computePartials(u, v);
    return {
      E: du.dot(du),
      F: du.dot(dv),
      G: dv.dot(dv)
    };
  }

  /**
   * Rebuild notification handler
   *
   * Called when the underlying scalar field's parameters change.
   * Propagates the rebuild notification to all dependents (SurfaceMesh, GeodesicTrails).
   *
   * This is a "pass-through" - FunctionGraph itself has no geometry to rebuild,
   * but it needs to notify downstream components that the surface has changed.
   */
  rebuild(): void {
    // Notify all dependents that the surface has changed
    for (const dependent of this.params.getDependents()) {
      if (typeof dependent.rebuild === 'function') {
        dependent.rebuild();
      }
    }
  }
}
