import * as THREE from 'three';
import type { Surface } from '@/math/surfaces/types';
import { CurveTube } from '@/math/curves/CurveTube';
import { StreamPoints } from './StreamPoints';
import { CurveOnSurface } from './CurveOnSurface';

export interface StreamTubeOptions {
  maxPoints?: number;
  radius?: number;
  radialSegments?: number;
  tubularSegments?: number;
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
}

/**
 * StreamTube — ergonomic wrapper for the common "streaming trail on a
 * single surface, rendered as a tube" case.
 *
 * Internally composes `StreamPoints` + `CurveOnSurface` + `CurveTube`.
 * For multi-surface streaming, use those primitives directly:
 *
 * ```ts
 * const pts = new StreamPoints({ maxPoints: 5000 });
 * scene.add(new CurveTube({ curve: new CurveOnSurface(pts, graph).curve, ... }));
 * scene.add(new CurveTube({ curve: new CurveOnSurface(pts, flat ).curve, ... }));
 * // animate: pts.push(u, v);  // both tubes update
 * ```
 *
 * @example
 *   const trail = new StreamTube(surface, { maxPoints: 5000, radius: 0.12, color: 0xff5522 });
 *   scene.add(trail);
 *   // in animate:
 *   trail.push(u, v);
 */
export class StreamTube extends THREE.Group {
  private readonly pts: StreamPoints;
  private readonly tube: CurveTube;

  constructor(surface: Surface, options: StreamTubeOptions = {}) {
    super();

    this.pts = new StreamPoints({ maxPoints: options.maxPoints ?? 1000 });
    const lifted = new CurveOnSurface(this.pts, surface);

    this.tube = new CurveTube({
      curve: lifted.curve,
      radius: options.radius ?? 0.05,
      radialSegments: options.radialSegments ?? 6,
      tubularSegments: options.tubularSegments ?? (options.maxPoints ?? 1000),
      showEndpoints: false,
      color: options.color ?? 0xff5522,
      roughness: options.roughness ?? 0.35,
      metalness: options.metalness ?? 0,
    });
    this.tube.visible = false;
    this.add(this.tube);
  }

  push(u: number, v: number): void {
    this.pts.push(u, v);
    this.tube.visible = this.pts.getPoints().length >= 2;
  }

  setAll(points: ReadonlyArray<readonly [number, number]>): void {
    this.pts.setAll(points);
    this.tube.visible = this.pts.getPoints().length >= 2;
  }

  reset(): void {
    this.pts.reset();
    this.tube.visible = false;
  }
}
