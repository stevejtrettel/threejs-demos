import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';

export interface ParametricSurfaceFunction {
  (u: number, v: number): { x: number; y: number; z: number };
}

export interface ParametricSurfaceOptions {
  uMin?: number;
  uMax?: number;
  vMin?: number;
  vMax?: number;
  uSegments?: number;
  vSegments?: number;
  material?: THREE.Material;
  computeNormals?: boolean;
}

/**
 * Parametric surface visualization
 *
 * Creates a mesh from a parametric function (u, v) → {x, y, z}
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
export class ParametricSurface {
  mesh: THREE.Mesh;
  params: ComponentParams;

  private fn: ParametricSurfaceFunction;
  private computeNormals: boolean;

  uMin!: number;
  uMax!: number;
  vMin!: number;
  vMax!: number;
  uSegments!: number;
  vSegments!: number;

  constructor(fn: ParametricSurfaceFunction, options: ParametricSurfaceOptions = {}) {
    this.fn = fn;
    this.computeNormals = options.computeNormals ?? true;
    this.params = new ComponentParams(this);

    // Define parameters
    this.params.define('uMin', options.uMin ?? 0, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 'u Min',
      onChange: () => this.rebuild()
    });

    this.params.define('uMax', options.uMax ?? 2 * Math.PI, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 'u Max',
      onChange: () => this.rebuild()
    });

    this.params.define('vMin', options.vMin ?? 0, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 'v Min',
      onChange: () => this.rebuild()
    });

    this.params.define('vMax', options.vMax ?? 2 * Math.PI, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 'v Max',
      onChange: () => this.rebuild()
    });

    this.params.define('uSegments', options.uSegments ?? 32, {
      min: 4,
      max: 128,
      step: 1,
      label: 'u Segments',
      onChange: () => this.rebuild()
    });

    this.params.define('vSegments', options.vSegments ?? 32, {
      min: 4,
      max: 128,
      step: 1,
      label: 'v Segments',
      onChange: () => this.rebuild()
    });

    // Build initial surface
    const geometry = this.buildGeometry();
    const material = options.material ?? new THREE.MeshStandardMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      flatShading: false
    });

    this.mesh = new THREE.Mesh(geometry, material);
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

  /**
   * Rebuild geometry with current parameters
   * Uses safe swap pattern: build → swap → dispose
   */
  private rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.mesh.geometry;
    this.mesh.geometry = newGeometry;
    oldGeometry.dispose();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }
  }
}
