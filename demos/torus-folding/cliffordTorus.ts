/**
 * Clifford torus: conformal embedding of the flat torus in ℝ³.
 *
 * The torus lives on S³ as (cos u, sin u, cos v, sin v) / √2,
 * then stereographic projection from the north pole (0,0,0,1)
 * maps it into ℝ³.  The induced metric is conformally flat,
 * so a square grid on the (u,v) domain stays square on the surface.
 */

import * as THREE from 'three';

const S = 1 / Math.SQRT2;

export function evaluate(u: number, v: number): THREE.Vector3 {
  const x1 = S * Math.cos(u);
  const x2 = S * Math.sin(u);
  const x3 = S * Math.cos(v);
  const x4 = S * Math.sin(v);
  const d = 1 / (1 - x4);
  return new THREE.Vector3(x1 * d, x2 * d, x3 * d);
}

const H = 1e-4;
const _du = new THREE.Vector3();
const _dv = new THREE.Vector3();

export function normal(u: number, v: number): THREE.Vector3 {
  _du.copy(evaluate(u + H, v)).sub(evaluate(u - H, v)).multiplyScalar(0.5 / H);
  _dv.copy(evaluate(u, v + H)).sub(evaluate(u, v - H)).multiplyScalar(0.5 / H);
  return new THREE.Vector3().crossVectors(_du, _dv).normalize();
}
