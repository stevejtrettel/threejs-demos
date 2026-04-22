/**
 * Vector field types and interfaces (n-D).
 *
 * A vector field is a section of the tangent bundle: at each point of a
 * dim-D manifold it assigns a tangent vector. Integrating gives a flow
 * line (integral curve).
 *
 * 2D/3D authoring ergonomics will be restored later via `Name2D` helper
 * classes; for now all consumers write n-D code directly.
 */

import type { ManifoldDomain } from '@/math/manifolds';
import type { BoundaryEdge } from '@/math/geodesics/types';

/**
 * A vector field on an n-D manifold.
 *
 * `evaluate(p, t?)` returns a length-`dim` `Float64Array` — the tangent
 * vector at `p`, optionally at time `t`. Callers that don't need time
 * should omit it.
 */
export interface VectorField {
  readonly dim: number;

  /** Parameter-space bounds. */
  getDomain(): ManifoldDomain;

  /**
   * Tangent vector at `p`, optionally at time `t`.
   *
   * @returns length-`dim` `Float64Array`
   */
  evaluate(p: number[], t?: number): Float64Array;
}

/**
 * Flow state for 2D flow integration.
 *
 * 2D-locked: the current `FlowIntegrator` and its trail stack (`StreamPoints`,
 * etc.) work in 2D parameter space. A future sweep can generalize to
 * length-`dim` positions if a higher-dim flow demo demands it.
 */
export interface FlowState {
  position: [number, number];
  t: number;
}

export interface BoundedFlowResult {
  state: FlowState;
  hitBoundary: boolean;
  boundaryEdge?: BoundaryEdge;
  stepFraction?: number;
}
