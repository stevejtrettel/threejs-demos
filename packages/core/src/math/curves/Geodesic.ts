import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import type { MathComponent } from '../../types';
import type { DifferentialSurface } from '../diffgeo/types';
import { TangentVector } from '../diffgeo/types';
import { integrateGeodesic } from '../diffgeo/integrators';

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
  params: ComponentParams;

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
    this.surface = options.surface;
    this.useThickLine = options.useThickLine ?? false;
    this.params = new ComponentParams(this);

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

    // Integrate geodesic
    const points = integrateGeodesic(this.surface, initialTV, {
      steps: this.steps,
      stepSize: this.stepSize,
      maxArcLength: this.maxArcLength
    });

    if (this.useThickLine && points.length >= 2) {
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
   * Uses safe swap pattern: build → swap → dispose
   */
  rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.geometry;
    const oldMesh = this.mesh;

    // Update thickness-dependent material/mesh if needed
    if (this.useThickLine) {
      this.material = this.buildMaterial();
      this.mesh = new THREE.Mesh(newGeometry, this.material as THREE.Material);
    } else {
      this.mesh.geometry = newGeometry;
    }

    this.geometry = newGeometry;

    // Copy transform from old mesh
    if (oldMesh.parent) {
      this.mesh.position.copy(oldMesh.position);
      this.mesh.rotation.copy(oldMesh.rotation);
      this.mesh.scale.copy(oldMesh.scale);

      // Replace in scene
      const parent = oldMesh.parent;
      parent.remove(oldMesh);
      parent.add(this.mesh);
    }

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
