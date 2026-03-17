/**
 * Eisenstein series and modular forms.
 *
 * Pure functions of τ ∈ ℍ (upper half-plane). These are the modular forms
 * level — they don't know about lattices. Lattice-level invariants (which
 * carry the ω₁ scaling) live in Lattice2D.
 *
 * All q-series use q = e^{2πiτ}. When τ is in the SL(2,ℤ) fundamental
 * domain, |q| ≤ e^{-π√3} ≈ 0.0043, so convergence is extremely fast.
 */

import { type Complex, cmul, csub, cexp, cscale, cinv, CONE } from '../algebra/complex';

// ── Divisor sum ──────────────────────────────────────────

/**
 * Divisor sum σₖ(n) = Σ_{d|n} d^k
 */
export function sigmak(n: number, k: number): number {
  let sum = 0;
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      sum += d ** k;
      const other = n / d;
      if (other !== d) {
        sum += other ** k;
      }
    }
  }
  return sum;
}

// ── q-series helpers ─────────────────────────────────────

/**
 * Compute q = e^{2πiτ} from τ ∈ ℍ.
 */
function qFromTau(tau: Complex): Complex {
  // 2πiτ = 2π(iτ) = 2π(-τ_im + i·τ_re) = [-2π·τ_im, 2π·τ_re]
  return cexp([-2 * Math.PI * tau[1], 2 * Math.PI * tau[0]]);
}

// ── Eisenstein series ────────────────────────────────────

const DEFAULT_TERMS = 30;

/**
 * Normalized Eisenstein series G₄(τ) = 1 + 240·Σₙ₌₁ σ₃(n)·qⁿ
 *
 * Returns a complex number (for τ not on the real axis, G₄(τ) is complex).
 */
export function G4(tau: Complex, terms: number = DEFAULT_TERMS): Complex {
  const q = qFromTau(tau);

  let qn: Complex = q; // q^1
  let sum: Complex = CONE; // start with 1

  for (let n = 1; n <= terms; n++) {
    const s3 = sigmak(n, 3);
    sum = [sum[0] + 240 * s3 * qn[0], sum[1] + 240 * s3 * qn[1]];
    qn = cmul(qn, q); // q^(n+1)
  }

  return sum;
}

/**
 * Normalized Eisenstein series G₆(τ) = 1 − 504·Σₙ₌₁ σ₅(n)·qⁿ
 */
export function G6(tau: Complex, terms: number = DEFAULT_TERMS): Complex {
  const q = qFromTau(tau);

  let qn: Complex = q;
  let sum: Complex = CONE;

  for (let n = 1; n <= terms; n++) {
    const s5 = sigmak(n, 5);
    sum = [sum[0] - 504 * s5 * qn[0], sum[1] - 504 * s5 * qn[1]];
    qn = cmul(qn, q);
  }

  return sum;
}

/**
 * Weierstrass invariant g₂(τ) = (4π⁴/3)·G₄(τ)
 *
 * This is the τ-level g₂. For the lattice-level g₂(Λ) with Λ = ω₁(ℤ + τℤ),
 * multiply by ω₁⁻⁴.
 */
export function g2(tau: Complex, terms?: number): Complex {
  const coeff = (4 * Math.PI ** 4) / 3;
  return cscale(coeff, G4(tau, terms));
}

/**
 * Weierstrass invariant g₃(τ) = (8π⁶/27)·G₆(τ)
 *
 * For the lattice-level g₃(Λ), multiply by ω₁⁻⁶.
 */
export function g3(tau: Complex, terms?: number): Complex {
  const coeff = (8 * Math.PI ** 6) / 27;
  return cscale(coeff, G6(tau, terms));
}

/**
 * Compute both g₂(τ) and g₃(τ) in one pass.
 *
 * Single q computation and shared q-power loop for G₄ and G₆.
 */
export function g2g3(tau: Complex, terms: number = DEFAULT_TERMS): { g2: Complex; g3: Complex } {
  const q = qFromTau(tau);

  let qn: Complex = q;
  let sumG4: Complex = CONE;
  let sumG6: Complex = CONE;

  for (let n = 1; n <= terms; n++) {
    const s3 = sigmak(n, 3);
    const s5 = sigmak(n, 5);
    sumG4 = [sumG4[0] + 240 * s3 * qn[0], sumG4[1] + 240 * s3 * qn[1]];
    sumG6 = [sumG6[0] - 504 * s5 * qn[0], sumG6[1] - 504 * s5 * qn[1]];
    qn = cmul(qn, q);
  }

  const coeffG2 = (4 * Math.PI ** 4) / 3;
  const coeffG3 = (8 * Math.PI ** 6) / 27;

  return {
    g2: cscale(coeffG2, sumG4),
    g3: cscale(coeffG3, sumG6),
  };
}

/**
 * Modular discriminant Δ(τ) = g₂³ − 27g₃²
 */
export function discriminant(tau: Complex, terms?: number): Complex {
  const inv = g2g3(tau, terms);
  const g2cubed = cmul(inv.g2, cmul(inv.g2, inv.g2));
  const g3squared = cmul(inv.g3, inv.g3);
  return csub(g2cubed, cscale(27, g3squared));
}

/**
 * Klein j-invariant j(τ) = 1728·g₂³/Δ
 */
export function jInvariant(tau: Complex, terms?: number): Complex {
  const inv = g2g3(tau, terms);
  const g2cubed = cmul(inv.g2, cmul(inv.g2, inv.g2));
  const g3squared = cmul(inv.g3, inv.g3);
  const delta = csub(g2cubed, cscale(27, g3squared));
  return cscale(1728, cmul(g2cubed, cinv(delta)));
}
