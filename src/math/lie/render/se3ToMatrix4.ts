/**
 * Rendering glue: `SE(3)` 4×4 homogeneous matrix → `THREE.Matrix4`.
 *
 * The library's `Matrix` is row-major (`data[i*4 + j]` = row `i`, col `j`);
 * THREE's `Matrix4.elements` is column-major (`elements[i + 4*j]` = row
 * `i`, col `j`). This transposes in place.
 */

import * as THREE from 'three';
import type { Matrix } from '@/math/linear-algebra';

export function se3ToMatrix4(g: Matrix, out?: THREE.Matrix4): THREE.Matrix4 {
  const m = out ?? new THREE.Matrix4();
  const e = m.elements;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      e[row + 4 * col] = g.data[row * 4 + col];
    }
  }
  return m;
}
