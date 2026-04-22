import * as THREE from 'three';
import { Params } from '@/Params';
import type { Surface } from '@/math/surfaces/types';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import { CurveTube } from '@/math/curves/CurveTube';

export interface TrailTubeOptions {
  maxPoints?: number;
  radius?: number;
  radialSegments?: number;
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
}

/**
 * TrailTube — streaming tube. Same push-based API as `Trail` but renders
 * a 3D tube (via `CurveTube`) instead of a thin line.
 *
 * Internally: maintains a ring buffer of `(u, v)` points, maps them
 * through the surface, feeds them to a `NumericalCurve` and a `CurveTube`.
 * You don't see any of that — just `push`, `clear`, `setAll`.
 *
 * @example
 *   const trail = new TrailTube(sphere, {
 *     maxPoints: 5000, radius: 0.12, color: 0xff5522,
 *   });
 *   scene.add(trail);
 *
 *   // in animate:
 *   trail.push(phi, t);
 */
export class TrailTube extends THREE.Group {
  readonly params = new Params(this);

  private surface: Surface;
  private readonly maxPoints: number;

  private pts: [number, number][] = [];
  private writeIndex = 0;
  private pointCount = 0;

  private curve: NumericalCurve;
  private tube: CurveTube;

  // Scratch vector3 array reused each frame.
  private vectorBuffer: THREE.Vector3[] = [];

  constructor(surface: Surface, options: TrailTubeOptions = {}) {
    super();

    this.surface = surface;
    this.maxPoints = options.maxPoints ?? 1000;

    // Seed the curve with two coincident points so CatmullRomCurve3 is well-formed.
    this.curve = new NumericalCurve({
      points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1e-6)],
      closed: false,
      curveType: 'centripetal',
      tension: 0.5,
    });

    this.tube = new CurveTube({
      curve: this.curve,
      radius: options.radius ?? 0.05,
      tubularSegments: this.maxPoints,
      radialSegments: options.radialSegments ?? 6,
      showEndpoints: false,
      color: options.color ?? 0xff5522,
      roughness: options.roughness ?? 0.35,
      metalness: options.metalness ?? 0,
    });
    this.tube.visible = false;  // hidden until we have ≥ 2 points
    this.add(this.tube);

    this.params.dependOn(surface);
  }

  /**
   * Append one point.
   */
  push(u: number, v: number): void {
    if (this.pointCount < this.maxPoints) {
      this.pts.push([u, v]);
      this.pointCount++;
    } else {
      this.pts[this.writeIndex] = [u, v];
      this.writeIndex = (this.writeIndex + 1) % this.maxPoints;
    }
    this.syncCurve();
  }

  /**
   * Replace all points at once.
   */
  setAll(points: ReadonlyArray<[number, number]>): void {
    this.pts = points.slice() as [number, number][];
    this.pointCount = Math.min(points.length, this.maxPoints);
    this.writeIndex = this.pointCount % this.maxPoints;
    this.syncCurve();
  }

  /**
   * Reset: drop all points.
   *
   * (Named `reset` rather than `clear` to avoid shadowing
   * `THREE.Object3D.clear`, which removes children and returns `this`.)
   */
  reset(): void {
    this.pts = [];
    this.pointCount = 0;
    this.writeIndex = 0;
    this.tube.visible = false;
  }

  private syncCurve(): void {
    if (this.pointCount < 2) {
      this.tube.visible = false;
      return;
    }

    // Grow the scratch buffer if needed.
    while (this.vectorBuffer.length < this.pointCount) {
      this.vectorBuffer.push(new THREE.Vector3());
    }

    for (let i = 0; i < this.pointCount; i++) {
      const [u, v] = this.pts[i];
      const p = this.surface.evaluate(u, v);
      this.vectorBuffer[i].copy(p);
    }

    // updatePoints takes THREE.Vector3[] — slice reusable buffer to current count.
    this.curve.updatePoints(this.vectorBuffer.slice(0, this.pointCount));
    this.tube.visible = true;
  }

  /**
   * Re-map all points through the current surface. Cascade-triggered when
   * the surface's params change.
   */
  rebuild(): void {
    this.syncCurve();
  }

  dispose(): void {
    this.curve.dispose();
    // CurveTube's dispose is inherited/managed via its own params
    this.params.dispose();
  }
}
