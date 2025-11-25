import * as THREE from 'three';
import { Params } from '@/Params';
import type { Surface, DifferentialSurface, SurfaceDomain, SurfacePartials, FirstFundamentalForm } from './types';
import { buildGeometry } from './buildGeometry';

/**
 * Options for SurfaceMesh.fromFunction() static factory
 */
export interface FromFunctionOptions extends SurfaceMeshOptions {
  /**
   * Domain bounds [xMin, xMax, yMin, yMax]
   * Default: [-2, 2, -2, 2]
   */
  domain?: [number, number, number, number];
}

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

    // Define parameters and dependencies
    this.params
      .define('uSegments', options.uSegments ?? 32, { triggers: 'rebuild' })
      .define('vSegments', options.vSegments ?? 32, { triggers: 'rebuild' })
      .define('color', options.color ?? 0x4488ff, { triggers: 'update' })
      .define('roughness', options.roughness ?? 0.3, { triggers: 'update' })
      .define('metalness', options.metalness ?? 0.1, { triggers: 'update' })
      .define('transmission', options.transmission ?? 0, { triggers: 'update' })
      .define('wireframe', options.wireframe ?? false, { triggers: 'update' })
      .dependOn(surface);

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

    // Clean up subscriptions
    this.params.dispose();
  }

  // =========================================================================
  // Static Factory Methods
  // =========================================================================

  /**
   * Create a SurfaceMesh directly from a z = f(x, y) function
   *
   * This is a convenience factory for quickly visualizing functions without
   * needing to create separate scalar field and FunctionGraph objects.
   *
   * Internally creates a DifferentialSurface that:
   * - Evaluates to (x, y, f(x, y))
   * - Computes normals analytically using numerical derivatives
   * - Computes the metric tensor for geodesic support
   *
   * @param fn - Function (x, y) => z height
   * @param options - Surface mesh options plus domain bounds
   * @returns SurfaceMesh ready to add to scene
   *
   * @example Simple usage
   *   const mesh = SurfaceMesh.fromFunction(
   *     (x, y) => Math.sin(x) * Math.cos(y)
   *   );
   *   scene.add(mesh);
   *
   * @example With options
   *   const mesh = SurfaceMesh.fromFunction(
   *     (x, y) => x*x - y*y,  // Saddle surface
   *     {
   *       domain: [-3, 3, -3, 3],
   *       uSegments: 64,
   *       color: 0xff4444
   *     }
   *   );
   *
   * @example Ripple function
   *   const mesh = SurfaceMesh.fromFunction(
   *     (x, y) => Math.sin(Math.sqrt(x*x + y*y) * 3) * 0.5,
   *     { domain: [-4, 4, -4, 4], uSegments: 80, vSegments: 80 }
   *   );
   */
  static fromFunction(
    fn: (x: number, y: number) => number,
    options: FromFunctionOptions = {}
  ): SurfaceMesh {
    const { domain = [-2, 2, -2, 2], ...meshOptions } = options;
    const [xMin, xMax, yMin, yMax] = domain;

    // Create an inline DifferentialSurface from the function
    const surface: DifferentialSurface = {
      evaluate(u: number, v: number): THREE.Vector3 {
        return new THREE.Vector3(u, v, fn(u, v));
      },

      getDomain(): SurfaceDomain {
        return { uMin: xMin, uMax: xMax, vMin: yMin, vMax: yMax };
      },

      computePartials(u: number, v: number): SurfacePartials {
        // Numerical derivatives for the surface partials
        const h = 0.0001;
        const fu = (fn(u + h, v) - fn(u - h, v)) / (2 * h);
        const fv = (fn(u, v + h) - fn(u, v - h)) / (2 * h);

        // For graph (u, v, f(u,v)):
        // ∂/∂u = (1, 0, ∂f/∂u)
        // ∂/∂v = (0, 1, ∂f/∂v)
        return {
          du: new THREE.Vector3(1, 0, fu),
          dv: new THREE.Vector3(0, 1, fv)
        };
      },

      computeNormal(u: number, v: number): THREE.Vector3 {
        const { du, dv } = this.computePartials(u, v);
        return du.cross(dv).normalize();
      },

      computeMetric(u: number, v: number): FirstFundamentalForm {
        const { du, dv } = this.computePartials(u, v);
        return {
          E: du.dot(du),
          F: du.dot(dv),
          G: dv.dot(dv)
        };
      }
    };

    return new SurfaceMesh(surface, meshOptions);
  }
}
