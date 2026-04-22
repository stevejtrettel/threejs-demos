import * as THREE from 'three';
import type { Surface } from '@/math/surfaces/types';
import { CurveLine } from '@/math/curves/CurveLine';
import { StreamPoints } from './StreamPoints';
import { CurveOnSurface } from './CurveOnSurface';

export interface StreamLineOptions {
  maxPoints?: number;
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
  segments?: number;
}

/**
 * StreamLine — ergonomic wrapper for the common "streaming trail on a
 * single surface, rendered as a line" case.
 *
 * Internally composes `StreamPoints` + `CurveOnSurface` + `CurveLine`.
 * For multi-surface streaming or other renderer choices, use those
 * primitives directly.
 *
 * @example
 *   const trail = new StreamLine(surface, { maxPoints: 5000, color: 0xff5522 });
 *   scene.add(trail);
 *   // in animate:
 *   trail.push(u, v);
 */
export class StreamLine extends THREE.Group {
  private readonly pts: StreamPoints;
  private readonly line: CurveLine;

  constructor(surface: Surface, options: StreamLineOptions = {}) {
    super();

    this.pts = new StreamPoints({ maxPoints: options.maxPoints ?? 1000 });
    const lifted = new CurveOnSurface(this.pts, surface);

    this.line = new CurveLine({
      curve: lifted.curve,
      color: options.color ?? 0xff5522,
      lineWidth: options.lineWidth ?? 1,
      segments: options.segments ?? (options.maxPoints ?? 1000),
    });
    this.line.visible = false;
    this.add(this.line);
  }

  push(u: number, v: number): void {
    this.pts.push(u, v);
    this.line.visible = this.pts.getPoints().length >= 2;
  }

  setAll(points: ReadonlyArray<readonly [number, number]>): void {
    this.pts.setAll(points);
    this.line.visible = this.pts.getPoints().length >= 2;
  }

  reset(): void {
    this.pts.reset();
    this.line.visible = false;
  }
}
