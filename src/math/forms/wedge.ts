/**
 * Wedge product of 1-forms.
 *
 * For 1-forms `α` and `β`:
 *   (α ∧ β)_ij = α_i β_j − α_j β_i
 *
 * The result is a 2-form (antisymmetric rank-2). Only the 1∧1 case is
 * provided here; higher wedges (1∧2, 2∧2) haven't been needed yet and
 * would live in their own files when demanded.
 */

import { Matrix } from '@/math/linear-algebra';
import type { OneForm, TwoForm } from './types';

/**
 * `α ∧ β` of two 1-forms. The returned `TwoForm` evaluates both inputs on
 * every call — no caching.
 */
export function wedge(alpha: OneForm, beta: OneForm): TwoForm {
  if (alpha.dim !== beta.dim) {
    throw new Error(`wedge: dim mismatch ${alpha.dim} vs ${beta.dim}`);
  }
  const n = alpha.dim;

  return {
    dim: n,
    evaluate(p: number[]): Matrix {
      const a = alpha.evaluate(p);
      const b = beta.evaluate(p);
      const out = new Matrix(n, n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          out.data[i * n + j] = a[i] * b[j] - a[j] * b[i];
        }
      }
      return out;
    },
  };
}
