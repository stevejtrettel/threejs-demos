/**
 * Shared utilities for the Hopf fibration.
 *
 * These functions handle the chain:
 *   S² (spherical coords) → S³ (toroidal coords) → R³ (stereographic projection)
 */

import * as THREE from 'three';

/** Cartesian point on S² → {theta, phi} */
export function toSpherical(p: THREE.Vector3): { theta: number; phi: number } {
  const phi = Math.acos(Math.max(-1, Math.min(1, p.z)));
  const theta = Math.atan2(p.y, p.x);
  return { theta, phi };
}

/** {theta, phi} → Cartesian point on S² */
export function fromSphericalCoords(angles: { theta: number; phi: number }): THREE.Vector3 {
  const { theta, phi } = angles;
  return new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(phi),
  );
}

/** Hopf fiber coordinates on S³ */
export function toroidalCoords(a: number, b: number, c: number): THREE.Vector4 {
  const x = Math.cos(a) * Math.sin(c);
  const y = Math.sin(a) * Math.sin(c);
  const z = Math.cos(b) * Math.cos(c);
  const w = Math.sin(b) * Math.cos(c);
  // Rotate: (x, y, z, w) → (x, z, -y, w)
  return new THREE.Vector4(x, z, -y, w);
}

/** Stereographic projection S³ → R³ */
export function stereoProj(pt: THREE.Vector4): THREE.Vector3 {
  const denom = 1 - pt.z;
  if (Math.abs(denom) < 1e-10) {
    const scale = Math.sign(denom || 1) * 1e10;
    return new THREE.Vector3(pt.y * scale, -pt.x * scale, pt.w * scale);
  }
  return new THREE.Vector3(pt.y, -pt.x, pt.w).divideScalar(denom);
}
