import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { DifferentialSurface, SurfaceDomain, SurfacePartials } from './types';
import { boundsFromSurfaceDomain } from './types';
import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';

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
 * metric — is derived numerically by central differences.
 */
export class NumericSurface implements DifferentialSurface, Parametric {
  readonly dim = 2;
  readonly params = new Params(this);

  declare h: number;

  private readonly _evaluate: (u: number, v: number) => THREE.Vector3;
  private readonly _domain: SurfaceDomain;

  constructor(options: NumericSurfaceOptions) {
    this._evaluate = options.evaluate;
    this._domain = { ...options.domain };
    this.params.define('h', options.h ?? 1e-4);
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    return this._evaluate(u, v);
  }

  getDomain(): SurfaceDomain {
    return this._domain;
  }

  getDomainBounds(): ManifoldDomain {
    return boundsFromSurfaceDomain(this._domain);
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
