/**
 * Vector field types and interfaces
 *
 * A vector field is a section of the tangent bundle: at each point of a
 * 2D coordinate patch it assigns a tangent vector `(du/dt, dv/dt)`. Integrating
 * it produces a flow line (integral curve).
 *
 * Currently 2D to match the rest of the library. The whole set of 2D-specific
 * interfaces (`FirstFundamentalForm`, `TangentVector`, `VectorField`) will be
 * generalized to n-D in a single cross-cutting sweep later — see
 * `docs/planning/vector-fields-and-flows.md`.
 */

import type { SurfaceDomain } from '@/math/surfaces/types';
import type { BoundaryEdge } from '@/math/geodesics/types';

/**
 * A vector field on a 2D coordinate patch.
 *
 * Intrinsic: lives on a parameter domain, knows nothing about any 3D
 * embedding. Composes with any `Surface` or `MetricPatch` sharing its domain.
 *
 * The optional time argument covers both autonomous fields (most of them —
 * ignore `t`) and non-autonomous fields (time-dependent forcing). Callers
 * that don't need time should just omit it when evaluating.
 */
export interface VectorField {
  /**
   * Domain of definition (same shape as `Surface.getDomain`).
   */
  getDomain(): SurfaceDomain;

  /**
   * Vector at `(u, v)`, optionally at time `t`.
   *
   * @returns `[du/dt, dv/dt]` in parameter-space coordinates
   */
  evaluate(u: number, v: number, t?: number): [number, number];
}

/**
 * Flow state — just the position on the patch plus current time.
 *
 * Flows are first-order ODEs, so the state is the point itself (no separate
 * velocity component, unlike `TangentVector` for geodesics).
 */
export interface FlowState {
  position: [number, number];
  t: number;
}

/**
 * Result of a bounded flow step, analogous to `BoundedIntegrationResult` in
 * `math/geodesics/types`.
 */
export interface BoundedFlowResult {
  state: FlowState;
  hitBoundary: boolean;
  boundaryEdge?: BoundaryEdge;
  stepFraction?: number;
}
