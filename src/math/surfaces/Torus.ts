import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type {
  DifferentialSurface,
  SurfaceDomain,
  SurfacePartials,
  FirstFundamentalForm
} from './types';

/**
 * Torus surface
 *
 * A torus is formed by rotating a circle of radius r around an axis
 * at distance R from the circle's center.
 *
 * Parameterization:
 * - x(u,v) = (R + r·cos(v))·cos(u)
 * - y(u,v) = (R + r·cos(v))·sin(u)
 * - z(u,v) = r·sin(v)
 *
 * Where u ∈ [0, 2π] rotates around the major circle,
 * and v ∈ [0, 2π] rotates around the minor circle (tube).
 *
 * @example
 *   const torus = new Torus({ R: 2, r: 1 });
 *   const point = torus.evaluate(0, 0);
 *   const normal = torus.computeNormal(Math.PI, Math.PI);
 */
export class Torus implements DifferentialSurface, Parametric {
  readonly params = new Params(this);

  /**
   * Major radius (distance from origin to tube center)
   * Defined reactively via params.define() in constructor
   */
  declare R: number;

  /**
   * Minor radius (tube thickness)
   * Defined reactively via params.define() in constructor
   */
  declare r: number;

  constructor(options: { R: number; r: number }) {
    this.params.define('R', options.R, { triggers: 'rebuild' });
    this.params.define('r', options.r, { triggers: 'rebuild' });
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    const bigRadius = this.R + this.r * Math.cos(v);
    const x = bigRadius * Math.cos(u);
    const y = bigRadius * Math.sin(u);
    const z = this.r * Math.sin(v);
    return new THREE.Vector3(x, y, z);
  }

  getDomain(): SurfaceDomain {
    return {
      uMin: 0,
      uMax: 2 * Math.PI,
      vMin: 0,
      vMax: 2 * Math.PI
    };
  }

  computePartials(u: number, v: number): SurfacePartials {
    const bigRadius = this.R + this.r * Math.cos(v);

    const du = new THREE.Vector3(
      -bigRadius * Math.sin(u),
      bigRadius * Math.cos(u),
      0
    );

    const dv = new THREE.Vector3(
      -this.r * Math.sin(v) * Math.cos(u),
      -this.r * Math.sin(v) * Math.sin(u),
      this.r * Math.cos(v)
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
}
