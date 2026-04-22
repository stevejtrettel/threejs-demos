/**
 * Exterior derivative of a 0-form (scalar field): `df`.
 *
 * On coordinates `x^i`, `df = (∂f/∂x^i) dx^i`, so the 1-form's components
 * are the scalar's partial derivatives. This is the simplest case of the
 * general exterior derivative; the general case for 1-forms → 2-forms lives
 * in `./d.ts`.
 */

import type { DifferentiableScalarField } from '@/math/functions/types';
import type { OneForm } from './types';

/**
 * Wrap a scalar field's gradient as a 1-form.
 *
 * The returned `OneForm` shares its `dim` with the scalar field and calls
 * through to `computePartials` on every evaluation — no caching, no
 * allocation beyond what the scalar field itself does.
 */
export class FromGradient implements OneForm {
  readonly dim: number;
  private readonly scalar: DifferentiableScalarField;

  constructor(scalar: DifferentiableScalarField) {
    this.dim = scalar.dim;
    this.scalar = scalar;
  }

  evaluate(p: number[]): Float64Array {
    return this.scalar.computePartials(p);
  }
}
