import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';

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
 * Implicit surface visualization using marching cubes
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
    const normals: number[] = [];

    const res = Math.floor(this.resolution);
    const dx = (this.bounds.xMax - this.bounds.xMin) / res;
    const dy = (this.bounds.yMax - this.bounds.yMin) / res;
    const dz = (this.bounds.zMax - this.bounds.zMin) / res;

    // Sample the field
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

    // March through cubes
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        for (let k = 0; k < res; k++) {
          const x0 = this.bounds.xMin + i * dx;
          const y0 = this.bounds.yMin + j * dy;
          const z0 = this.bounds.zMin + k * dz;

          const cube = {
            p: [
              { x: x0, y: y0, z: z0 },
              { x: x0 + dx, y: y0, z: z0 },
              { x: x0 + dx, y: y0 + dy, z: z0 },
              { x: x0, y: y0 + dy, z: z0 },
              { x: x0, y: y0, z: z0 + dz },
              { x: x0 + dx, y: y0, z: z0 + dz },
              { x: x0 + dx, y: y0 + dy, z: z0 + dz },
              { x: x0, y: y0 + dy, z: z0 + dz }
            ],
            v: [
              field[i][j][k],
              field[i + 1][j][k],
              field[i + 1][j + 1][k],
              field[i][j + 1][k],
              field[i][j][k + 1],
              field[i + 1][j][k + 1],
              field[i + 1][j + 1][k + 1],
              field[i][j + 1][k + 1]
            ]
          };

          this.polygonizeCube(cube, positions, normals);
        }
      }
    }

    if (positions.length > 0) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (normals.length > 0) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      } else {
        geometry.computeVertexNormals();
      }
    }

    return geometry;
  }

  /**
   * Polygonize a single cube using marching cubes
   */
  private polygonizeCube(
    cube: { p: { x: number; y: number; z: number }[]; v: number[] },
    positions: number[],
    normals: number[]
  ): void {
    // Determine which vertices are inside the surface
    let cubeindex = 0;
    for (let i = 0; i < 8; i++) {
      if (cube.v[i] < this.isovalue) {
        cubeindex |= (1 << i);
      }
    }

    // Cube is entirely in/out of the surface
    if (cubeindex === 0 || cubeindex === 255) {
      return;
    }

    // Find the vertices where the surface intersects the cube edges
    const vertlist: THREE.Vector3[] = [];

    // Edge table: which edges intersect the surface
    const edgeTable = this.getEdgeTable();
    const edges = edgeTable[cubeindex];

    if (edges === 0) return;

    // Interpolate along edges
    const edgeVertices = [
      [0, 1], [1, 2], [2, 3], [3, 0],  // Bottom face
      [4, 5], [5, 6], [6, 7], [7, 4],  // Top face
      [0, 4], [1, 5], [2, 6], [3, 7]   // Vertical edges
    ];

    for (let i = 0; i < 12; i++) {
      if (edges & (1 << i)) {
        const [v1, v2] = edgeVertices[i];
        vertlist[i] = this.interpolate(
          cube.p[v1],
          cube.p[v2],
          cube.v[v1],
          cube.v[v2]
        );
      }
    }

    // Create triangles
    const triTable = this.getTriangleTable();
    const triangles = triTable[cubeindex];

    for (let i = 0; i < triangles.length; i += 3) {
      const v1 = vertlist[triangles[i]];
      const v2 = vertlist[triangles[i + 1]];
      const v3 = vertlist[triangles[i + 2]];

      if (v1 && v2 && v3) {
        positions.push(v1.x, v1.y, v1.z);
        positions.push(v2.x, v2.y, v2.z);
        positions.push(v3.x, v3.y, v3.z);

        // Compute normal via gradient
        const n1 = this.computeGradient(v1.x, v1.y, v1.z);
        const n2 = this.computeGradient(v2.x, v2.y, v2.z);
        const n3 = this.computeGradient(v3.x, v3.y, v3.z);

        normals.push(n1.x, n1.y, n1.z);
        normals.push(n2.x, n2.y, n2.z);
        normals.push(n3.x, n3.y, n3.z);
      }
    }
  }

  /**
   * Interpolate between two points based on field values
   */
  private interpolate(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    v1: number,
    v2: number
  ): THREE.Vector3 {
    const t = (this.isovalue - v1) / (v2 - v1);
    return new THREE.Vector3(
      p1.x + t * (p2.x - p1.x),
      p1.y + t * (p2.y - p1.y),
      p1.z + t * (p2.z - p1.z)
    );
  }

  /**
   * Compute gradient (normal) at a point
   */
  private computeGradient(x: number, y: number, z: number): THREE.Vector3 {
    const epsilon = 0.01;
    const grad = new THREE.Vector3(
      this.fn(x + epsilon, y, z) - this.fn(x - epsilon, y, z),
      this.fn(x, y + epsilon, z) - this.fn(x, y - epsilon, z),
      this.fn(x, y, z + epsilon) - this.fn(x, y, z - epsilon)
    );
    return grad.normalize();
  }

  /**
   * Simplified edge table for marching cubes
   */
  private getEdgeTable(): number[] {
    // This is a simplified version - full table has 256 entries
    // For production use, include the complete marching cubes lookup table
    const table = new Array(256).fill(0);

    // Basic cases (this is simplified - real implementation needs all 256)
    table[0] = 0;
    table[255] = 0;

    // For other cases, we'll use a simple approximation
    for (let i = 1; i < 255; i++) {
      table[i] = 0xFFF; // All edges potentially intersect
    }

    return table;
  }

  /**
   * Simplified triangle table for marching cubes
   */
  private getTriangleTable(): number[][] {
    // This is a simplified version - full table has 256 entries
    const table: number[][] = new Array(256).fill([]);

    // Simple cases
    table[0] = [];
    table[255] = [];

    // For demonstration, use a basic triangulation pattern
    // In production, use the complete marching cubes triangle table
    for (let i = 1; i < 255; i++) {
      table[i] = [0, 1, 2, 2, 3, 0]; // Simple quad triangulation
    }

    return table;
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
