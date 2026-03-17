/**
 * Weierstrass ℘ function and its derivative.
 *
 * Two τ-level implementations:
 * - weierstrassSum: direct lattice summation (slow, simple, works on any lattice)
 * - weierstrassTheta: via Jacobi theta functions (fast, exponentially convergent)
 *
 * Plus the lattice-level wrapper:
 * - weierstrassP: evaluates ℘(z) for a full Lattice2D, handling normalization
 *
 * Cross-validate by comparing weierstrassSum and weierstrassTheta on the same lattice.
 */

import {
  type Complex,
  cadd,
  csub,
  cmul,
  cinv,
  cdiv,
  cscale,
  cexp,
  CZERO,
} from '../algebra/complex';
import { sigmak } from './eisenstein';
import type { Lattice2D } from './Lattice2D';

// ── Result type ──────────────────────────────────────────

export interface WeierstrassResult {
  p: Complex;   // ℘(z)
  dp: Complex;  // ℘'(z)
}

// ══════════════════════════════════════════════════════════
// Direct lattice summation
// ══════════════════════════════════════════════════════════

/**
 * Compute ℘(z) and ℘'(z) by direct summation over lattice points.
 *
 * ℘(z) = 1/z² + Σ'_{ω} [1/(z−ω)² − 1/ω²]
 * ℘'(z) = −2/z³ + Σ'_{ω} −2/(z−ω)³
 *
 * where ω = m·ω₁ + n·ω₂ ranges over nonzero lattice points.
 *
 * Convergence is polynomial — slow but reliable. Useful as a reference
 * implementation for validating the theta function version.
 */
export function weierstrassSum(
  z: Complex,
  omega1: Complex,
  omega2: Complex,
  N: number = 10,
): WeierstrassResult {
  const z2 = cmul(z, z);
  const z3 = cmul(z2, z);

  let p = cinv(z2);              // 1/z²
  let dp = cscale(-2, cinv(z3)); // −2/z³

  for (let n = -N; n <= N; n++) {
    for (let m = -N; m <= N; m++) {
      if (m === 0 && n === 0) continue;

      // ω = m·ω₁ + n·ω₂
      const omega: Complex = cadd(cscale(m, omega1), cscale(n, omega2));

      const diff = csub(z, omega);
      const diff2 = cmul(diff, diff);
      const diff3 = cmul(diff2, diff);
      const omegaSq = cmul(omega, omega);

      // ℘: add 1/(z−ω)² − 1/ω²
      p = cadd(p, csub(cinv(diff2), cinv(omegaSq)));

      // ℘': add −2/(z−ω)³
      dp = cadd(dp, cscale(-2, cinv(diff3)));
    }
  }

  return { p, dp };
}

// ══════════════════════════════════════════════════════════
// Jacobi theta functions
// ══════════════════════════════════════════════════════════

// All theta functions use the square-root nome q_τ = e^{iπτ}
// and the argument v (not z). Callers pass v = πz.

/**
 * Compute e^{iπτ·a} for real a, i.e. q_τ^a.
 */
function qpow(a: number, tau: Complex): Complex {
  return cexp([-Math.PI * a * tau[1], Math.PI * a * tau[0]]);
}

/**
 * Complex sine: sin(w) = (e^{iw} − e^{−iw}) / 2i
 */
function csin(w: Complex): Complex {
  const eiw = cexp([-w[1], w[0]]);
  const emiw = cexp([w[1], -w[0]]);
  // (eiw - emiw) / (2i) = -i/2 · (eiw - emiw)
  const diff = csub(eiw, emiw);
  return [diff[1] / 2, -diff[0] / 2];
}

/**
 * Complex cosine: cos(w) = (e^{iw} + e^{−iw}) / 2
 */
function ccos(w: Complex): Complex {
  const eiw = cexp([-w[1], w[0]]);
  const emiw = cexp([w[1], -w[0]]);
  return cscale(0.5, cadd(eiw, emiw));
}

// ── Generic theta evaluator ─────────────────────────────

/**
 * Specification for a theta function derivative.
 *
 * θ₁ and its derivatives all have the form:
 *   Σ_{n=0}^{N} coeff(sign, k) · q^{(n+1/2)²} · trig(k·v)
 * where k = 2n+1 and sign = (−1)^n.
 */
interface ThetaSpec {
  coeff: (sign: number, k: number) => number;
  trig: (w: Complex) => Complex;
}

const THETA1: ThetaSpec = {
  coeff: (s, _k) => 2 * s,
  trig: csin,
};

const THETA1_D1: ThetaSpec = {
  coeff: (s, k) => 2 * s * k,
  trig: ccos,
};

const THETA1_D2: ThetaSpec = {
  coeff: (s, k) => -2 * s * k * k,
  trig: csin,
};

const THETA1_D3: ThetaSpec = {
  coeff: (s, k) => -2 * s * k * k * k,
  trig: ccos,
};

function thetaEval(
  v: Complex,
  tau: Complex,
  terms: number,
  spec: ThetaSpec,
): Complex {
  let result: Complex = CZERO;
  for (let n = 0; n < terms; n++) {
    const sign = (n % 2 === 0) ? 1 : -1;
    const k = 2 * n + 1;
    const qt = qpow((n + 0.5) * (n + 0.5), tau);
    const trig = spec.trig(cscale(k, v));
    result = cadd(result, cscale(spec.coeff(sign, k), cmul(qt, trig)));
  }
  return result;
}

// ══════════════════════════════════════════════════════════
// Weierstrass ℘ via theta functions
// ══════════════════════════════════════════════════════════

/**
 * Compute ℘(z; τ) and ℘'(z; τ) via Jacobi theta functions.
 *
 * For the normalized lattice Λ = ℤ + τℤ (ω₁ = 1):
 *
 *   ℘(z) = −d²/dz² log θ₁(πz|τ) + c
 *
 * where c = π²/3 · E₂(τ) and E₂(τ) = 1 − 24·Σ σ₁(n)qⁿ.
 *
 * Expanding the log-derivative:
 *   let f = θ₁, v = πz, so dz = dv/π
 *
 *   ℘(z) = −π² · (f''f − f'²) / f² + c
 *   ℘'(z) = −π³ · (f'''f² − 3f''f'f + 2f'³) / f³
 *
 * Convergence is exponential in Im(τ). For τ in the fundamental domain,
 * ~10–15 terms give full double precision.
 */
export function weierstrassTheta(
  z: Complex,
  tau: Complex,
  terms: number = 20,
): WeierstrassResult {
  const pi = Math.PI;
  const pi2 = pi * pi;
  const pi3 = pi * pi * pi;

  // v = πz
  const v: Complex = cscale(pi, z);

  // Evaluate θ₁ and its first three derivatives at v
  const f = thetaEval(v, tau, terms, THETA1);
  const f1 = thetaEval(v, tau, terms, THETA1_D1);
  const f2 = thetaEval(v, tau, terms, THETA1_D2);
  const f3 = thetaEval(v, tau, terms, THETA1_D3);

  const f_sq = cmul(f, f);
  const f_cu = cmul(f_sq, f);
  const f_sq_inv = cinv(f_sq);
  const f_cu_inv = cinv(f_cu);

  // Eisenstein E₂(τ) = 1 − 24·Σ σ₁(n)qⁿ
  const q = cexp([-2 * pi * tau[1], 2 * pi * tau[0]]);
  let e2: Complex = [1, 0];
  let qn: Complex = q;
  for (let n = 1; n <= terms; n++) {
    const s1 = sigmak(n, 1);
    e2 = csub(e2, cscale(24 * s1, qn));
    qn = cmul(qn, q);
  }
  const c = cscale(pi2 / 3, e2);

  // ℘(z) = −π² · (f''·f − f'²) / f² + c
  const numerP = csub(cmul(f2, f), cmul(f1, f1));
  const p = cadd(cscale(-pi2, cmul(numerP, f_sq_inv)), c);

  // ℘'(z) = −π³ · (f'''·f² − 3·f''·f'·f + 2·f'³) / f³
  const f1_sq = cmul(f1, f1);
  const f1_cu = cmul(f1_sq, f1);
  const numerDP = cadd(
    csub(
      cmul(f3, f_sq),                        // f'''·f²
      cscale(3, cmul(f2, cmul(f1, f))),       // − 3·f''·f'·f
    ),
    cscale(2, f1_cu),                          // + 2·f'³
  );
  const dp = cscale(-pi3, cmul(numerDP, f_cu_inv));

  return { p, dp };
}

// ══════════════════════════════════════════════════════════
// Lattice-level ℘
// ══════════════════════════════════════════════════════════

/**
 * Evaluate ℘(z) and ℘'(z) for a full lattice Λ = ω₁(ℤ + τℤ).
 *
 * Uses the fast theta function implementation, with τ reduced to
 * the fundamental domain for optimal convergence.
 *
 * Input z is in the original lattice coordinates.
 */
export function weierstrassP(
  z: Complex,
  lat: Lattice2D,
  terms?: number,
): WeierstrassResult {
  const { tau, omega1 } = lat.tauReduced();

  // Normalize: z_normalized = z / ω₁ (now in the lattice ℤ + τℤ)
  const zn = cdiv(z, omega1);

  // Compute ℘(z_n; τ) for the normalized lattice
  const result = weierstrassTheta(zn, tau, terms);

  // Rescale: ℘_Λ(z) = ω₁⁻² · ℘(z/ω₁; τ)
  //          ℘'_Λ(z) = ω₁⁻³ · ℘'(z/ω₁; τ)
  const w1inv = cinv(omega1);
  const w1inv2 = cmul(w1inv, w1inv);
  const w1inv3 = cmul(w1inv2, w1inv);

  return {
    p: cmul(w1inv2, result.p),
    dp: cmul(w1inv3, result.dp),
  };
}
