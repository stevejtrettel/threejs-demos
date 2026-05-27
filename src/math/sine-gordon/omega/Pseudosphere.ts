/**
 * Sine-Gordon 1-soliton.
 *
 *   ω(u, v) = 4 arctan( exp(u + v) )
 *
 * Reconstructs (up to rigid motion) the classical pseudosphere of
 * revolution. The geometrically meaningful range is ω ∈ (0, π),
 * corresponding to u + v < 0; the locus u + v = 0 maps to the
 * cuspidal-edge equator. ω depends on u and v only through s = u + v,
 * so ω_u = ω_v = 2 sech s.
 */

import {
  ScalarField2D,
  type SurfaceDomainLite,
  type Hessian2D,
} from '@/math/functions/ScalarField2D';

export class PseudosphereOmega extends ScalarField2D {
  evaluateAt(u: number, v: number): number {
    return 4 * Math.atan(Math.exp(u + v));
  }

  partialsAt(u: number, v: number): [number, number] {
    // 2 sech(u + v), but written without overflowing for moderately
    // large |u + v| (sech via 2/(e^s + e^{-s})).
    const s = u + v;
    const e1 = Math.exp(s);
    const e2 = Math.exp(-s);
    const wu = 2 * (2 / (e1 + e2));
    return [wu, wu]; // ω_u = ω_v
  }

  hessianAt(u: number, v: number): Hessian2D {
    // ω is a function of s = u + v alone, so ω_uu = ω_uv = ω_vv.
    // d/ds [2 sech s] = -2 sech s · tanh s.
    const s = u + v;
    const e1 = Math.exp(s);
    const e2 = Math.exp(-s);
    const sech = 2 / (e1 + e2);
    const tanh = (e1 - e2) / (e1 + e2);
    const h = -2 * sech * tanh;
    return [h, h, h];
  }

  domain2D(): SurfaceDomainLite {
    // A conservative rectangle with u + v ≤ -0.1, keeping ω comfortably
    // below π. Callers typically pass their own bounds to the integrator.
    return { uMin: -3, uMax: -0.05, vMin: -3, vMax: -0.05 };
  }
}
