/**
 * n-D manifolds.
 *
 * See `README.md` for design notes and the planning doc
 * `docs/planning/nd-generalization.md` for the phased rollout.
 *
 * Phase 1: primitives only. Surfaces / vector fields / geodesics still use
 * their own 2D types. Phase 2 retires `MetricPatch` and has `Surface`
 * implement `Manifold` with `dim = 2`.
 */

export type { Manifold, ManifoldDomain } from './types';

export { Euclidean } from './Euclidean';
export type { EuclideanOptions } from './Euclidean';

export { christoffelFromMetric, chrIndex } from './christoffel';
