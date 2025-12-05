/**
 * Domain module - Parameter spaces for parametric objects
 *
 * Domains define the valid parameter space for curves, surfaces, and volumes.
 * They handle:
 * - Containment testing
 * - Boundary conditions (open, closed, periodic)
 * - Uniform sampling
 * - Coordinate wrapping/clamping
 */

export * from './types';
export { Interval1D } from './Interval1D';
export { Rectangle2D } from './Rectangle2D';
export { Disk2D } from './Disk2D';
export { Implicit2D } from './Implicit2D';
export { Box3D } from './Box3D';
