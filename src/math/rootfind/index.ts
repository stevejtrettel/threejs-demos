/**
 * Root finding — Newton's method and the least-squares objective.
 */
export type { DifferentiableMap, ScalarObjective } from './types';
export { newton, newtonStep } from './newton';
export type { NewtonOptions, NewtonResult } from './newton';
export { leastSquaresObjective, residualNorm } from './leastSquares';
