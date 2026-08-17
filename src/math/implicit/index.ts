/**
 * Implicitly-defined surfaces — level sets, retraction, and constrained descent.
 */
export { ImplicitSurface, ImplicitSurface3D } from './ImplicitSurface';
export type { ImplicitSurfaceOptions, ImplicitSurface3DOptions } from './ImplicitSurface';
export { projectedGradientFlow, projectedGradientStep } from './projectedGradientFlow';
export type {
  ProjectedGradientOptions,
  ProjectedGradientStep,
  ProjectedGradientResult,
} from './projectedGradientFlow';
