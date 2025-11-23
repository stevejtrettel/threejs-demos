import * as THREE from 'three';
import { Params } from '../../Params';
import type { MathComponent } from '../../types';
import type { DifferentialSurface } from '../../core/riemannian/types';
import { TangentVector } from '../../core/riemannian/types';
import { integrateGeodesic } from './integrators';

export interface GeodesicOptions {
  surface: DifferentialSurface;
  u0?: number;        // Initial u coordinate
  v0?: number;        // Initial v coordinate
  du0?: number;       // Initial u velocity
  dv0?: number;       // Initial v velocity
  steps?: number;     // Integration steps
  stepSize?: number;  // Integration step size
  maxArcLength?: number;
  color?: number;
  thickness?: number;
  useThickLine?: boolean;  // Use TubeGeometry (true) or Line (false)
}

/**
 * Geodesic curve on a surface
 *
 * Integrates the geodesic equation using RK4
 * Follows component lifecycle pattern (rebuild/update)
 *
 * @example
 *   const geodesic = new Geodesic({
 *     surface: mySurface,
 *     u0: 0.5, v0: 0.5,
 *     du0: 1, dv0: 0.5,
 *     steps: 500
 *   });
 */
export class Geodesic implements MathComponent {
  mesh: THREE.Line | THREE.Mesh;
  params: Params;

  private surface: DifferentialSurface;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.LineBasicMaterial | THREE.Material;
  private useThickLine: boolean;

  u0!: number;
  v0!: number;
  du0!: number;
  dv0!: number;
  steps!: number;
  stepSize!: number;
  maxArcLength!: number;
  colorHex!: number;
  thickness!: number;

  constructor(options: GeodesicOptions) {
    if (!options.surface) {
      throw new Error('Geodesic requires a surface object with position() and christoffel() methods');
    }
    if (typeof options.surface.position !== 'function') {
      throw new Error('Surface must have a position(u, v) method');
    }
    if (typeof options.surface.christoffel !== 'function') {
      throw new Error('Surface must have a christoffel(u, v) method');
    }

    this.surface = options.surface;
    this.useThickLine = options.useThickLine ?? false;
    this.params = new Params(this);

    // INTEGRATION PARAMETERS → rebuild
    this.params.define('u0', options.u0 ?? 0, {
      min: -10, max: 10, step: 0.01,
      label: 'Initial U',
      triggers: 'rebuild'
    });

    this.params.define('v0', options.v0 ?? 0, {
      min: -10, max: 10, step: 0.01,
      label: 'Initial V',
      triggers: 'rebuild'
    });

    this.params.define('du0', options.du0 ?? 1, {
      min: -5, max: 5, step: 0.01,
      label: 'Initial dU/dt',
      triggers: 'rebuild'
    });

    this.params.define('dv0', options.dv0 ?? 0, {
      min: -5, max: 5, step: 0.01,
      label: 'Initial dV/dt',
      triggers: 'rebuild'
    });

    this.params.define('steps', options.steps ?? 500, {
      min: 10, max: 2000, step: 10,
      label: 'Integration Steps',
      triggers: 'rebuild'
    });

    this.params.define('stepSize', options.stepSize ?? 0.01, {
      min: 0.001, max: 0.1, step: 0.001,
      label: 'Step Size',
      triggers: 'rebuild'
    });

    this.params.define('maxArcLength', options.maxArcLength ?? Infinity, {
      min: 0.1, max: 100, step: 0.1,
      label: 'Max Arc Length',
      triggers: 'rebuild'
    });

    // VISUAL PARAMETERS → update
    this.params.define('colorHex', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      triggers: 'update'
    });

    this.params.define('thickness', options.thickness ?? 0.02, {
      min: 0.001, max: 0.2, step: 0.001,
      label: 'Thickness',
      triggers: this.useThickLine ? 'rebuild' : 'update'
    });

    // Build initial geodesic
    this.geometry = this.buildGeometry();
    this.material = this.buildMaterial();
    this.mesh = this.buildMesh();
  }

  private buildGeometry(): THREE.BufferGeometry {
    // Initial conditions
    const initialTV = new TangentVector(
      new THREE.Vector2(this.u0, this.v0),
      new THREE.Vector2(this.du0, this.dv0)
    );

    // Integrate geodesic with optional domain checking
    const isOutsideDomain = 'isOutsideDomain' in this.surface
      ? (u: number, v: number) => (this.surface as any).isOutsideDomain(u, v)
      : undefined;

    const rawPoints = integrateGeodesic(this.surface, initialTV, {
      steps: this.steps,
      stepSize: this.stepSize,
      maxArcLength: this.maxArcLength,
      isOutsideDomain
    });

    // Filter out undefined/invalid points
    const points = rawPoints.filter(p => {
      return p !== undefined &&
             p !== null &&
             !isNaN(p.x) &&
             !isNaN(p.y) &&
             !isNaN(p.z) &&
             isFinite(p.x) &&
             isFinite(p.y) &&
             isFinite(p.z);
    });

    // Need at least 2 points for a curve
    if (points.length < 2) {
      throw new Error(
        `Geodesic integration failed: produced only ${points.length} valid point(s), need at least 2. ` +
        `Check initial conditions (u0=${this.u0}, v0=${this.v0}, du0=${this.du0}, dv0=${this.dv0}) ` +
        `and ensure the surface is well-defined in this region.`
      );
    }

    if (this.useThickLine) {
      // Use TubeGeometry for thick line
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      return new THREE.TubeGeometry(curve, points.length * 2, this.thickness, 8, false);
    } else {
      // Use BufferGeometry for thin line
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(points.length * 3);

      for (let i = 0; i < points.length; i++) {
        positions[i * 3] = points[i].x;
        positions[i * 3 + 1] = points[i].y;
        positions[i * 3 + 2] = points[i].z;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return geometry;
    }
  }

  private buildMaterial(): THREE.LineBasicMaterial | THREE.Material {
    if (this.useThickLine) {
      return new THREE.MeshStandardMaterial({
        color: this.colorHex,
        side: THREE.DoubleSide
      });
    } else {
      return new THREE.LineBasicMaterial({
        color: this.colorHex,
        linewidth: this.thickness * 100  // Note: linewidth only works in some renderers
      });
    }
  }

  private buildMesh(): THREE.Line | THREE.Mesh {
    if (this.useThickLine) {
      return new THREE.Mesh(this.geometry, this.material as THREE.Material);
    } else {
      return new THREE.Line(this.geometry, this.material as THREE.LineBasicMaterial);
    }
  }

  // ===== Component Lifecycle =====

  /**
   * Rebuild geodesic when integration parameters change
   * ALWAYS swaps geometry (never creates new mesh)
   * This preserves App's reference to the mesh
   */
  rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.geometry;

    // Always swap geometry, never create new mesh
    this.mesh.geometry = newGeometry;
    this.geometry = newGeometry;

    // Update material if using thick lines (tube geometry needs material update)
    if (this.useThickLine) {
      const oldMaterial = this.material;
      this.material = this.buildMaterial();
      this.mesh.material = this.material;

      // Dispose old material
      if (Array.isArray(oldMaterial)) {
        oldMaterial.forEach(m => m.dispose());
      } else {
        oldMaterial.dispose();
      }
    }

    // Dispose old geometry
    oldGeometry.dispose();
  }

  /**
   * Update visual properties (color, linewidth)
   */
  update(): void {
    if (this.useThickLine) {
      const mat = this.material as THREE.MeshStandardMaterial;
      mat.color.setHex(this.colorHex);
      mat.needsUpdate = true;
    } else {
      const mat = this.material as THREE.LineBasicMaterial;
      mat.color.setHex(this.colorHex);
      mat.linewidth = this.thickness * 100;
      mat.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    if (Array.isArray(this.material)) {
      this.material.forEach(m => m.dispose());
    } else {
      this.material.dispose();
    }
  }
}
