import * as THREE from 'three';
import type { Surface } from './types';

/**
 * Options for building surface geometry
 */
export interface BuildGeometryOptions {
  /**
   * Minimum u parameter (overrides surface domain)
   */
  uMin?: number;

  /**
   * Maximum u parameter (overrides surface domain)
   */
  uMax?: number;

  /**
   * Minimum v parameter (overrides surface domain)
   */
  vMin?: number;

  /**
   * Maximum v parameter (overrides surface domain)
   */
  vMax?: number;

  /**
   * Number of segments in u direction (default: 32)
   */
  uSegments?: number;

  /**
   * Number of segments in v direction (default: 32)
   */
  vSegments?: number;
}

/**
 * Build THREE.js BufferGeometry from a parametric surface
 *
 * Samples the surface on a regular grid in parameter space and creates
 * a triangulated mesh. Automatically uses analytical normals if the
 * surface provides them.
 *
 * @param surface - The parametric surface to build geometry from
 * @param options - Geometry generation options
 * @returns THREE.js BufferGeometry ready for rendering
 *
 * @example
 *   const torus = new Torus({ R: 2, r: 1 });
 *   const geometry = buildGeometry(torus, {
 *     uSegments: 64,
 *     vSegments: 64
 *   });
 *   const mesh = new THREE.Mesh(geometry, material);
 */
export function buildGeometry(
  surface: Surface,
  options: BuildGeometryOptions = {}
): THREE.BufferGeometry {
  // Extract domain bounds with option overrides
  const domain = surface.getDomain();
  const uMin = options.uMin ?? domain.uMin;
  const uMax = options.uMax ?? domain.uMax;
  const vMin = options.vMin ?? domain.vMin;
  const vMax = options.vMax ?? domain.vMax;
  const uSegments = options.uSegments ?? 32;
  const vSegments = options.vSegments ?? 32;

  // Check if surface has analytical normals
  const hasNormals = 'computeNormal' in surface;

  // Allocate arrays for vertex data
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  // Generate vertices on a regular grid
  for (let i = 0; i <= vSegments; i++) {
    const v = vMin + (vMax - vMin) * (i / vSegments);

    for (let j = 0; j <= uSegments; j++) {
      const u = uMin + (uMax - uMin) * (j / uSegments);

      // Evaluate surface at (u, v)
      const point = surface.evaluate(u, v);
      positions.push(point.x, point.y, point.z);

      // Compute normal if surface supports it
      if (hasNormals) {
        const normal = (surface as any).computeNormal(u, v);
        normals.push(normal.x, normal.y, normal.z);
      }

      // UV texture coordinates (normalized to [0,1])
      uvs.push(j / uSegments, i / vSegments);
    }
  }

  // Generate triangle indices from quad grid
  const indices: number[] = [];

  for (let i = 0; i < vSegments; i++) {
    for (let j = 0; j < uSegments; j++) {
      // Vertices of current quad
      const v0 = i * (uSegments + 1) + j;           // Bottom-left
      const v1 = (i + 1) * (uSegments + 1) + j;     // Top-left
      const v2 = i * (uSegments + 1) + (j + 1);     // Bottom-right
      const v3 = (i + 1) * (uSegments + 1) + (j + 1); // Top-right

      // Two triangles per quad (counter-clockwise winding)
      indices.push(v0, v1, v2);  // Lower-left triangle
      indices.push(v1, v3, v2);  // Upper-right triangle
    }
  }

  // Create BufferGeometry
  const geometry = new THREE.BufferGeometry();

  // Set attributes
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Handle normals
  if (normals.length > 0) {
    // Use analytical normals from surface
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    // Fall back to computed vertex normals
    geometry.computeVertexNormals();
  }

  return geometry;
}
