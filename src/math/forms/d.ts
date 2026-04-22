/**
 * Exterior derivative of a 1-form.
 *
 * For a 1-form `α = α_i dx^i`:
 *   (dα)_ij = ∂α_i/∂x^j − ∂α_j/∂x^i
 *
 * The result is a 2-form. The partials are computed by central finite
 * differences on the 1-form's `evaluate`, so no analytic interface is
 * required; pass any `OneForm`.
 *
 * For the 0-form case (exterior derivative of a scalar field giving a
 * 1-form), use `FromGradient` — that's just the gradient.
 */

import { Matrix } from '@/math/linear-algebra';
import type { OneForm, TwoForm } from './types';

const DEFAULT_H = 1e-4;

/**
 * Exterior derivative `dα` of a 1-form.
 *
 * Accurate to O(h²). For points near singularities of `α` where finite
 * differences are unstable, provide an analytic `TwoForm` directly.
 */
export function d(alpha: OneForm, h: number = DEFAULT_H): TwoForm {
  const n = alpha.dim;
  return {
    dim: n,
    evaluate(p: number[]): Matrix {
      // Partials ∂α_i/∂x^j, computed by perturbing p in each coordinate.
      // We sample α once per coordinate direction (2 samples per coord) to
      // build the full Jacobian.
      const jac: number[][] = new Array(n); // jac[j][i] = ∂α_i/∂x^j
      const pPlus = p.slice();
      const pMinus = p.slice();
      const inv2h = 1 / (2 * h);

      for (let j = 0; j < n; j++) {
        pPlus[j] = p[j] + h;
        pMinus[j] = p[j] - h;
        const ap = alpha.evaluate(pPlus);
        const am = alpha.evaluate(pMinus);
        pPlus[j] = p[j];
        pMinus[j] = p[j];

        const col = new Array(n);
        for (let i = 0; i < n; i++) col[i] = (ap[i] - am[i]) * inv2h;
        jac[j] = col;
      }

      // (dα)_ij = ∂α_j/∂x^i − ∂α_i/∂x^j.
      // Above we built jac[k][l] = ∂α_l/∂x^k (component l perturbed along
      // coordinate k), so ∂α_j/∂x^i = jac[i][j] and ∂α_i/∂x^j = jac[j][i].
      const out = new Matrix(n, n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          out.data[i * n + j] = jac[i][j] - jac[j][i];
        }
      }
      return out;
    },
  };
}
