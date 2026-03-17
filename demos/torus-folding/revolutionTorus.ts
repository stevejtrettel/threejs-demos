/**
 * Standard torus of revolution (non-conformal).
 *
 * Profile circle of radius r revolved around the z-axis at distance R.
 * The metric is ds² = (R + r cos v)² du² + r² dv², so E ≠ G
 * except on the circles where cos v = (r−R)/r (if that exists).
 */

import * as THREE from 'three';

// Match the Clifford torus after stereographic projection:
// R = √2 (major radius), r = 1 (tube radius).
const R = Math.SQRT2;
const r = 1;

export function evaluate(u: number, v: number): THREE.Vector3 {
  const bigR = R + r * Math.cos(v);
  return new THREE.Vector3(
    bigR * Math.cos(u),
    bigR * Math.sin(u),
    r * Math.sin(v),
  );
}

export function normal(u: number, v: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(v) * Math.cos(u),
    Math.cos(v) * Math.sin(u),
    Math.sin(v),
  );
}
