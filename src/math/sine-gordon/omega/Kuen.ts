/**
 * Sine-Gordon 2-soliton (Kuen surface).
 *
 * Derived from the nonlinear superposition principle: applying Bäcklund
 * transformations B_{λ₁} and B_{λ₂} to the trivial solution ω₀ = 0 gives
 * two 1-soliton solutions ω₁, ω₂, and their commutative combination is
 *
 *   ω(u, v) = 4 arctan( A · (e^ξ₁ − e^ξ₂) / (1 + e^{ξ₁ + ξ₂}) ),
 *
 * where  A = (λ₁ + λ₂) / (λ₁ − λ₂)  and  ξᵢ = λᵢ u + v / λᵢ.
 *
 * For generic spectral parameters λ₁ ≠ λ₂ (both positive), this gives
 * the famous Kuen surface — a twisted K = -1 immersion with no rotational
 * symmetry and cuspidal edges where ω passes through 0 or π.
 *
 * Reactive: λ₁ and λ₂ are params; changing either triggers a rebuild on
 * any `SineGordonSurface` that depends on this field.
 */

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import {
  ScalarField2D,
  type SurfaceDomainLite,
} from '@/math/functions/ScalarField2D';

export class Kuen2Soliton extends ScalarField2D implements Parametric {
  readonly params = new Params(this);

  declare lambda1: number;
  declare lambda2: number;

  constructor(options: { lambda1?: number; lambda2?: number } = {}) {
    super();
    this.params
      .define('lambda1', options.lambda1 ?? 1.0, { triggers: 'rebuild' })
      .define('lambda2', options.lambda2 ?? 2.0, { triggers: 'rebuild' });
  }

  evaluateAt(u: number, v: number): number {
    const { lambda1, lambda2 } = this;
    const a = Math.exp(lambda1 * u + v / lambda1);
    const b = Math.exp(lambda2 * u + v / lambda2);
    const A = (lambda1 + lambda2) / (lambda1 - lambda2);
    return 4 * Math.atan(A * (a - b) / (1 + a * b));
  }

  partialsAt(u: number, v: number): [number, number] {
    const { lambda1, lambda2 } = this;
    const a = Math.exp(lambda1 * u + v / lambda1);
    const b = Math.exp(lambda2 * u + v / lambda2);
    const D = 1 + a * b;
    const D2 = D * D;
    const A = (lambda1 + lambda2) / (lambda1 - lambda2);

    const g = (a - b) / D;
    const f = A * g;
    const denom = 4 / (1 + f * f);

    // Derived by quotient rule with cancellations:
    //   g_u = (λ₁ a (1 + b²) − λ₂ b (1 + a²)) / D²
    //   g_v = ((a/λ₁) (1 + b²) − (b/λ₂) (1 + a²)) / D²
    const one_p_b2 = 1 + b * b;
    const one_p_a2 = 1 + a * a;
    const gu = (lambda1 * a * one_p_b2 - lambda2 * b * one_p_a2) / D2;
    const gv = ((a / lambda1) * one_p_b2 - (b / lambda2) * one_p_a2) / D2;

    return [A * gu * denom, A * gv * denom];
  }

  domain2D(): SurfaceDomainLite {
    return { uMin: -3, uMax: 3, vMin: -3, vMax: 3 };
  }
}
