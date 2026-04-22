import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type {
  DifferentialSurface,
  SurfaceDomain,
  SurfacePartials,
  FirstFundamentalForm,
} from './types';

/**
 * Options for `NumericSurface`
 */
export interface NumericSurfaceOptions {
  /** Parameterization R² → R³ */
  evaluate: (u: number, v: number) => THREE.Vector3;
  /** Domain of (u, v) */
  domain: SurfaceDomain;
  /** Finite-difference step size in parameter space. Default 1e-4. */
  h?: number;
}

/**
 * A `DifferentialSurface` built from just a parameterization.
 *
 * You supply `evaluate(u, v)`; everything else — partials, normal, induced
 * metric — is derived numerically by central differences. Christoffel symbols
 * and Gaussian curvature are handled by the library's intrinsic helpers (which
 * finite-difference `computeMetric`), so no extra work is needed here.
 *
 * Use this for quick sketches and experimentation. For performance-sensitive
 * or precision-sensitive work (e.g. geodesics near a pole), promote the surface
 * to a hand-written `DifferentialSurface` with analytic partials.
 *
 * @example
 *   const sphere = new NumericSurface({
 *     domain: { uMin: 0, uMax: 2*Math.PI, vMin: 0, vMax: Math.PI },
 *     evaluate: (u, v) => new THREE.Vector3(
 *       Math.sin(v) * Math.cos(u),
 *       Math.sin(v) * Math.sin(u),
 *       Math.cos(v),
 *     ),
 *   });
 *   const integrator = new GeodesicIntegrator(sphere);
 */
export class NumericSurface implements DifferentialSurface, Parametric {
  readonly params = new Params(this);

  /** Finite-difference step. */
  declare h: number;

  private readonly _evaluate: (u: number, v: number) => THREE.Vector3;
  private readonly _domain: SurfaceDomain;

  constructor(options: NumericSurfaceOptions) {
    this._evaluate = options.evaluate;
    this._domain = options.domain;
    this.params.define('h', options.h ?? 1e-4);
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    return this._evaluate(u, v);
  }

  getDomain(): SurfaceDomain {
    return this._domain;
  }

  computePartials(u: number, v: number): SurfacePartials {
    const h = this.h;
    const du = this._evaluate(u + h, v)
      .sub(this._evaluate(u - h, v))
      .multiplyScalar(1 / (2 * h));
    const dv = this._evaluate(u, v + h)
      .sub(this._evaluate(u, v - h))
      .multiplyScalar(1 / (2 * h));
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
      G: dv.dot(dv),
    };
  }
}
