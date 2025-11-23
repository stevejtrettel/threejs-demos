import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import type { MathComponent } from '../../types';
import type { DifferentialSurface, FirstFundamentalForm, ChristoffelSymbols } from '../riemannian/types';
import {
  computeSurfaceNormal,
  computeFirstFundamentalForm,
  computeChristoffelSymbols
} from '../riemannian/computations';

export interface ParametricSurfaceFunction {
  (u: number, v: number): { x: number; y: number; z: number } | THREE.Vector3;
}

export interface ParametricSurfaceOptions {
  uMin?: number;
  uMax?: number;
  vMin?: number;
  vMax?: number;
  uSegments?: number;
  vSegments?: number;
  material?: THREE.Material;
  color?: number;
  wireframe?: boolean;
  computeNormals?: boolean;
}

/**
 * Parametric surface with differential geometry structure
 *
 * Implements DifferentialSurface for geodesic integration
 * Follows component lifecycle pattern (rebuild/update)
 *
 * @example
 *   // Sphere
 *   const sphere = new ParametricSurface(
 *     (u, v) => ({
 *       x: Math.sin(u) * Math.cos(v),
 *       y: Math.sin(u) * Math.sin(v),
 *       z: Math.cos(u)
 *     }),
 *     { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI }
 *   );
 */
export class ParametricSurface implements MathComponent, DifferentialSurface {
  mesh: THREE.Mesh;
  params: ComponentParams;

  private fn: ParametricSurfaceFunction;
  private computeNormals: boolean;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.Material;

  uMin!: number;
  uMax!: number;
  vMin!: number;
  vMax!: number;
  uSegments!: number;
  vSegments!: number;
  colorHex!: number;
  wireframe!: number;

  constructor(fn: ParametricSurfaceFunction, options: ParametricSurfaceOptions = {}) {
    this.fn = fn;
    this.computeNormals = options.computeNormals ?? true;
    this.params = new ComponentParams(this);

    // STRUCTURAL PARAMETERS → rebuild
    this.params.define('uMin', options.uMin ?? 0, {
      min: -10, max: 10, step: 0.1,
      label: 'U Min',
      triggers: 'rebuild'
    });

    this.params.define('uMax', options.uMax ?? 2 * Math.PI, {
      min: -10, max: 10, step: 0.1,
      label: 'U Max',
      triggers: 'rebuild'
    });

    this.params.define('vMin', options.vMin ?? 0, {
      min: -10, max: 10, step: 0.1,
      label: 'V Min',
      triggers: 'rebuild'
    });

    this.params.define('vMax', options.vMax ?? 2 * Math.PI, {
      min: -10, max: 10, step: 0.1,
      label: 'V Max',
      triggers: 'rebuild'
    });

    this.params.define('uSegments', options.uSegments ?? 32, {
      min: 4, max: 128, step: 1,
      label: 'U Segments',
      triggers: 'rebuild'
    });

    this.params.define('vSegments', options.vSegments ?? 32, {
      min: 4, max: 128, step: 1,
      label: 'V Segments',
      triggers: 'rebuild'
    });

    // VISUAL PARAMETERS → update
    this.params.define('colorHex', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      triggers: 'update'
    });

    this.params.define('wireframe', options.wireframe ?? false, {
      type: 'boolean',
      label: 'Wireframe',
      triggers: 'update'
    });

    // Build initial surface
    this.geometry = this.buildGeometry();
    this.material = options.material ?? new THREE.MeshStandardMaterial({
      color: this.colorHex,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: this.wireframe
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  private buildGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const uSegments = Math.floor(this.uSegments);
    const vSegments = Math.floor(this.vSegments);

    // Generate vertices
    for (let i = 0; i <= uSegments; i++) {
      const u = this.uMin + (i / uSegments) * (this.uMax - this.uMin);

      for (let j = 0; j <= vSegments; j++) {
        const v = this.vMin + (j / vSegments) * (this.vMax - this.vMin);

        const p = this.fn(u, v);
        positions.push(p.x, p.y, p.z);

        // UV coordinates
        uvs.push(i / uSegments, j / vSegments);

        // Compute normal via finite differences if requested
        if (this.computeNormals) {
          const normal = this.computeNormal(u, v);
          normals.push(normal.x, normal.y, normal.z);
        }
      }
    }

    // Generate indices
    for (let i = 0; i < uSegments; i++) {
      for (let j = 0; j < vSegments; j++) {
        const a = i * (vSegments + 1) + j;
        const b = a + vSegments + 1;
        const c = a + 1;
        const d = b + 1;

        // Two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    if (this.computeNormals && normals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    return geometry;
  }

  /**
   * Compute normal at (u, v) using finite differences
   */
  private computeNormal(u: number, v: number): THREE.Vector3 {
    const epsilon = 0.001;

    // Partial derivative with respect to u
    const p = this.fn(u, v);
    const pu = this.fn(u + epsilon, v);
    const tangentU = new THREE.Vector3(
      pu.x - p.x,
      pu.y - p.y,
      pu.z - p.z
    ).normalize();

    // Partial derivative with respect to v
    const pv = this.fn(u, v + epsilon);
    const tangentV = new THREE.Vector3(
      pv.x - p.x,
      pv.y - p.y,
      pv.z - p.z
    ).normalize();

    // Normal is cross product
    const normal = new THREE.Vector3();
    normal.crossVectors(tangentU, tangentV).normalize();

    return normal;
  }

  // ===== DifferentialSurface Interface =====

  /**
   * Parameterization: (u,v) → (x,y,z)
   */
  parameterization(u: number, v: number): THREE.Vector3 {
    const result = this.fn(u, v);
    if (result instanceof THREE.Vector3) {
      return result;
    }
    return new THREE.Vector3(result.x, result.y, result.z);
  }

  /**
   * Surface normal at (u,v)
   */
  surfaceNormal(u: number, v: number): THREE.Vector3 {
    return computeSurfaceNormal((u, v) => this.parameterization(u, v), u, v);
  }

  /**
   * First fundamental form at (u,v)
   */
  firstFundamentalForm(u: number, v: number): FirstFundamentalForm {
    return computeFirstFundamentalForm((u, v) => this.parameterization(u, v), u, v);
  }

  /**
   * Christoffel symbols at (u,v) for geodesic equations
   */
  christoffelSymbols(u: number, v: number): ChristoffelSymbols {
    return computeChristoffelSymbols((u, v) => this.parameterization(u, v), u, v);
  }

  // ===== Component Lifecycle =====

  /**
   * Rebuild geometry when structural parameters change
   * Uses safe swap pattern: build → swap → dispose
   */
  rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.geometry;

    this.mesh.geometry = newGeometry;
    this.geometry = newGeometry;

    oldGeometry.dispose();
  }

  /**
   * Update visual properties (color, wireframe)
   */
  update(): void {
    const mat = this.material as THREE.MeshStandardMaterial;
    mat.color.setHex(this.colorHex);
    mat.wireframe = this.wireframe;
    mat.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
