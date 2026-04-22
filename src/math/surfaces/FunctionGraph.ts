import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { DifferentialSurface, SurfaceDomain, SurfacePartials } from './types';
import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';
import type { DifferentiableScalarField } from '@/math/functions/types';

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
  readonly dim = 2;
  readonly params = new Params(this);

  private field: DifferentiableScalarField;
  private readonly pBuf: number[] = [0, 0];

  /**
   * Horizontal scale factor (multiplies u and v coordinates)
   */
  declare xyScale: number;

  /**
   * Vertical scale factor (multiplies z = f(u,v))
   */
  declare zScale: number;

  constructor(
    field: DifferentiableScalarField,
    options: { xyScale?: number; zScale?: number } = {}
  ) {
    if (field.dim !== 2) {
      throw new Error(`FunctionGraph: expected a 2D scalar field, got dim=${field.dim}`);
    }
    this.field = field;

    this.params
      .define('xyScale', options.xyScale ?? 1, { triggers: 'rebuild' })
      .define('zScale', options.zScale ?? 1, { triggers: 'rebuild' })
      .dependOn(field);
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    this.pBuf[0] = u; this.pBuf[1] = v;
    const z = this.field.evaluate(this.pBuf);
    return new THREE.Vector3(u * this.xyScale, v * this.xyScale, z * this.zScale);
  }

  getDomain(): SurfaceDomain {
    const b = this.field.getDomain();
    return {
      uMin: b.min[0], uMax: b.max[0],
      vMin: b.min[1], vMax: b.max[1],
    };
  }

  getDomainBounds(): ManifoldDomain {
    return this.field.getDomain();
  }

  computePartials(u: number, v: number): SurfacePartials {
    this.pBuf[0] = u; this.pBuf[1] = v;
    const partials = this.field.computePartials(this.pBuf);
    const df_du = partials[0];
    const df_dv = partials[1];

    // For (u, v, f(u,v)):
    //   ∂/∂u = (xyScale, 0, zScale · ∂f/∂u)
    //   ∂/∂v = (0, xyScale, zScale · ∂f/∂v)
    return {
      du: new THREE.Vector3(this.xyScale, 0, df_du * this.zScale),
      dv: new THREE.Vector3(0, this.xyScale, df_dv * this.zScale),
    };
  }

  computeNormal(u: number, v: number): THREE.Vector3 {
    const { du, dv } = this.computePartials(u, v);
    return du.cross(dv).normalize();
  }

  computeMetric(p: number[]): Matrix {
    const { du, dv } = this.computePartials(p[0], p[1]);
    const E = du.dot(du);
    const F = du.dot(dv);
    const G = dv.dot(dv);
    const m = new Matrix(2, 2);
    m.data[0] = E; m.data[1] = F;
    m.data[2] = F; m.data[3] = G;
    return m;
  }
}
