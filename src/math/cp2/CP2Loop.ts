/**
 * CP2Loop — a closed thick line in CP^2 drawn via Line2.
 *
 * Holds a fixed-capacity vertex buffer (since Line2 / LineGeometry doesn't
 * resize cheaply); the demo provides up to `capacity` CP^2 points via
 * `setPoints`, and each frame `project(g)` rotates and projects them.
 *
 *   const loop = new CP2Loop({ capacity: 487, color: 0xff9933, linewidth: 2 });
 *   loop.setPoints(loopVertices);   // when (f, g) changes
 *   loop.project(g);                // each frame
 *
 * The loop is closed automatically: if the caller's last vertex isn't the
 * same as the first, the projection writes an extra copy of the first
 * projected vertex at the buffer's tail.
 *
 * Line2's LineMaterial uses pixel-space linewidth and needs its resolution
 * synced with the canvas size; this component registers a window resize
 * listener and removes it in `dispose()`.
 */

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Params } from '@/Params';
import type { Parametric, Updatable } from '@/types';
import type { CP2Point } from './point';
import type { Mat3C } from './u3';
import { applyMat3C } from './u3';
import { toricProjection, type CP2Projection } from './projections';

export interface CP2LoopOptions {
  /** Maximum number of vertices in the loop, including the close-the-loop repeat. */
  capacity: number;
  /** Line color (default white). */
  color?: number;
  /** Line width in pixels (default 2). */
  linewidth?: number;
  /** Projection from CP^2 to R^3. Default: toric/moment-map for CP^2. */
  projection?: CP2Projection;
  /** Material opacity (default 0.95). */
  opacity?: number;
}

const OFFSCREEN = 1e6;

export class CP2Loop extends THREE.Group implements Parametric, Updatable {
  readonly params = new Params(this);

  declare color: number;
  declare linewidth: number;
  declare opacity: number;

  readonly capacity: number;
  private points: CP2Point[] = [];
  private positions: Float32Array;
  private geom: LineGeometry;
  private mat: LineMaterial;
  private line: Line2;
  private resizeHandler: () => void;
  private projection: CP2Projection;

  constructor(opts: CP2LoopOptions) {
    super();
    this.capacity = opts.capacity;
    this.positions = new Float32Array(this.capacity * 3);
    // Park everything off-screen until setPoints is called.
    for (let i = 0; i < this.capacity; i++) {
      this.positions[3 * i] = OFFSCREEN;
      this.positions[3 * i + 1] = OFFSCREEN;
      this.positions[3 * i + 2] = 0;
    }

    this.geom = new LineGeometry();
    this.geom.setPositions(this.positions);

    this.mat = new LineMaterial({
      color: opts.color ?? 0xffffff,
      linewidth: opts.linewidth ?? 2,
      worldUnits: false,
      transparent: true,
      depthTest: false,
    });
    this.mat.resolution.set(window.innerWidth, window.innerHeight);

    this.line = new Line2(this.geom, this.mat);
    this.line.renderOrder = 2;
    this.add(this.line);

    this.resizeHandler = () => {
      this.mat.resolution.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.projection = opts.projection ?? toricProjection();

    this.params
      .define('color', opts.color ?? 0xffffff, { triggers: 'update' })
      .define('linewidth', opts.linewidth ?? 2, { triggers: 'update' })
      .define('opacity', opts.opacity ?? 0.95, { triggers: 'update' });

    this.update();
  }

  /** Swap the projection function. Takes effect on the next `project(g)` call. */
  setProjection(projection: CP2Projection): void {
    this.projection = projection;
  }

  /**
   * Set the loop's vertices. Length must be ≤ capacity. If the last vertex
   * doesn't equal the first, the projection will repeat the first vertex at
   * the tail to close the loop.
   */
  setPoints(points: CP2Point[]): void {
    if (points.length > this.capacity) {
      throw new Error(
        `CP2Loop: setPoints got ${points.length} vertices, capacity is ${this.capacity}`,
      );
    }
    this.points = points;
  }

  /** Apply rotation `g`, project each vertex, write into the position buffer. */
  project(g: Mat3C): void {
    const pts = this.points;
    const positions = this.positions;
    const proj = this.projection;
    let lastIdx = -1;
    for (let i = 0; i < pts.length; i++) {
      proj(applyMat3C(g, pts[i]), positions, 3 * i);
      lastIdx = i;
    }
    // Park any unused slots far off-screen so they don't draw spurious edges.
    for (let i = lastIdx + 1; i < this.capacity; i++) {
      positions[3 * i] = OFFSCREEN;
      positions[3 * i + 1] = OFFSCREEN;
      positions[3 * i + 2] = 0;
    }
    this.geom.setPositions(positions);
  }

  update(): void {
    this.mat.color.setHex(this.color);
    this.mat.linewidth = this.linewidth;
    this.mat.opacity = this.opacity;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.geom.dispose();
    this.mat.dispose();
    this.params.dispose();
  }
}
