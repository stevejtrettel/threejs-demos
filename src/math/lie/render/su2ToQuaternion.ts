/**
 * Rendering glue: `SU(2)` element → `THREE.Quaternion`.
 *
 * Direct — the library stores `SU(2)` elements as unit quaternions
 * `(w, x, y, z)` in `Matrix(2, 2).data[0..3]`; this function reorders
 * to THREE's `(x, y, z, w)` convention.
 */

import * as THREE from 'three';
import type { Matrix } from '@/math/linear-algebra';

export function su2ToQuaternion(q: Matrix, out?: THREE.Quaternion): THREE.Quaternion {
  const result = out ?? new THREE.Quaternion();
  result.set(q.data[1], q.data[2], q.data[3], q.data[0]);
  return result;
}
