/**
 * Patch curves — curves in a 2D coordinate patch, plus renderers that
 * draw them on arbitrary surfaces.
 *
 * Two common shapes:
 *
 *   Streaming  — `Trail` / `TrailTube`. One surface, push `(u, v)` per
 *                frame, trail grows. Reset with `clear()`.
 *
 *   Precomputed — `FlowCurve` + `CurveLine`. One integration, one or more
 *                 renderings (draw the same trajectory on several
 *                 surfaces simultaneously).
 */

export type { PatchCurve } from './types';

export { Trail } from './Trail';
export type { TrailOptions } from './Trail';
export { TrailTube } from './TrailTube';
export type { TrailTubeOptions } from './TrailTube';

export { FlowCurve } from './FlowCurve';
export type { FlowCurveOptions } from './FlowCurve';

export { CurveLine } from './CurveLine';
export type { CurveLineOptions } from './CurveLine';
