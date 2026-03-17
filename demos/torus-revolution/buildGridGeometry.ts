/**
 * Builds a grid BufferGeometry with position, normal, uv, and indices.
 * Positions and normals are initialized to zero — the caller updates
 * them each frame via updateGeometry().
 */

import * as THREE from 'three';

export function buildGridGeometry(
  uSeg: number,
  vSeg: number,
): THREE.BufferGeometry {
  const count = (uSeg + 1) * (vSeg + 1);

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  let idx = 0;
  for (let i = 0; i <= vSeg; i++) {
    const vt = i / vSeg;
    for (let j = 0; j <= uSeg; j++) {
      const ut = j / uSeg;
      uvs[idx * 2] = ut;
      uvs[idx * 2 + 1] = vt;
      idx++;
    }
  }

  // Two triangles per quad
  const indices: number[] = [];
  for (let i = 0; i < vSeg; i++) {
    for (let j = 0; j < uSeg; j++) {
      const a = i * (uSeg + 1) + j;
      const b = (i + 1) * (uSeg + 1) + j;
      const c = i * (uSeg + 1) + (j + 1);
      const d = (i + 1) * (uSeg + 1) + (j + 1);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}
