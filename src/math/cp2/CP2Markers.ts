/**
 * CP2Markers — fixed-capacity set of colored markers drawn as large dots.
 *
 * Use for distinguished points on a CP^2 curve (branch points, group-law
 * identities, fixed points, etc.). The colors are set at construction (one
 * per slot) and stay attached to that slot — they're identity, not config.
 *
 *   const markers = new CP2Markers({
 *     colors: [[1,0,0], [0,1,0], [0,0,1], [1,1,1]],
 *     size: 0.022,
 *   });
 *   markers.setPoints([p1, p2, p3, infinityPoint]);  // when (f, g) changes
 *   markers.project(g);                              // each frame
 *
 * Unused slots (when fewer points are set than the capacity) are parked far
 * off-screen so they're not visible.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Updatable } from '@/types';
import type { CP2Point } from './point';
import type { Mat3C } from './u3';
import { applyMat3C } from './u3';
import { toricProjection, type CP2Projection } from './projections';

export type RGB = [number, number, number];

export interface CP2MarkersOptions {
  /** Per-slot RGB colors (length = capacity). */
  colors: RGB[];
  /** Marker size in world units (default 0.022). */
  size?: number;
  /** Projection from CP^2 to R^3. Default: toric/moment-map for CP^2. */
  projection?: CP2Projection;
  /** Material opacity (default 1.0). */
  opacity?: number;
}

const OFFSCREEN = 1e6;

export class CP2Markers extends THREE.Points implements Parametric, Updatable {
  readonly params = new Params(this);

  declare size: number;
  declare opacity: number;

  readonly capacity: number;
  private markerData: CP2Point[] = [];
  private positions: Float32Array;
  private projection: CP2Projection;

  constructor(opts: CP2MarkersOptions) {
    super();

    this.capacity = opts.colors.length;
    this.positions = new Float32Array(this.capacity * 3);
    const colorsBuf = new Float32Array(this.capacity * 3);
    for (let i = 0; i < this.capacity; i++) {
      colorsBuf[3 * i] = opts.colors[i][0];
      colorsBuf[3 * i + 1] = opts.colors[i][1];
      colorsBuf[3 * i + 2] = opts.colors[i][2];
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colorsBuf, 3));

    this.material = new THREE.PointsMaterial({
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });

    this.renderOrder = 3; // draw above clouds and lift loops

    this.projection = opts.projection ?? toricProjection();

    this.params
      .define('size', opts.size ?? 0.022, { triggers: 'update' })
      .define('opacity', opts.opacity ?? 1.0, { triggers: 'update' });

    this.update();
    this.parkAll();
  }

  /** Swap the projection function. Takes effect on the next `project(g)` call. */
  setProjection(projection: CP2Projection): void {
    this.projection = projection;
  }

  /** Replace the marker positions. Length must be ≤ capacity. */
  setPoints(points: CP2Point[]): void {
    if (points.length > this.capacity) {
      throw new Error(
        `CP2Markers: setPoints got ${points.length} points, capacity is ${this.capacity}`,
      );
    }
    this.markerData = points;
  }

  /** Apply rotation `g` to each marker, project, write to buffer. Call each frame. */
  project(g: Mat3C): void {
    const pts = this.markerData;
    const positions = this.positions;
    const proj = this.projection;
    for (let i = 0; i < this.capacity; i++) {
      if (i < pts.length) {
        proj(applyMat3C(g, pts[i]), positions, 3 * i);
      } else {
        positions[3 * i] = OFFSCREEN;
        positions[3 * i + 1] = OFFSCREEN;
        positions[3 * i + 2] = 0;
      }
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  update(): void {
    const mat = this.material as THREE.PointsMaterial;
    mat.size = this.size;
    mat.opacity = this.opacity;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    this.params.dispose();
  }

  private parkAll(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.positions[3 * i] = OFFSCREEN;
      this.positions[3 * i + 1] = OFFSCREEN;
      this.positions[3 * i + 2] = 0;
    }
  }
}
