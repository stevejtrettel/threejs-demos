import * as THREE from 'three';
import { Params } from '../../Params';
import { MARCHING_SQUARES_EDGES } from './marchingSquaresTable';

export interface LevelFunction {
  (x: number, y: number): number;
}

export interface LevelCurveOptions {
  bounds?: {
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
  };
  resolution?: number;
  level?: number;
  zPosition?: number;
  color?: number;
  linewidth?: number;
}

/**
 * Level curve visualization using marching squares
 *
 * Displays the contour where f(x,y) = level
 *
 * @example
 *   // Circle: x² + y² = 1
 *   const circle = new LevelCurve(
 *     (x, y) => x*x + y*y,
 *     { level: 1, color: 0xff0000 }
 *   );
 */
export class LevelCurve {
  mesh: THREE.Group;
  params: Params;

  private fn: LevelFunction;
  private bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  private zPosition: number;
  private lineColor: number;
  private linewidth: number;

  level!: number;
  resolution!: number;

  constructor(fn: LevelFunction, options: LevelCurveOptions = {}) {
    this.fn = fn;
    this.params = new Params(this);

    // Set bounds
    this.bounds = {
      xMin: options.bounds?.xMin ?? -2,
      xMax: options.bounds?.xMax ?? 2,
      yMin: options.bounds?.yMin ?? -2,
      yMax: options.bounds?.yMax ?? 2
    };

    this.zPosition = options.zPosition ?? 0;
    this.lineColor = options.color ?? 0xff0000;
    this.linewidth = options.linewidth ?? 2;

    // Define parameters
    this.params.define('resolution', options.resolution ?? 50, {
      min: 10,
      max: 200,
      step: 10,
      label: 'Resolution',
      onChange: () => this.rebuild()
    });

    this.params.define('level', options.level ?? 0, {
      min: -5,
      max: 5,
      step: 0.1,
      label: 'Level',
      onChange: () => this.rebuild()
    });

    // Build initial curve
    this.mesh = new THREE.Group();
    this.rebuild();
  }

  private buildGeometry(): THREE.BufferGeometry[] {
    const geometries: THREE.BufferGeometry[] = [];
    const res = Math.floor(this.resolution);
    const dx = (this.bounds.xMax - this.bounds.xMin) / res;
    const dy = (this.bounds.yMax - this.bounds.yMin) / res;

    // Sample the field on a grid
    const field: number[][] = [];
    for (let i = 0; i <= res; i++) {
      field[i] = [];
      for (let j = 0; j <= res; j++) {
        const x = this.bounds.xMin + i * dx;
        const y = this.bounds.yMin + j * dy;
        field[i][j] = this.fn(x, y);
      }
    }

    // Process each square
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        const x = this.bounds.xMin + i * dx;
        const y = this.bounds.yMin + j * dy;

        const segments = this.processSquare(i, j, dx, dy, field);
        if (segments.length > 0) {
          geometries.push(...segments);
        }
      }
    }

    return geometries;
  }

  private processSquare(
    i: number,
    j: number,
    dx: number,
    dy: number,
    field: number[][]
  ): THREE.BufferGeometry[] {
    const x = this.bounds.xMin + i * dx;
    const y = this.bounds.yMin + j * dy;

    // 4 corners of the square (counterclockwise from bottom-left)
    const corners = [
      { x: x, y: y, v: field[i][j] },           // 0: bottom-left
      { x: x + dx, y: y, v: field[i + 1][j] },  // 1: bottom-right
      { x: x + dx, y: y + dy, v: field[i + 1][j + 1] }, // 2: top-right
      { x: x, y: y + dy, v: field[i][j + 1] }   // 3: top-left
    ];

    // Determine square index (which corners are below level)
    let squareIndex = 0;
    for (let n = 0; n < 4; n++) {
      if (corners[n].v < this.level) {
        squareIndex |= (1 << n);
      }
    }

    // 4 edges of the square
    const edges = [
      [0, 1], // bottom
      [1, 2], // right
      [2, 3], // top
      [3, 0]  // left
    ];

    // Get edge crossings
    const edgePoints: (THREE.Vector3 | null)[] = [null, null, null, null];
    for (let e = 0; e < 4; e++) {
      const [v1, v2] = edges[e];
      const c1 = corners[v1];
      const c2 = corners[v2];

      // Check if edge crosses the level
      if ((c1.v < this.level && c2.v >= this.level) ||
          (c1.v >= this.level && c2.v < this.level)) {
        // Interpolate
        const t = (this.level - c1.v) / (c2.v - c1.v);
        edgePoints[e] = new THREE.Vector3(
          c1.x + t * (c2.x - c1.x),
          c1.y + t * (c2.y - c1.y),
          this.zPosition
        );
      }
    }

    // Create line segments based on square configuration
    const edgePairs = MARCHING_SQUARES_EDGES[squareIndex];
    const geometries: THREE.BufferGeometry[] = [];

    for (let p = 0; p < edgePairs.length; p += 2) {
      const e1 = edgePairs[p];
      const e2 = edgePairs[p + 1];
      const p1 = edgePoints[e1];
      const p2 = edgePoints[e2];

      if (p1 && p2) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([
          p1.x, p1.y, p1.z,
          p2.x, p2.y, p2.z
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometries.push(geometry);
      }
    }

    return geometries;
  }

  private rebuild(): void {
    // Clear existing lines
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    // Build new geometry
    const geometries = this.buildGeometry();
    const material = new THREE.LineBasicMaterial({
      color: this.lineColor,
      linewidth: this.linewidth
    });

    for (const geom of geometries) {
      const line = new THREE.Line(geom, material.clone());
      this.mesh.add(line);
    }
  }

  /**
   * Set the level value
   */
  setLevel(level: number): void {
    this.level = level;
  }

  dispose(): void {
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
