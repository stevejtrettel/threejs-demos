/**
 * Patch curves — curves in a 2D coordinate patch.
 *
 * A `PatchCurve` is any object that produces a list of `(u, v)` points in
 * some domain. It's the mathematical object; rendering components (like
 * `CurveLine`) project each `(u, v)` through a `Surface` to get a 3D
 * polyline.
 *
 * Producers:
 *   - `FlowCurve`     — integrates a `VectorField`
 *   - `Trail` / `TrailTube` — user-managed streaming buffer (also implement
 *                             `PatchCurve` internally, though they are also
 *                             their own renderer, so you typically don't
 *                             handle them via this interface)
 *   - future: `GeodesicCurve`, parametric curves in patch coordinates, etc.
 */

import type { SurfaceDomain } from '@/math/surfaces/types';
import type { Params } from '@/Params';

export interface PatchCurve {
  /**
   * Parameter-domain bounds. Consumers use this to sanity-check that a
   * renderer's surface covers the same domain as the curve's producer.
   */
  getDomain(): SurfaceDomain;

  /**
   * Current list of `(u, v)` points. Always fresh when called after a
   * reactive cascade (topological ordering in `Params` guarantees sources
   * have been rebuilt before their dependents).
   */
  getPoints(): ReadonlyArray<[number, number]>;

  /**
   * `Params` for reactive wiring. Renderers `dependOn(curve)` so they
   * rebuild when the curve changes.
   */
  readonly params: Params;
}
