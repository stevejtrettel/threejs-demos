/**
 * CP2PointCloud — scene component for a dense cloud of points in CP^2.
 *
 * Pattern matches `src/math/curves/CurveLine`, `src/math/surfaces/SurfaceMesh`:
 * extends a THREE.js scene object, uses the Params system for reactive visual
 * configuration (opacity, weights), and exposes imperative methods for the
 * data and the per-frame rotation:
 *
 *   const cloud = new CP2PointCloud({ opacity: 0.7 });
 *   cloud.setPoints(samples);     // when (f, g) changes
 *   cloud.project(g);             // each frame from the animate callback
 *
 * Coloring: every vertex's hue is the gauge-invariant phase arg(g·p_Z / g·p_X)
 * — one of the angles the moment map throws away. Where the projection is
 * multi-sheeted the colors stack visibly.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Updatable } from '@/types';
import type { CP2Point } from './point';
import type { Mat3C } from './u3';
import { applyMat3C } from './u3';
import { phase01, hueToRgb } from './phaseColor';
import { toricProjection, type CP2Projection } from './projections';

export interface CP2PointCloudOptions {
  /** Projection from CP^2 to R^3. Default: toric/moment-map for CP^2. */
  projection?: CP2Projection;
  /** Material opacity (default 0.7). */
  opacity?: number;
  /**
   * Override the default per-vertex coloring. Receives the rotated CP^2 point
   * and writes (r, g, b) into `out[off..off+2]`. Default uses phase01 + hueToRgb.
   */
  colorFn?: (gp: CP2Point, out: Float32Array, off: number) => void;
}

function defaultColorFn(gp: CP2Point, out: Float32Array, off: number): void {
  hueToRgb(phase01(gp[2], gp[0]), out, off);
}

export class CP2PointCloud extends THREE.Points implements Parametric, Updatable {
  readonly params = new Params(this);

  declare opacity: number;

  private cloudData: CP2Point[] = [];
  private positions = new Float32Array(0);
  private colors = new Float32Array(0);
  private colorFn: (gp: CP2Point, out: Float32Array, off: number) => void;
  private projection: CP2Projection;

  constructor(opts: CP2PointCloudOptions = {}) {
    super();

    this.material = new THREE.PointsMaterial({
      size: 0.004,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });

    this.colorFn = opts.colorFn ?? defaultColorFn;
    this.projection = opts.projection ?? toricProjection();

    this.params.define('opacity', opts.opacity ?? 0.7, { triggers: 'update' });

    this.update();
  }

  /** Swap the projection function. Takes effect on the next `project(g)` call. */
  setProjection(projection: CP2Projection): void {
    this.projection = projection;
  }

  /**
   * Replace the underlying point set. Resizes buffers and adapts point size
   * (~ 1/√N) so denser clouds stay crisp instead of muddy.
   */
  setPoints(cloud: CP2Point[]): void {
    this.cloudData = cloud;
    this.positions = new Float32Array(cloud.length * 3);
    this.colors = new Float32Array(cloud.length * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.dispose();
    this.geometry = geom;
    (this.material as THREE.PointsMaterial).size = Math.min(
      0.006,
      Math.max(0.0012, 0.15 / Math.sqrt(Math.max(1, cloud.length))),
    );
  }

  /**
   * Apply rotation `g` to every cloud point, project through the (weighted)
   * moment map, and write into the position and color buffers. Call from an
   * animate callback once per frame.
   */
  project(g: Mat3C): void {
    const pts = this.cloudData;
    const positions = this.positions;
    const colors = this.colors;
    const proj = this.projection;
    for (let i = 0; i < pts.length; i++) {
      const gp = applyMat3C(g, pts[i]);
      proj(gp, positions, 3 * i);
      this.colorFn(gp, colors, 3 * i);
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  update(): void {
    (this.material as THREE.PointsMaterial).opacity = this.opacity;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    this.params.dispose();
  }
}
