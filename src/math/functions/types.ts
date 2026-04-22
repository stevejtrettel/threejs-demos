/**
 * Scalar-field interfaces.
 *
 * A scalar field is a function from a manifold (represented as a box in
 * parameter space) to the reals. These are the n-D interfaces — consumers
 * that need 2D-specific sugar unpack `[u, v] = p` at the top of their
 * methods.
 *
 * Partials and Hessian are optional because finite-difference fallbacks are
 * available whenever an analytic form isn't provided.
 */

import type { ManifoldDomain } from '@/math/manifolds';
import type { Matrix } from '@/math/linear-algebra';

/**
 * A scalar field `f: Ω ⊂ ℝⁿ → ℝ`.
 */
export interface ScalarField {
  readonly dim: number;
  getDomain(): ManifoldDomain;
  evaluate(p: number[]): number;
}

/**
 * A scalar field with derivative data.
 *
 * `computePartials` is required — that's what distinguishes a differentiable
 * scalar field from a plain one. `computeHessian` is optional; when absent,
 * consumers fall back to central finite differences on `evaluate` (or on
 * `computePartials`).
 */
export interface DifferentiableScalarField extends ScalarField {
  /** ∂f/∂x^i at `p`, returned as a length-`dim` `Float64Array`. */
  computePartials(p: number[]): Float64Array;

  /** Hessian `H_ij = ∂²f / (∂x^i ∂x^j)` at `p`, a symmetric `dim × dim` matrix. */
  computeHessian?(p: number[]): Matrix;
}
