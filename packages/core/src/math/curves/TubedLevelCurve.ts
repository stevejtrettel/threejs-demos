import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import { MARCHING_SQUARES_EDGES } from './marchingSquaresTable';
import { connectLineSegments, isPathClosed } from '../../utils/connectLineSegments';
import type { LevelFunction, LevelCurveOptions } from './LevelCurve';

export interface TubedLevelCurveOptions extends LevelCurveOptions {
  tubeRadius?: number;
  tubularSegments?: number;
  radialSegments?: number;
  material?: THREE.Material;
}

/**
 * Level curve with 3D tube geometry
 *
 * Like LevelCurve but renders as 3D tubes instead of flat lines.
 * Better lighting, depth perception, and visual quality.
 *
 * @example
 *   const circle = new TubedLevelCurve(
 *     (x, y) => x*x + y*y,
 *     { level: 1, tubeRadius: 0.02 }
 *   );
 */
export class TubedLevelCurve {
  mesh: THREE.Group;
  params: ComponentParams;

  private fn: LevelFunction;
  private bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  private zPosition: number;
  private tubeRadius: number;
  private tubularSegments: number;
  private radialSegments: number;
  private material: THREE.Material;

  level!: number;
  resolution!: number;

  constructor(fn: LevelFunction, options: TubedLevelCurveOptions = {}) {
    this.fn = fn;
    this.params = new ComponentParams(this);

    // Set bounds
    this.bounds = {
      xMin: options.bounds?.xMin ?? -2,
      xMax: options.bounds?.xMax ?? 2,
      yMin: options.bounds?.yMin ?? -2,
      yMax: options.bounds?.yMax ?? 2
    };

    this.zPosition = options.zPosition ?? 0;
    this.tubeRadius = options.tubeRadius ?? 0.02;
    this.tubularSegments = options.tubularSegments ?? 64;
    this.radialSegments = options.radialSegments ?? 8;
    this.material = options.material ?? new THREE.MeshStandardMaterial({
      color: options.color ?? 0xff0000
    });

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

  /**
   * Extract line segments from marching squares
   */
  private extractSegments(): Array<[THREE.Vector3, THREE.Vector3]> {
    const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];
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

        const squareSegments = this.processSquare(i, j, dx, dy, field);
        segments.push(...squareSegments);
      }
    }

    return segments;
  }

  private processSquare(
    i: number,
    j: number,
    dx: number,
    dy: number,
    field: number[][]
  ): Array<[THREE.Vector3, THREE.Vector3]> {
    const x = this.bounds.xMin + i * dx;
    const y = this.bounds.yMin + j * dy;

    // 4 corners of the square
    const corners = [
      { x: x, y: y, v: field[i][j] },
      { x: x + dx, y: y, v: field[i + 1][j] },
      { x: x + dx, y: y + dy, v: field[i + 1][j + 1] },
      { x: x, y: y + dy, v: field[i][j + 1] }
    ];

    // Determine square index
    let squareIndex = 0;
    for (let n = 0; n < 4; n++) {
      if (corners[n].v < this.level) {
        squareIndex |= (1 << n);
      }
    }

    // 4 edges
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

      if ((c1.v < this.level && c2.v >= this.level) ||
          (c1.v >= this.level && c2.v < this.level)) {
        const t = (this.level - c1.v) / (c2.v - c1.v);
        edgePoints[e] = new THREE.Vector3(
          c1.x + t * (c2.x - c1.x),
          c1.y + t * (c2.y - c1.y),
          this.zPosition
        );
      }
    }

    // Create segments based on square configuration
    const edgePairs = MARCHING_SQUARES_EDGES[squareIndex];
    const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];

    for (let p = 0; p < edgePairs.length; p += 2) {
      const e1 = edgePairs[p];
      const e2 = edgePairs[p + 1];
      const p1 = edgePoints[e1];
      const p2 = edgePoints[e2];

      if (p1 && p2) {
        segments.push([p1, p2]);
      }
    }

    return segments;
  }

  private rebuild(): void {
    // Clear existing tubes
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    // Extract segments from marching squares
    const segments = this.extractSegments();

    if (segments.length === 0) {
      return;
    }

    // Connect segments into paths
    const paths = connectLineSegments(segments);

    // Create tube for each path
    for (const path of paths) {
      if (path.length < 2) continue;

      const closed = isPathClosed(path);

      // Create curve from path
      const curve = new THREE.CatmullRomCurve3(path, closed);

      // Create tube geometry
      const geometry = new THREE.TubeGeometry(
        curve,
        this.tubularSegments,
        this.tubeRadius,
        this.radialSegments,
        closed
      );

      const tube = new THREE.Mesh(geometry, this.material.clone());
      this.mesh.add(tube);
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
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
