/**
 * Math Library - Core mathematical primitives
 *
 * This is the stable foundation for mathematical visualization.
 * Only reusable, well-tested primitives belong here.
 */

// Points
export * from './points';

// Curves
export * from './curves';

// Surfaces
export * from './surfaces';

// Differential Geometry
export * from './diffgeo';

// Algorithms
export * from './algorithms';

// Visualization helpers
export * from './viz';

// Temporary: Original code being refactored
// TODO: Remove these exports once migration is complete
export * from './orig/objects';
export * from './orig/riemannian';
export * from './orig/diffgeo-domain';
export * from './orig/helpers';
export * from './orig/algorithms';
