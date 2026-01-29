/**
 * buildTubeGeometry.ts
 *
 * Converts a curve into a tube geometry for rendering.
 * Uses Frenet frames to create stable tube cross-sections.
 */

import * as THREE from 'three';

export interface BuildTubeGeometryOptions {
  radius?: number;
  tubularSegments?: number;
  radialSegments?: number;
  closed?: boolean;
}

/**
 * Build a tube geometry from a THREE.Curve
 *
 * Uses the curve's built-in computeFrenetFrames() method to create
 * stable tube cross-sections with proper orientation.
 *
 * @param curve - Any THREE.Curve (NumericalCurve, ParametricCurve, etc.)
 * @param options - Tube parameters
 * @returns BufferGeometry ready to render
 *
 * @example
 * const geometry = buildTubeGeometry(curve, { radius: 0.1 });
 * const mesh = new THREE.Mesh(geometry, material);
 */
export function buildTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  options: BuildTubeGeometryOptions = {}
): THREE.BufferGeometry {

  const radius = options.radius ?? 0.1;
  const tubularSegments = options.tubularSegments ?? 128;
  const radialSegments = options.radialSegments ?? 8;
  const closed = options.closed ?? false;

  const geometry = new THREE.BufferGeometry();

  // Use curve's built-in Frenet frame computation
  const frames = curve.computeFrenetFrames(tubularSegments, closed);

  // Build tube vertices
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  // Generate vertices for each segment
  for (let i = 0; i <= tubularSegments; i++) {
    // Sample curve at this point
    const P = curve.getPoint(i / tubularSegments);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    // Create radial ring of vertices
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(v);
      const sin = Math.sin(v);

      // Normal points radially outward
      normal.x = cos * N.x + sin * B.x;
      normal.y = cos * N.y + sin * B.y;
      normal.z = cos * N.z + sin * B.z;
      normal.normalize();

      // Vertex is offset from curve by radius
      vertex.copy(P).addScaledVector(normal, radius);

      vertices.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(i / tubularSegments, j / radialSegments);
    }
  }

  // Generate indices (two triangles per quad)
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = (radialSegments + 1) * i + j;
      const b = (radialSegments + 1) * (i + 1) + j;
      const c = (radialSegments + 1) * (i + 1) + (j + 1);
      const d = (radialSegments + 1) * i + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return geometry;
}
