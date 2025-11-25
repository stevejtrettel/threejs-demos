import * as THREE from 'three';
import { Params, subscribeTo, unsubscribeFrom } from '@/Params';
import type { Surface } from './types';
import { buildGeometry } from './buildGeometry';

/**
 * Options for SurfaceMesh component
 */
export interface SurfaceMeshOptions {
  /**
   * Number of segments in u direction (default: 32)
   */
  uSegments?: number;

  /**
   * Number of segments in v direction (default: 32)
   */
  vSegments?: number;

  /**
   * Surface color (default: 0x4488ff)
   */
  color?: number;

  /**
   * Surface roughness, 0-1 (default: 0.3)
   */
  roughness?: number;

  /**
   * Surface metalness, 0-1 (default: 0.1)
   */
  metalness?: number;

  /**
   * Surface transmission for glass effect, 0-1 (default: 0)
   */
  transmission?: number;

  /**
   * Render as wireframe (default: false)
   */
  wireframe?: boolean;
}

/**
 * SurfaceMesh component
 *
 * A complete scene object that wraps a parametric surface with reactive
 * parameters and automatic geometry/material management.
 *
 * Extends THREE.Mesh so it can be used anywhere a mesh is expected.
 * Automatically rebuilds when surface parameters or geometry settings change.
 * Updates material properties without rebuilding geometry when visual params change.
 *
 * @example
 *   const torus = new Torus({ R: 2, r: 1 });
 *   const mesh = new SurfaceMesh(torus, {
 *     color: 0x4488ff,
 *     uSegments: 64
 *   });
 *   scene.add(mesh);
 *
 *   // Reactive updates
 *   torus.params.set('R', 3);        // Triggers rebuild
 *   mesh.params.set('color', 0xff0000); // Triggers update
 *
 * @example Glass effect
 *   const mesh = new SurfaceMesh(torus, {
 *     transmission: 0.9,
 *     roughness: 0.05,
 *     metalness: 0
 *   });
 */
export class SurfaceMesh extends THREE.Mesh {
  readonly params = new Params(this);

  private surface: Surface;

  /**
   * Number of segments in u direction
   * Changing this triggers geometry rebuild
   */
  declare uSegments: number;

  /**
   * Number of segments in v direction
   * Changing this triggers geometry rebuild
   */
  declare vSegments: number;

  /**
   * Surface color
   * Changing this triggers material update
   */
  declare color: number;

  /**
   * Surface roughness (0 = smooth, 1 = rough)
   * Changing this triggers material update
   */
  declare roughness: number;

  /**
   * Surface metalness (0 = dielectric, 1 = metal)
   * Changing this triggers material update
   */
  declare metalness: number;

  /**
   * Surface transmission (0 = opaque, 1 = transparent)
   * Changing this triggers material update
   */
  declare transmission: number;

  /**
   * Render as wireframe
   * Changing this triggers material update
   */
  declare wireframe: boolean;

  constructor(surface: Surface, options: SurfaceMeshOptions = {}) {
    // Call parent constructor
    super();

    // Store surface reference
    this.surface = surface;

    // Define geometry parameters (trigger rebuild)
    this.params.define('uSegments', options.uSegments ?? 32, {
      triggers: 'rebuild'
    });
    this.params.define('vSegments', options.vSegments ?? 32, {
      triggers: 'rebuild'
    });

    // Define material parameters (trigger update)
    this.params.define('color', options.color ?? 0x4488ff, {
      triggers: 'update'
    });
    this.params.define('roughness', options.roughness ?? 0.3, {
      triggers: 'update'
    });
    this.params.define('metalness', options.metalness ?? 0.1, {
      triggers: 'update'
    });
    this.params.define('transmission', options.transmission ?? 0, {
      triggers: 'update'
    });
    this.params.define('wireframe', options.wireframe ?? false, {
      triggers: 'update'
    });

    // Subscribe to surface parameter changes
    subscribeTo(surface, this);

    // Create initial material
    this.material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide
    });

    // Initial build
    this.rebuild();
    this.update();
  }

  /**
   * Rebuild geometry from surface
   *
   * Called when:
   * - Component is first created
   * - Segment counts change (uSegments, vSegments)
   * - Surface parameters change (e.g., Torus radius)
   *
   * This is EXPENSIVE - allocates new BufferGeometry.
   */
  rebuild(): void {
    // Dispose old geometry if it exists
    if (this.geometry) {
      this.geometry.dispose();
    }

    // Build new geometry from surface
    this.geometry = buildGeometry(this.surface, {
      uSegments: this.uSegments,
      vSegments: this.vSegments
    });
  }

  /**
   * Update material properties
   *
   * Called when:
   * - Component is first created
   * - Visual parameters change (color, roughness, etc.)
   *
   * This is CHEAP - just updates material properties.
   */
  update(): void {
    const mat = this.material as THREE.MeshPhysicalMaterial;

    mat.color.set(this.color);
    mat.roughness = this.roughness;
    mat.metalness = this.metalness;
    mat.transmission = this.transmission;
    mat.wireframe = this.wireframe;

    mat.needsUpdate = true;
  }

  /**
   * Dispose resources
   *
   * Call this when removing the mesh from the scene permanently
   * to prevent memory leaks.
   *
   * @example
   *   scene.remove(mesh);
   *   mesh.dispose();
   */
  dispose(): void {
    // Dispose geometry
    if (this.geometry) {
      this.geometry.dispose();
    }

    // Dispose material
    if (this.material) {
      (this.material as THREE.Material).dispose();
    }

    // Unsubscribe from surface parameter changes
    unsubscribeFrom(this.surface, this);
  }
}
