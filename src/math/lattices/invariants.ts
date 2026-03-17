/**
 * Lattice-level Eisenstein invariants.
 *
 * These bridge the τ-level modular forms in eisenstein.ts to full lattices
 * Λ = ω₁(ℤ + τℤ), incorporating the ω₁ scaling.
 *
 *   g₂(Λ) = g₂(τ) · ω₁⁻⁴
 *   g₃(Λ) = g₃(τ) · ω₁⁻⁶
 */

import { type Complex, cmul, cinv } from '../algebra/complex';
import { g2 as eisensteinG2, g3 as eisensteinG3 } from './eisenstein';
import type { Lattice2D } from './Lattice2D';

/**
 * g₂(Λ) — the lattice-level Weierstrass invariant of weight 4.
 *
 * Reduces τ to the fundamental domain for fast q-series convergence,
 * then scales by ω₁⁻⁴.
 */
export function latticeG2(lat: Lattice2D, terms?: number): Complex {
  const { tau, omega1 } = lat.tauReduced();
  const g2tau = eisensteinG2(tau, terms);
  const w1_2 = cmul(omega1, omega1);
  const w1_4 = cmul(w1_2, w1_2);
  return cmul(g2tau, cinv(w1_4));
}

/**
 * g₃(Λ) — the lattice-level Weierstrass invariant of weight 6.
 */
export function latticeG3(lat: Lattice2D, terms?: number): Complex {
  const { tau, omega1 } = lat.tauReduced();
  const g3tau = eisensteinG3(tau, terms);
  const w1_2 = cmul(omega1, omega1);
  const w1_3 = cmul(w1_2, omega1);
  const w1_6 = cmul(w1_3, w1_3);
  return cmul(g3tau, cinv(w1_6));
}

/**
 * Compute both g₂(Λ) and g₃(Λ) in one pass.
 *
 * Single tauReduced() call and shared ω₁ power chain.
 */
export function latticeInvariants(
  lat: Lattice2D,
  terms?: number,
): { g2: Complex; g3: Complex } {
  const { tau, omega1 } = lat.tauReduced();

  const g2tau = eisensteinG2(tau, terms);
  const g3tau = eisensteinG3(tau, terms);

  const w1_2 = cmul(omega1, omega1);
  const w1_3 = cmul(w1_2, omega1);
  const w1_4 = cmul(w1_2, w1_2);
  const w1_6 = cmul(w1_3, w1_3);

  return {
    g2: cmul(g2tau, cinv(w1_4)),
    g3: cmul(g3tau, cinv(w1_6)),
  };
}
