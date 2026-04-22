/**
 * Abstract base class for authoring 2D scalar fields.
 *
 * The n-D `DifferentiableScalarField` interface uses `evaluate(p)` /
 * `computePartials(p)` / `computeHessian(p)` with array-backed storage. For
 * 2D math that's extra ceremony — subclass this and write your formulas in
 * `(u, v)` coordinates with tuple returns; the base handles the n-D shape.
 *
 * Use this for all 2D scalar fields unless you specifically need the n-D
 * interface directly.
 *
 * @example
 *   class Ripple extends ScalarField2D {
 *     evaluateAt(u: number, v: number): number {
 *       return Math.sin(u * u + v * v);
 *     }
 *     partialsAt(u: number, v: number): [number, number] {
 *       const r2 = u * u + v * v;
 *       const c = 2 * Math.cos(r2);
 *       return [c * u, c * v];
 *     }
 *     domain2D() {
 *       return { uMin: -3, uMax: 3, vMin: -3, vMax: 3 };
 *     }
 *   }
 */

import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';
import type { DifferentiableScalarField } from './types';

export interface SurfaceDomainLite {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Hessian shorthand: `[∂²f/∂u², ∂²f/∂u∂v, ∂²f/∂v²]`. */
export type Hessian2D = [number, number, number];

export abstract class ScalarField2D implements DifferentiableScalarField {
  readonly dim = 2;

  /** Scalar value at (u, v). */
  abstract evaluateAt(u: number, v: number): number;

  /** Gradient `[∂f/∂u, ∂f/∂v]` at (u, v). */
  abstract partialsAt(u: number, v: number): [number, number];

  /** Parameter-space bounds, named-field form. */
  abstract domain2D(): SurfaceDomainLite;

  /**
   * Optional analytic Hessian `[duu, duv, dvv]`. When provided, `computeHessian`
   * returns a symmetric `Matrix`; when absent, `computeHessian` is omitted
   * from the instance (consumers treat it as "not available").
   */
  hessianAt?(u: number, v: number): Hessian2D;

  // n-D interface glue below — subclasses don't touch these.

  evaluate(p: number[]): number {
    return this.evaluateAt(p[0], p[1]);
  }

  computePartials(p: number[]): Float64Array {
    const [du, dv] = this.partialsAt(p[0], p[1]);
    const out = new Float64Array(2);
    out[0] = du;
    out[1] = dv;
    return out;
  }

  computeHessian(p: number[]): Matrix {
    if (!this.hessianAt) {
      throw new Error(
        'ScalarField2D: Hessian not available — override hessianAt on the subclass.',
      );
    }
    const [duu, duv, dvv] = this.hessianAt(p[0], p[1]);
    const H = new Matrix(2, 2);
    H.data[0] = duu; H.data[1] = duv;
    H.data[2] = duv; H.data[3] = dvv;
    return H;
  }

  getDomain(): ManifoldDomain {
    const d = this.domain2D();
    return { min: [d.uMin, d.vMin], max: [d.uMax, d.vMax] };
  }
}
