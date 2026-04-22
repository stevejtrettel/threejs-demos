/**
 * Patch curves — curves in a 2D coordinate patch, with decomposed
 * producer → adapter → renderer architecture.
 *
 *   Producers (store `(u, v)[]`):
 *     - `FlowCurve`      — integrates a VectorField
 *     - `StreamPoints`   — user-pushable list (ring buffer)
 *     - (future: GeodesicCurve, etc.)
 *
 *   Adapter (maps through a surface):
 *     - `CurveOnSurface` — exposes `.curve: NumericalCurve`
 *
 *   Renderers: existing `CurveTube` + `CurveLine` from `math/curves/`.
 *
 *   Ergonomic wrappers for the common single-surface streaming case:
 *     - `StreamLine`     — line rendering
 *     - `StreamTube`     — tube rendering
 */

export type { PatchCurve } from './types';

export { FlowCurve } from './FlowCurve';
export type { FlowCurveOptions } from './FlowCurve';

export { StreamPoints } from './StreamPoints';
export type { StreamPointsOptions } from './StreamPoints';

export { CurveOnSurface } from './CurveOnSurface';
export type { CurveOnSurfaceOptions } from './CurveOnSurface';

export { StreamLine } from './StreamLine';
export type { StreamLineOptions } from './StreamLine';

export { StreamTube } from './StreamTube';
export type { StreamTubeOptions } from './StreamTube';
