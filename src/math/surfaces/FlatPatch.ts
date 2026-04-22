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
 * A flat rectangular patch in the plane `z = height`.
 *
 * Maps `(u, v) ↦ (u, v, height)`, matching `FunctionGraph`'s coordinate
 * convention so a `FlatPatch` is structurally the graph of a constant
 * function. Useful for:
 *
 *   - dual-view demos: draw the same `VectorField` on a graph surface
 *     *and* on a flat rectangle below it
 *   - phase portraits where the domain is R² and no curvature is wanted
 *   - reference planes / ambient grids
 *
 * Fully satisfies `DifferentialSurface`, so `FieldArrows` and `CurveLine`
 * work on it out of the box. The induced metric is Euclidean, which means
 * geodesics here are literally straight lines and pushforward is the identity.
 */
export class FlatPatch implements DifferentialSurface, Parametric {
  readonly params = new Params(this);

  declare height: number;

  private readonly domain: SurfaceDomain;

  constructor(options: { domain: SurfaceDomain; height?: number }) {
    this.domain = { ...options.domain };

    this.params.define('height', options.height ?? 0, { triggers: 'rebuild' });
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(u, v, this.height);
  }

  getDomain(): SurfaceDomain {
    return this.domain;
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

  computeMetric(_u: number, _v: number): FirstFundamentalForm {
    return { E: 1, F: 0, G: 1 };
  }
}
