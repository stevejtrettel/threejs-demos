/**
 * Curves module
 *
 * Tools for creating and rendering 1D manifolds in 3D space.
 */

// Types
export * from './types';

// Curve implementations
export { NumericalCurve } from './NumericalCurve';
export type { NumericalCurveOptions } from './NumericalCurve';
export { ParametricCurve } from './ParametricCurve';
export type { ParametricCurveOptions, Parameterization } from './ParametricCurve';

// Builders
export { buildTubeGeometry } from './buildTubeGeometry';
export type { BuildTubeGeometryOptions } from './buildTubeGeometry';

// Components
export { CurveTube } from './CurveTube';
export type { CurveTubeOptions } from './CurveTube';

// Utilities
export * from './smoothCurve';
