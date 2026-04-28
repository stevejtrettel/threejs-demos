/**
 * Rendering glue: `SO(3)` 3×3 matrix → `THREE.Quaternion`.
 *
 * Shepperd's algorithm with the "largest diagonal" branch — numerically
 * stable everywhere on `SO(3)`. THREE's `Quaternion.set` uses the order
 * `(x, y, z, w)`, which differs from the library's quaternion storage
 * `(w, x, y, z)` — this function reorders correctly at the boundary.
 */

import * as THREE from 'three';
import type { Matrix } from '@/math/linear-algebra';

export function so3ToQuaternion(R: Matrix, out?: THREE.Quaternion): THREE.Quaternion {
  const q = out ?? new THREE.Quaternion();
  const d = R.data;
  const m00 = d[0], m01 = d[1], m02 = d[2];
  const m10 = d[3], m11 = d[4], m12 = d[5];
  const m20 = d[6], m21 = d[7], m22 = d[8];

  const trace = m00 + m11 + m22;
  let w: number, x: number, y: number, z: number;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;   // s = 4w
    w = s / 4;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;   // s = 4x
    w = (m21 - m12) / s;
    x = s / 4;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 - m00 + m11 - m22) * 2;   // s = 4y
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = s / 4;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 - m00 - m11 + m22) * 2;   // s = 4z
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = s / 4;
  }

  q.set(x, y, z, w);
  return q;
}
