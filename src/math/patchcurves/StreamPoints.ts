import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { PatchCurve } from './types';

export interface StreamPointsOptions {
  /**
   * Ring-buffer capacity. After `maxPoints` pushes, the oldest point is
   * discarded when a new one arrives. Default 1000.
   */
  maxPoints?: number;
}

/**
 * StreamPoints — a mutable `PatchCurve` backed by a `(u, v)[]` ring buffer.
 *
 * Own your state externally; call `push(u, v)` each frame. The reactive
 * cascade propagates the change to any `CurveOnSurface` adapter that reads
 * `getPoints()`, which in turn updates downstream renderers.
 *
 * Ring-buffer semantics: when full, the oldest point is dropped and the
 * new one appended, so `getPoints()` always returns points in **logical
 * order** (oldest → newest). This avoids the "seam" artifact a naive ring
 * buffer would produce in downstream line/tube rendering.
 *
 * The shift-on-full is O(N); at 60 fps with 5000 points that's ~300k
 * ops/sec, well inside budget.
 */
export class StreamPoints implements PatchCurve, Parametric {
  readonly params = new Params(this);

  private readonly maxPoints: number;
  private pts: [number, number][] = [];

  /**
   * Monotonic counter bumped whenever the point list changes. Declared
   * through `Params.define` so mutating it fires the reactive cascade.
   * Consumers don't read it — it's purely a trigger.
   */
  declare version: number;

  constructor(options: StreamPointsOptions = {}) {
    this.maxPoints = options.maxPoints ?? 1000;
    this.params.define('version', 0, { triggers: 'rebuild' });
  }

  /**
   * Append one point. Drops the oldest if the buffer is full.
   */
  push(u: number, v: number): void {
    if (this.pts.length >= this.maxPoints) {
      this.pts.shift();
    }
    this.pts.push([u, v]);
    this.bump();
  }

  /**
   * Replace the entire point list. Truncated to `maxPoints` if longer.
   */
  setAll(points: ReadonlyArray<readonly [number, number]>): void {
    const n = Math.min(points.length, this.maxPoints);
    this.pts = new Array(n);
    for (let i = 0; i < n; i++) {
      this.pts[i] = [points[i][0], points[i][1]];
    }
    this.bump();
  }

  /**
   * Drop all points.
   */
  reset(): void {
    this.pts = [];
    this.bump();
  }

  getPoints(): ReadonlyArray<[number, number]> {
    return this.pts;
  }

  private bump(): void {
    // Any assignment to a declared param fires the cascade. Monotonic
    // increment guarantees `oldValue !== newValue` so the setter runs.
    this.version = (this.version + 1) & 0x7fffffff;
  }

  dispose(): void {
    this.params.dispose();
  }
}
