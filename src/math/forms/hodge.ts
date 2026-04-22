/**
 * Hodge star operator, dimension-indexed.
 *
 * The Hodge star `*: Ω^k → Ω^{n−k}` depends on the manifold's metric and
 * orientation. On dim-n oriented Riemannian manifolds with metric `g`:
 *
 *   (*α)_{i_1..i_{n−k}} = √|det g| · ε_{j_1..j_k i_1..i_{n−k}} · g^{j_1 l_1} · ... · g^{j_k l_k} · α_{l_1..l_k}
 *
 * For the cases we actually need (2D: 1-forms → 1-forms, 2-forms → 0-forms;
 * higher-dim symplectic maybe later), we implement them directly — a
 * generic rank-k machinery isn't warranted yet.
 *
 * Conventions:
 *   - Positive orientation w.r.t. the natural coordinate volume form `du ∧ dv` (2D)
 *   - Riemannian (not pseudo-Riemannian): `det g > 0` assumed
 */

import type { Manifold } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';
import type { OneForm, TwoForm } from './types';

/**
 * 2D Hodge star on 1-forms: `*α` is a 1-form.
 *
 * In 2D Riemannian geometry with positive orientation `du ∧ dv`, `*`
 * rotates 1-forms by 90° counterclockwise (w.r.t. the metric). On flat
 * ℝ², `*du = dv`, `*dv = −du`.
 *
 * Standard formula, `(n−1)! = 1`:
 *   (*α)_j = √|det g| · ε_{ij} · g^{ik} · α_k
 *
 * In 2D: expanding with ε_{01} = +1, ε_{10} = −1 (and the sums over i, k):
 *   (*α)_0 = −√det · (g^{10} α_0 + g^{11} α_1)
 *   (*α)_1 =  √det · (g^{00} α_0 + g^{01} α_1)
 *
 * which reduces on flat ℝ² to the familiar `*du = dv, *dv = −du`.
 */
export function hodge2D_OneForm(patch: Manifold, alpha: OneForm): OneForm {
  if (patch.dim !== 2 || alpha.dim !== 2) {
    throw new Error(`hodge2D_OneForm: requires dim=2, got patch=${patch.dim} alpha=${alpha.dim}`);
  }
  return {
    dim: 2,
    evaluate(p: number[]): Float64Array {
      const g = patch.computeMetric(p).data;
      const E = g[0], F = g[1], G = g[3];
      const det = E * G - F * F;
      const sqrtDet = Math.sqrt(det);
      // Inverse metric g^{ij}
      const g00 =  G / det;
      const g01 = -F / det;
      const g11 =  E / det;

      const a = alpha.evaluate(p);
      const out = new Float64Array(2);
      out[0] = -sqrtDet * (g01 * a[0] + g11 * a[1]);
      out[1] =  sqrtDet * (g00 * a[0] + g01 * a[1]);
      return out;
    },
  };
}

/**
 * 2D Hodge star on 2-forms: `*ω` is a 0-form (scalar).
 *
 * For a 2-form `ω = ω_{01} du ∧ dv` (stored antisymmetrically as `data[1] = ω_{01}`):
 *   *ω = ω_{01} / √(det g)
 */
export function hodge2D_TwoForm(
  patch: Manifold,
  omega: TwoForm,
): (p: number[]) => number {
  if (patch.dim !== 2 || omega.dim !== 2) {
    throw new Error(`hodge2D_TwoForm: requires dim=2, got patch=${patch.dim} omega=${omega.dim}`);
  }
  return (p: number[]): number => {
    const g = patch.computeMetric(p).data;
    const det = g[0] * g[3] - g[1] * g[1];
    const sqrtDet = Math.sqrt(det);
    const w = omega.evaluate(p).data;
    return w[1] / sqrtDet;
  };
}

/**
 * Build a `TwoForm` from a scalar `f(p)` interpreted as the coefficient of
 * the volume form: `f · du ∧ dv` in 2D.
 *
 * Useful for the inverse of `hodge2D_TwoForm`: `**f = f` in 2D Riemannian
 * (`*` on 2-forms and on 0-forms satisfies `** = +1` in even-dim Riemannian).
 */
export function volumeTwoForm2D(
  dim: 2,
  coefficient: (p: number[]) => number,
): TwoForm {
  void dim;
  return {
    dim: 2,
    evaluate(p: number[]): Matrix {
      const c = coefficient(p);
      const m = new Matrix(2, 2);
      m.data[1] =  c;
      m.data[2] = -c;
      return m;
    },
  };
}
