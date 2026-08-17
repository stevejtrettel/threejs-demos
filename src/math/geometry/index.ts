/**
 * Planar geometry — small, general computational-geometry tools.
 */
export type { Vec2 } from './types';
export { convexHull } from './convexHull';
export { polygonArea } from './polygonArea';
export { marchingSquares } from './marchingSquares';
export type { ScalarGrid, Segment } from './marchingSquares';
export { chainSegments } from './chainSegments';
export type { ChainSegmentsOptions } from './chainSegments';
