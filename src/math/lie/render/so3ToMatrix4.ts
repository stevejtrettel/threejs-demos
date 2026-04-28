/**
 * Rendering glue: `SO(3)` matrix → `THREE.Matrix4`.
 *
 * The math library's canonical rotation storage is a 3×3 `Matrix`. THREE's
 * scene graph expects a 4×4 `Matrix4` with column-major storage. This
 * utility writes the 3×3 rotation block into the upper-left of a
 * `Matrix4`, with the translation column zeroed and `[3][3] = 1`.
 *
 * THREE's `Matrix4.elements` is column-major:
 *   elements[i + 4*j] = entry at row i, column j.
 *
 * Our `Matrix.data` is row-major:
 *   data[i*3 + j] = entry at row i, column j.
 */

import * as THREE from 'three';
import type { Matrix } from '@/math/linear-algebra';

/**
 * Write `R` (3×3) into `out` (defaulted to a new `Matrix4`), returning `out`.
 * Reuses `out` in place when provided, so per-frame updates can avoid
 * reallocation.
 */
export function so3ToMatrix4(R: Matrix, out?: THREE.Matrix4): THREE.Matrix4 {
  const m = out ?? new THREE.Matrix4();
  const e = m.elements;
  // Column 0
  e[0] = R.data[0]; e[1] = R.data[3]; e[2]  = R.data[6]; e[3]  = 0;
  // Column 1
  e[4] = R.data[1]; e[5] = R.data[4]; e[6]  = R.data[7]; e[7]  = 0;
  // Column 2
  e[8] = R.data[2]; e[9] = R.data[5]; e[10] = R.data[8]; e[11] = 0;
  // Column 3 (translation / homogeneous)
  e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
  return m;
}
