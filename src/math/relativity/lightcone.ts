/**
 * Light-cone surface geometry from a fan of null rays.
 *
 * `sampleLightCone` (in `nullGeodesic.ts`) returns a ring of null geodesics as
 * a rectangular grid of plotted points: `rays[i].points[j]` is the j-th step of
 * the i-th ray. The union of those rays is the light cone of the emission
 * event. This module sweeps that grid into a closed `THREE.BufferGeometry` (the
 * angular direction wraps), ready for any material.
 *
 * Kept separate from the sampler so the math layer stays THREE-free: sampling
 * is pure, meshing lives here.
 */

import * as THREE from 'three';
import type { NullRay } from './nullGeodesic';

export interface LightConeGeometryOptions {
  /** Wrap the angular seam (first ray ≡ last). Default true. */
  closed?: boolean;
}

/**
 * Build a swept surface mesh-geometry from sampled null rays.
 *
 * The grid is `rays.length` angular samples by `steps + 1` radial samples. With
 * `closed`, an extra quad strip joins the last ray back to the first so the
 * cone has no seam.
 */
export function lightConeGeometry(
  rays: NullRay[],
  options: LightConeGeometryOptions = {},
): THREE.BufferGeometry {
  const { closed = true } = options;
  const nAng = rays.length;
  const nRad = rays[0].points.length;
  const ringCount = closed ? nAng + 1 : nAng;

  const positions = new Float32Array(ringCount * nRad * 3);
  const uvs = new Float32Array(ringCount * nRad * 2);

  for (let i = 0; i < ringCount; i++) {
    const ray = rays[i % nAng];
    const u = i / (ringCount - 1);
    for (let j = 0; j < nRad; j++) {
      const p = ray.points[j];
      const vi = (i * nRad + j) * 3;
      positions[vi] = p[0];
      positions[vi + 1] = p[1];
      positions[vi + 2] = p[2];
      const ui = (i * nRad + j) * 2;
      uvs[ui] = u;
      uvs[ui + 1] = j / (nRad - 1);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < nRad - 1; j++) {
      const a = i * nRad + j;
      const b = i * nRad + j + 1;
      const c = (i + 1) * nRad + j + 1;
      const d = (i + 1) * nRad + j;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
