import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { DifferentialSurface, SurfaceDomain, SurfacePartials } from './types';
import { boundsFromSurfaceDomain } from './types';
import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';

/**
 * A flat rectangular patch in the plane `z = height`.
 *
 * Maps `(u, v) ↦ (u, v, height)`, matching `FunctionGraph`'s coordinate
 * convention so a `FlatPatch` is structurally the graph of a constant
 * function.
 */
export class FlatPatch implements DifferentialSurface, Parametric {
  readonly dim = 2;
  readonly params = new Params(this);

  declare height: number;

  private readonly domain: SurfaceDomain;

  // Cached constant metric — identity in the standard (u, v) chart.
  private readonly _metric: Matrix;

  constructor(options: { domain: SurfaceDomain; height?: number }) {
    this.domain = { ...options.domain };

    this._metric = new Matrix(2, 2);
    this._metric.data[0] = 1; this._metric.data[3] = 1;

    this.params.define('height', options.height ?? 0, { triggers: 'rebuild' });
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(u, v, this.height);
  }

  getDomain(): SurfaceDomain {
    return this.domain;
  }

  getDomainBounds(): ManifoldDomain {
    return boundsFromSurfaceDomain(this.domain);
  }

  computeNormal(_u: number, _v: number): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1);
  }

  computePartials(_u: number, _v: number): SurfacePartials {
    return {
      du: new THREE.Vector3(1, 0, 0),
      dv: new THREE.Vector3(0, 1, 0),
    };
  }

  computeMetric(_p: number[]): Matrix {
    return this._metric;
  }
}
