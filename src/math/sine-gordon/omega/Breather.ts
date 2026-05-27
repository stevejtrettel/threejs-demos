/**
 * Sine-Gordon breather: a spatially localized, "time"-periodic solution.
 *
 *   ω(u, v) = 4 arctan( m sin(n(u − v)) / (n cosh(m(u + v))) )
 *
 * with m² + n² = 1, m ∈ (0, 1). The breather is exponentially localized
 * in s = u + v (decay length 1/m) and periodic in t = u − v with period
 * 2π/n. As an immersion, ω passes through 0 and π along its envelope —
 * the integrator still produces a surface there, but with cuspidal-edge
 * folds where the Chebyshev net collapses. That's the geometry of the
 * breather as a K = -1 surface.
 *
 * Reactive: `m` is a param; changing it triggers a rebuild on any
 * `SineGordonSurface` that depends on this field.
 */

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import {
  ScalarField2D,
  type SurfaceDomainLite,
} from '@/math/functions/ScalarField2D';

export class BreatherOmega extends ScalarField2D implements Parametric {
  readonly params = new Params(this);

  declare m: number;

  constructor(options: { m?: number } = {}) {
    super();
    this.params.define('m', options.m ?? 0.5, { triggers: 'rebuild' });
  }

  private mn(): { m: number; n: number } {
    const m = this.m;
    const n = Math.sqrt(Math.max(0, 1 - m * m));
    return { m, n };
  }

  evaluateAt(u: number, v: number): number {
    const { m, n } = this.mn();
    const alpha = n * (u - v);
    const beta = m * (u + v);
    // m sin α / (n cosh β)
    const f = (m * Math.sin(alpha)) / (n * Math.cosh(beta));
    return 4 * Math.atan(f);
  }

  partialsAt(u: number, v: number): [number, number] {
    const { m, n } = this.mn();
    const alpha = n * (u - v);
    const beta = m * (u + v);
    const sech = 1 / Math.cosh(beta);
    const tanh = Math.tanh(beta);
    const sa = Math.sin(alpha);
    const ca = Math.cos(alpha);

    const f = (m * sa * sech) / n;
    //  f_u = A − B,   f_v = −A − B,
    //  A = m cos α · sech β,
    //  B = (m² / n) sin α · tanh β · sech β.
    const A = m * ca * sech;
    const B = ((m * m) / n) * sa * tanh * sech;
    const fu = A - B;
    const fv = -A - B;

    const denom = 4 / (1 + f * f);
    return [fu * denom, fv * denom];
  }

  domain2D(): SurfaceDomainLite {
    return { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };
  }
}
