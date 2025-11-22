import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import { MARCHING_CUBES_TRIANGLES } from './marchingCubesTable';

export interface ImplicitFunction {
  (x: number, y: number, z: number): number;
}

export interface ImplicitSurfaceOptions {
  bounds?: {
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    zMin?: number;
    zMax?: number;
  };
  resolution?: number;
  isovalue?: number;
  material?: THREE.Material;
}

/**
 * Implicit surface visualization using simplified marching cubes
 *
 * Displays the level set f(x,y,z) = isovalue of an implicit function.
 *
 * @example
 *   // Sphere: x² + y² + z² - r² = 0
 *   const sphere = new ImplicitSurface(
 *     (x, y, z) => x*x + y*y + z*z - 1,
 *     { resolution: 32, isovalue: 0 }
 *   );
 */
export class ImplicitSurface {
  mesh: THREE.Mesh;
  params: ComponentParams;

  private fn: ImplicitFunction;
  private bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };

  resolution!: number;
  isovalue!: number;

  constructor(fn: ImplicitFunction, options: ImplicitSurfaceOptions = {}) {
    this.fn = fn;
    this.params = new ComponentParams(this);

    // Set bounds
    this.bounds = {
      xMin: options.bounds?.xMin ?? -2,
      xMax: options.bounds?.xMax ?? 2,
      yMin: options.bounds?.yMin ?? -2,
      yMax: options.bounds?.yMax ?? 2,
      zMin: options.bounds?.zMin ?? -2,
      zMax: options.bounds?.zMax ?? 2
    };

    // Define parameters
    this.params.define('resolution', options.resolution ?? 32, {
      min: 8,
      max: 64,
      step: 4,
      label: 'Resolution',
      onChange: () => this.rebuild()
    });

    this.params.define('isovalue', options.isovalue ?? 0, {
      min: -2,
      max: 2,
      step: 0.1,
      label: 'Isovalue',
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

    const res = Math.floor(this.resolution);
    const dx = (this.bounds.xMax - this.bounds.xMin) / res;
    const dy = (this.bounds.yMax - this.bounds.yMin) / res;
    const dz = (this.bounds.zMax - this.bounds.zMin) / res;

    // Sample the field on a grid
    const field: number[][][] = [];
    for (let i = 0; i <= res; i++) {
      field[i] = [];
      for (let j = 0; j <= res; j++) {
        field[i][j] = [];
        for (let k = 0; k <= res; k++) {
          const x = this.bounds.xMin + i * dx;
          const y = this.bounds.yMin + j * dy;
          const z = this.bounds.zMin + k * dz;
          field[i][j][k] = this.fn(x, y, z);
        }
      }
    }

    // Process each cube
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        for (let k = 0; k < res; k++) {
          const x = this.bounds.xMin + i * dx;
          const y = this.bounds.yMin + j * dy;
          const z = this.bounds.zMin + k * dz;

          this.processCube(i, j, k, dx, dy, dz, field, positions);
        }
      }
    }

    if (positions.length > 0) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
    }

    return geometry;
  }

  private processCube(
    i: number,
    j: number,
    k: number,
    dx: number,
    dy: number,
    dz: number,
    field: number[][][],
    positions: number[]
  ): void {
    const x = this.bounds.xMin + i * dx;
    const y = this.bounds.yMin + j * dy;
    const z = this.bounds.zMin + k * dz;

    // 8 corners of the cube
    const corners = [
      { x: x, y: y, z: z, v: field[i][j][k] },
      { x: x + dx, y: y, z: z, v: field[i + 1][j][k] },
      { x: x + dx, y: y + dy, z: z, v: field[i + 1][j + 1][k] },
      { x: x, y: y + dy, z: z, v: field[i][j + 1][k] },
      { x: x, y: y, z: z + dz, v: field[i][j][k + 1] },
      { x: x + dx, y: y, z: z + dz, v: field[i + 1][j][k + 1] },
      { x: x + dx, y: y + dy, z: z + dz, v: field[i + 1][j + 1][k + 1] },
      { x: x, y: y + dy, z: z + dz, v: field[i][j + 1][k + 1] }
    ];

    // Determine cube index (which corners are inside)
    let cubeIndex = 0;
    for (let n = 0; n < 8; n++) {
      if (corners[n].v < this.isovalue) {
        cubeIndex |= (1 << n);
      }
    }

    // Skip if cube is entirely inside or outside
    if (cubeIndex === 0 || cubeIndex === 255) {
      return;
    }

    // 12 edges of the cube
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],  // Bottom face
      [4, 5], [5, 6], [6, 7], [7, 4],  // Top face
      [0, 4], [1, 5], [2, 6], [3, 7]   // Vertical edges
    ];

    // Find edge intersections
    const vertList: THREE.Vector3[] = [];
    for (let e = 0; e < 12; e++) {
      const [v1, v2] = edges[e];
      const c1 = corners[v1];
      const c2 = corners[v2];

      // Check if edge crosses the isosurface
      if ((c1.v < this.isovalue && c2.v >= this.isovalue) ||
          (c1.v >= this.isovalue && c2.v < this.isovalue)) {
        // Interpolate
        const t = (this.isovalue - c1.v) / (c2.v - c1.v);
        vertList[e] = new THREE.Vector3(
          c1.x + t * (c2.x - c1.x),
          c1.y + t * (c2.y - c1.y),
          c1.z + t * (c2.z - c1.z)
        );
      }
    }

    // Triangulate based on cube index
    const triangles = this.getTriangles(cubeIndex);
    for (let t = 0; t < triangles.length; t += 3) {
      const v1 = vertList[triangles[t]];
      const v2 = vertList[triangles[t + 1]];
      const v3 = vertList[triangles[t + 2]];

      if (v1 && v2 && v3) {
        // Reverse winding order to fix normals pointing outward
        positions.push(v1.x, v1.y, v1.z);
        positions.push(v3.x, v3.y, v3.z);
        positions.push(v2.x, v2.y, v2.z);
      }
    }
  }

  /**
   * Get marching cubes triangulation for a cube configuration
   * Returns edge indices for triangulation based on which corners are inside
   */
  private getTriangles(cubeIndex: number): number[] {
    return MARCHING_CUBES_TRIANGLES[cubeIndex] || [];
  }

  /**
   * Rebuild geometry with current parameters
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
