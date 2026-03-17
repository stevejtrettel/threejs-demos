/**
 * Fundamental domain geometry for 2D lattices.
 *
 * Standalone functions that take a Lattice2D and produce THREE.js geometry
 * for visualization: slabs, boundary curves, gridlines, tilings, lattice points.
 *
 * The lattice is embedded in 3D in the xz-plane:
 *   ω = (re, im) ∈ ℂ  →  (re, 0, im) ∈ ℝ³
 */

import * as THREE from 'three';
import type { Complex } from '../algebra/complex';
import { Lattice2D } from './Lattice2D';
import { ParametricCurve } from '../curves/ParametricCurve';

// ── Helpers ─────────────────────────────────────────────

/** Embed a complex number into the xz-plane. */
export function toWorld(z: Complex): THREE.Vector3 {
  return new THREE.Vector3(z[0], 0, z[1]);
}

function basisVectors(lattice: Lattice2D): [THREE.Vector3, THREE.Vector3] {
  return [toWorld(lattice.omega1), toWorld(lattice.omega2)];
}

// ── Domain point ────────────────────────────────────────

/**
 * Map normalized coordinates (u, v) ∈ [0,1]² to a world position
 * inside the fundamental parallelogram.
 */
export function domainPoint(
  lattice: Lattice2D,
  u: number,
  v: number,
): THREE.Vector3 {
  const [v1, v2] = basisVectors(lattice);
  return v1.clone().multiplyScalar(u).addScaledVector(v2, v);
}

// ── Slab geometry ───────────────────────────────────────

/**
 * Build a parallelepiped (thin slab) for the fundamental domain.
 *
 * 8 vertices (4 corners × top/bottom), 12 triangles (6 faces).
 * The slab sits centered on y = 0 with the given thickness.
 */
export function latticeSlab(
  lattice: Lattice2D,
  thickness: number = 0.025,
): THREE.BufferGeometry {
  const [v1, v2] = basisVectors(lattice);
  const hy = thickness / 2;

  // 4 corners of parallelogram: O, v1, v1+v2, v2
  const c0 = new THREE.Vector3(0, 0, 0);
  const c1 = v1.clone();
  const c2 = v1.clone().add(v2);
  const c3 = v2.clone();

  // 8 vertices: bottom (y = -hy), top (y = +hy)
  const positions = new Float32Array([
    // bottom face (0-3)
    c0.x, -hy, c0.z,
    c1.x, -hy, c1.z,
    c2.x, -hy, c2.z,
    c3.x, -hy, c3.z,
    // top face (4-7)
    c0.x, hy, c0.z,
    c1.x, hy, c1.z,
    c2.x, hy, c2.z,
    c3.x, hy, c3.z,
  ]);

  // 6 faces × 2 triangles × 3 indices
  // Bottom: 0,2,1  0,3,2  (facing -y)
  // Top:    4,5,6  4,6,7  (facing +y)
  // Front:  0,1,5  0,5,4  (v1 direction)
  // Back:   2,3,7  2,7,6  (opposite v1)
  // Right:  1,2,6  1,6,5  (v2 direction)
  // Left:   3,0,4  3,4,7  (opposite v2)
  const indices = [
    0, 2, 1, 0, 3, 2, // bottom
    4, 5, 6, 4, 6, 7, // top
    0, 1, 5, 0, 5, 4, // front
    2, 3, 7, 2, 7, 6, // back
    1, 2, 6, 1, 6, 5, // right
    3, 0, 4, 3, 4, 7, // left
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ── Boundary ────────────────────────────────────────────

/**
 * Return 4 line-segment curves for the parallelogram boundary.
 *
 * Each is a ParametricCurve with domain [0, 1].
 * Order: bottom (along v1), right (along v2), top (along -v1), left (along -v2).
 */
export function latticeBoundary(lattice: Lattice2D): ParametricCurve[] {
  const [v1, v2] = basisVectors(lattice);

  const bottom = new ParametricCurve({
    parameterization: (t) => v1.clone().multiplyScalar(t),
  });
  const right = new ParametricCurve({
    parameterization: (t) => v1.clone().addScaledVector(v2, t),
  });
  const top = new ParametricCurve({
    parameterization: (t) => v2.clone().addScaledVector(v1, 1 - t),
  });
  const left = new ParametricCurve({
    parameterization: (t) => v2.clone().multiplyScalar(1 - t),
  });

  return [bottom, right, top, left];
}

// ── Gridlines ───────────────────────────────────────────

/**
 * Return gridlines subdividing the fundamental domain into n × n cells.
 *
 * Returns 2*(n+1) curves: (n+1) lines along v1 and (n+1) lines along v2.
 */
export function latticeGridlines(
  lattice: Lattice2D,
  n: number,
): ParametricCurve[] {
  const [v1, v2] = basisVectors(lattice);
  const curves: ParametricCurve[] = [];

  // Lines along v1 direction (at v2 fractions)
  for (let i = 0; i <= n; i++) {
    const frac = i / n;
    const offset = v2.clone().multiplyScalar(frac);
    curves.push(new ParametricCurve({
      parameterization: (t) => offset.clone().addScaledVector(v1, t),
    }));
  }

  // Lines along v2 direction (at v1 fractions)
  for (let i = 0; i <= n; i++) {
    const frac = i / n;
    const offset = v1.clone().multiplyScalar(frac);
    curves.push(new ParametricCurve({
      parameterization: (t) => offset.clone().addScaledVector(v2, t),
    }));
  }

  return curves;
}

// ── Tiling ──────────────────────────────────────────────

/**
 * Return (2n+1)² slab geometries tiling around the origin.
 *
 * Each slab is offset by m·v1 + k·v2 for m, k ∈ [-n, n].
 */
export function latticeTiling(
  lattice: Lattice2D,
  n: number,
  thickness: number = 0.025,
): THREE.BufferGeometry[] {
  const [v1, v2] = basisVectors(lattice);
  const base = latticeSlab(lattice, thickness);
  const geometries: THREE.BufferGeometry[] = [];

  for (let m = -n; m <= n; m++) {
    for (let k = -n; k <= n; k++) {
      const offset = v1.clone().multiplyScalar(m).addScaledVector(v2, k);
      const geom = base.clone();
      geom.translate(offset.x, offset.y, offset.z);
      geometries.push(geom);
    }
  }

  return geometries;
}

// ── Lattice points ──────────────────────────────────────

/**
 * Return all lattice points m·v1 + k·v2 for m, k ∈ [-n, n].
 */
export function latticePoints(
  lattice: Lattice2D,
  n: number,
): THREE.Vector3[] {
  const [v1, v2] = basisVectors(lattice);
  const points: THREE.Vector3[] = [];

  for (let m = -n; m <= n; m++) {
    for (let k = -n; k <= n; k++) {
      points.push(v1.clone().multiplyScalar(m).addScaledVector(v2, k));
    }
  }

  return points;
}
