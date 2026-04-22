import * as THREE from 'three';
import { Params } from '@/Params';
import type { Surface } from '@/math/surfaces/types';

export interface TrailOptions {
  /**
   * Ring-buffer capacity. After `maxPoints` pushes, oldest points are
   * overwritten. Default 1000.
   */
  maxPoints?: number;

  /**
   * Line color (default 0xff5522).
   */
  color?: number;

  /**
   * Line width (default 1; WebGL usually ignores >1 but supported by
   * line2 helpers if the user swaps material).
   */
  lineWidth?: number;
}

/**
 * Trail — a streaming line. You push `(u, v)` points; the trail draws a
 * `THREE.Line` on the given `Surface`, growing as you go.
 *
 * Designed for "state evolves frame-by-frame and I want a trail behind
 * it" — e.g., watching a geodesic draw itself as the simulation advances.
 *
 * Reactive to surface changes: if the surface's params morph, existing
 * points are re-mapped through the new `evaluate` automatically.
 *
 * @example
 *   const trail = new Trail(sphere, { maxPoints: 5000, color: 0xff5522 });
 *   scene.add(trail);
 *
 *   // in animate:
 *   trail.push(phi, t);
 */
export class Trail extends THREE.Line {
  readonly params = new Params(this);

  private surface: Surface;
  private readonly maxPoints: number;

  // Parameter-space points in insertion order.
  private pts: [number, number][] = [];

  // Float32Array of 3D positions, pre-allocated.
  private positionBuffer!: Float32Array;
  private writeIndex = 0;
  private pointCount = 0;

  declare color: number;
  declare lineWidth: number;

  constructor(surface: Surface, options: TrailOptions = {}) {
    super();

    this.surface = surface;
    this.maxPoints = options.maxPoints ?? 1000;

    this.material = new THREE.LineBasicMaterial();

    this.params
      .define('color', options.color ?? 0xff5522, { triggers: 'update' })
      .define('lineWidth', options.lineWidth ?? 1, { triggers: 'update' })
      .dependOn(surface);

    this.initGeometry();
    this.update();
  }

  private initGeometry(): void {
    this.positionBuffer = new Float32Array(this.maxPoints * 3);
    this.geometry = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(this.positionBuffer, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', attr);
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Append one point.
   */
  push(u: number, v: number): void {
    if (this.pointCount < this.maxPoints) {
      this.pts.push([u, v]);
      this.writePoint(this.pointCount, u, v);
      this.pointCount++;
      this.geometry.setDrawRange(0, this.pointCount);
    } else {
      // Ring: overwrite the oldest slot.
      this.pts[this.writeIndex] = [u, v];
      this.writePoint(this.writeIndex, u, v);
      this.writeIndex = (this.writeIndex + 1) % this.maxPoints;
      // NOTE: with a ring buffer, the line connects wrap-around segments.
      // For a clean trail, prefer to stay under maxPoints per run and
      // call clear() between runs.
    }

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Replace all points at once.
   */
  setAll(points: ReadonlyArray<[number, number]>): void {
    this.pts = points.slice() as [number, number][];
    this.pointCount = Math.min(points.length, this.maxPoints);
    this.writeIndex = this.pointCount % this.maxPoints;

    for (let i = 0; i < this.pointCount; i++) {
      const [u, v] = this.pts[i];
      this.writePoint(i, u, v);
    }

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.pointCount);
  }

  /**
   * Reset: drop all points, start from empty.
   *
   * (Named `reset` rather than `clear` to avoid shadowing
   * `THREE.Object3D.clear`, which removes children and returns `this`.)
   */
  reset(): void {
    this.pts = [];
    this.pointCount = 0;
    this.writeIndex = 0;
    this.geometry.setDrawRange(0, 0);
  }

  private writePoint(slot: number, u: number, v: number): void {
    const p = this.surface.evaluate(u, v);
    const idx = slot * 3;
    this.positionBuffer[idx] = p.x;
    this.positionBuffer[idx + 1] = p.y;
    this.positionBuffer[idx + 2] = p.z;
  }

  /**
   * Re-map every stored point through the current surface. Called by the
   * reactive cascade when the surface changes.
   */
  rebuild(): void {
    const n = Math.min(this.pts.length, this.maxPoints);
    for (let i = 0; i < n; i++) {
      const [u, v] = this.pts[i];
      this.writePoint(i, u, v);
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.pointCount);
  }

  update(): void {
    const mat = this.material as THREE.LineBasicMaterial;
    mat.color.set(this.color);
    mat.linewidth = this.lineWidth;
    mat.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    this.params.dispose();
  }
}
