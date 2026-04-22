/**
 * Patch curves — curves in a 2D coordinate patch.
 *
 * A `PatchCurve` is any object that produces a list of `(u, v)` points.
 * The adapter `CurveOnSurface` maps those through a `Surface` into a 3D
 * `NumericalCurve` that existing renderers (`CurveTube`, `CurveLine`)
 * consume.
 */

import type { Params } from '@/Params';

export interface PatchCurve {
  /**
   * Current list of `(u, v)` points. Called by the reactive cascade;
   * topological ordering guarantees the list is fresh whenever a
   * renderer pulls it.
   */
  getPoints(): ReadonlyArray<[number, number]>;

  /**
   * `Params` for reactive wiring. Consumers `dependOn(curve)` so they
   * rebuild when the point list changes.
   */
  readonly params: Params;
}
