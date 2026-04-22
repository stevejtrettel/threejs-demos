/**
 * Interior product `ι_X ω` — contracting a form with a vector field.
 *
 * For a 1-form `α` and vector field `X`:
 *   ι_X α = α(X) = α_i X^i     (scalar, i.e. a 0-form)
 *
 * For a 2-form `ω` and vector field `X`:
 *   (ι_X ω)_j = ω_ij X^i       (a 1-form)
 *
 * These are the two cases we need for Hamiltonian mechanics:
 * `ι_{X_H} ω = dH` defines the Hamiltonian vector field.
 */

import type { VectorField } from '@/math/vectorfields';
import type { OneForm, TwoForm } from './types';

/**
 * `ι_X α` of a 1-form against a vector field. Returns a scalar function
 * of the point (and optional time).
 */
export function interiorOneForm(
  X: VectorField,
  alpha: OneForm,
): (p: number[], t?: number) => number {
  if (X.dim !== alpha.dim) {
    throw new Error(`interiorOneForm: dim mismatch ${X.dim} vs ${alpha.dim}`);
  }
  const n = X.dim;
  return (p, t) => {
    const v = X.evaluate(p, t);
    const a = alpha.evaluate(p);
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * v[i];
    return s;
  };
}

/**
 * `ι_X ω` of a 2-form against a vector field. Returns a 1-form.
 *
 * `(ι_X ω)_j = Σ_i ω_ij X^i` — contraction on the first index.
 */
export function interiorTwoForm(X: VectorField, omega: TwoForm): OneForm {
  if (X.dim !== omega.dim) {
    throw new Error(`interiorTwoForm: dim mismatch ${X.dim} vs ${omega.dim}`);
  }
  const n = X.dim;
  return {
    dim: n,
    evaluate(p: number[]): Float64Array {
      const v = X.evaluate(p);
      const w = omega.evaluate(p).data;
      const out = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += w[i * n + j] * v[i];
        out[j] = s;
      }
      return out;
    },
  };
}
