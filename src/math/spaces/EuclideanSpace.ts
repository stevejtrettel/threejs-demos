/**
 * Euclidean space R^n
 *
 * The default ambient space. Distance is the standard norm,
 * geodesics are straight lines, projection is the identity.
 */

import * as THREE from 'three';
import type { AmbientSpace, Point } from './types';

export class EuclideanSpace implements AmbientSpace {
  readonly dim: number;

  constructor(dim: number = 3) {
    this.dim = dim;
  }

  distance(a: Point, b: Point): number {
    let sum = 0;
    for (let i = 0; i < this.dim; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  geodesic(a: Point, b: Point, t: number): Point {
    const out: Point = new Array(this.dim);
    const s = 1 - t;
    for (let i = 0; i < this.dim; i++) {
      out[i] = s * a[i] + t * b[i];
    }
    return out;
  }

  project(p: Point): Point {
    return p;
  }

  toDisplay(p: Point): THREE.Vector3 {
    return new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  }
}

/** Standard 3D Euclidean space — the most common case */
export const R3 = new EuclideanSpace(3);
