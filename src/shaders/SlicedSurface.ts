/**
 * SlicedSurface — convenience factory for creating a sliced surface with
 * a glass overlay, correctly wired with render ordering.
 *
 * Returns two meshes: a shader-colored surface and a transparent glass ghost.
 * The colored surface renders on top of the glass to stay crisp.
 *
 * @example
 *   const shader = createSurfaceShader({ sliceField: '1.0 - uv.x', color: '...' });
 *   const { mesh, glass } = createSlicedSurface(boys, shader, { uSegments: 64 });
 *   scene.add(mesh);
 *   scene.add(glass);
 *
 *   // Animate
 *   shader.uniforms.uSlice.value = t;
 *   mesh.rotation.y = glass.rotation.y = t;
 */

import * as THREE from 'three';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';
import type { Surface } from '@/math/surfaces/types';
import type { SurfaceShaderResult } from './SurfaceShader';

export interface SlicedSurfaceOptions {
  /** Segments in u direction. Default: 64 */
  uSegments?: number;
  /** Segments in v direction. Default: 128 */
  vSegments?: number;

  // Colored surface material
  /** Roughness for the colored surface. Default: 0.4 */
  roughness?: number;
  /** Metalness for the colored surface. Default: 0.1 */
  metalness?: number;

  // Glass material
  /** Glass transmission (0 = opaque, 1 = fully transparent). Default: 0.95 */
  glassTransmission?: number;
  /** Glass color. Default: 0xc9eaff */
  glassColor?: number;
}

export interface SlicedSurfaceResult {
  /** The shader-colored surface mesh. */
  mesh: SurfaceMesh;
  /** The transparent glass overlay. */
  glass: SurfaceMesh;
  /** Add both meshes to a scene or group. */
  addTo(parent: THREE.Object3D): void;
  /** Dispose both meshes. */
  dispose(): void;
}

export function createSlicedSurface(
  surface: Surface,
  shader: SurfaceShaderResult,
  options: SlicedSurfaceOptions = {},
): SlicedSurfaceResult {
  const {
    uSegments = 64,
    vSegments = 128,
    roughness = 0.4,
    metalness = 0.1,
    glassTransmission = 0.95,
    glassColor = 0xc9eaff,
  } = options;

  // Colored surface
  const mesh = new SurfaceMesh(surface, {
    ...shader,
    uSegments,
    vSegments,
    roughness,
    metalness,
  });

  // Glass overlay
  const glass = new SurfaceMesh(surface, {
    uSegments,
    vSegments,
    transmission: glassTransmission,
    roughness: 0,
    metalness: 0,
    color: glassColor,
  });

  // Render ordering: glass first (pushed back), colored surface on top
  glass.renderOrder = 0;
  (glass.material as THREE.Material).polygonOffset = true;
  (glass.material as THREE.Material).polygonOffsetFactor = 1;
  (glass.material as THREE.Material).polygonOffsetUnits = 1;
  mesh.renderOrder = 1;

  return {
    mesh,
    glass,
    addTo(parent: THREE.Object3D) {
      parent.add(mesh);
      parent.add(glass);
    },
    dispose() {
      mesh.dispose();
      glass.dispose();
    },
  };
}
