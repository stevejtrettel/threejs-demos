/**
 * Theta functions with characteristics.
 *
 * The general theta function θ[a,b](z|τ) unifies all classical theta functions:
 *
 *   θ[a,b](z|τ) = Σ_n exp(πiτ(n+a)² + 2πi(z+b)(n+a))
 *
 * Specializations:
 *   Jacobi θ₁ = θ[1/2, 1/2],  θ₂ = θ[1/2, 0],  θ₃ = θ[0, 0],  θ₄ = θ[0, 1/2]
 *   Level-N canonical θⱼ = θ[j/N, 0](Nz | Nτ)
 *
 * The factory `createTheta(tau, a, b)` precomputes τ-dependent coefficients,
 * then evaluates efficiently over many z values (animation use case).
 */

import {
  type Complex,
  cadd,
  cmul,
  cscale,
  cexp,
  CZERO,
} from '../algebra/complex';

const PI = Math.PI;
const TWO_PI = 2 * PI;

// ── Types ────────────────────────────────────────────────

export interface ThetaFunction {
  /** Evaluate θ[a,b](z|τ) */
  eval(z: Complex): Complex;
  /** k-th derivative d^k/dz^k θ[a,b](z|τ) */
  derivative(z: Complex, k: number): Complex;
  readonly a: number;
  readonly b: number;
  readonly tau: Complex;
}

export interface ThetaLevel {
  /** Evaluate θ_j(z) for this (τ, level) pair */
  theta(z: Complex, j: number): Complex;
  /** Evaluate all N theta functions at z: [θ₀(z), ..., θ_{N-1}(z)] */
  thetaAll(z: Complex): Complex[];
  readonly level: number;
  readonly tau: Complex;
}

// ── Core: theta with characteristics ─────────────────────

/**
 * Create a theta function θ[a,b](z|τ) with precomputed coefficients.
 *
 * Precomputes coeff[n] = exp(πiτ(n+a)² + 2πib(n+a)) for n in [-M, M].
 * Evaluation then requires only one cexp per term (the z-dependent part).
 */
export function createTheta(
  tau: Complex,
  a: number,
  b: number,
  terms: number = 10,
): ThetaFunction {
  const M = terms;
  const count = 2 * M + 1;

  // Precompute coefficients and shifts
  const coeff: Complex[] = new Array(count);
  const shift: number[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const n = i - M;
    const s = n + a; // shift value
    shift[i] = s;

    // coeff = exp(πiτ(n+a)² + 2πib(n+a))
    //       = exp(πiτ·s² + 2πib·s)
    // exp(i·w) where w = πτs² + 2πbs, but τ and result are complex:
    // πiτs² = πi(τ_re + iτ_im)s² = [-πτ_im·s², πτ_re·s²]
    // 2πibs = [0, 2πbs]
    const s2 = s * s;
    const re = -PI * tau[1] * s2;
    const im = PI * tau[0] * s2 + TWO_PI * b * s;
    coeff[i] = cexp([re, im]);
  }

  function evaluate(z: Complex): Complex {
    let result: Complex = CZERO;
    for (let i = 0; i < count; i++) {
      // z-dependent: exp(2πiz·shift[i])
      // 2πi·z·s = 2πi·(z_re + iz_im)·s = [-2π·z_im·s, 2π·z_re·s]
      const s = shift[i];
      const zExp: Complex = cexp([-TWO_PI * z[1] * s, TWO_PI * z[0] * s]);
      result = cadd(result, cmul(coeff[i], zExp));
    }
    return result;
  }

  function derivative(z: Complex, k: number): Complex {
    let result: Complex = CZERO;
    for (let i = 0; i < count; i++) {
      const s = shift[i];
      const zExp: Complex = cexp([-TWO_PI * z[1] * s, TWO_PI * z[0] * s]);

      // Multiply by (2πi·s)^k
      // (2πi)^k · s^k, where (2πi)^k cycles: 2πi, -(2π)², -i(2π)³, (2π)⁴, ...
      const mag = Math.pow(TWO_PI * s, k);
      let multiplier: Complex;
      switch (k % 4) {
        case 0: multiplier = [mag, 0]; break;
        case 1: multiplier = [0, mag]; break;
        case 2: multiplier = [-mag, 0]; break;
        case 3: multiplier = [0, -mag]; break;
        default: multiplier = [mag, 0];
      }

      result = cadd(result, cmul(coeff[i], cmul(multiplier, zExp)));
    }
    return result;
  }

  return {
    eval: evaluate,
    derivative,
    a,
    b,
    tau,
  };
}

// ── Jacobi theta functions ───────────────────────────────

/**
 * Create the four Jacobi theta functions for a given τ.
 *
 *   θ₁ = θ[1/2, 1/2]    (odd, vanishes at z=0)
 *   θ₂ = θ[1/2, 0]
 *   θ₃ = θ[0, 0]
 *   θ₄ = θ[0, 1/2]
 */
export function jacobi(
  tau: Complex,
  terms: number = 10,
): {
  theta1: ThetaFunction;
  theta2: ThetaFunction;
  theta3: ThetaFunction;
  theta4: ThetaFunction;
} {
  return {
    theta1: createTheta(tau, 0.5, 0.5, terms),
    theta2: createTheta(tau, 0.5, 0, terms),
    theta3: createTheta(tau, 0, 0, terms),
    theta4: createTheta(tau, 0, 0.5, terms),
  };
}

// ── Level-N canonical theta functions ────────────────────

/**
 * Create the N canonical theta functions of level N.
 *
 *   θⱼ(z; τ, N) = θ[j/N, 0](Nz | Nτ)
 *                = Σ_n exp(πiNτ(j/N + n)² + 2πiNz(j/N + n))
 *
 * `thetaAll` fuses the n-loop across all j values.
 */
export function thetaLevel(
  tau: Complex,
  level: number,
  terms: number = 10,
): ThetaLevel {
  const N = level;
  const M = terms;
  const count = 2 * M + 1;

  // Scaled τ for the level
  const Ntau: Complex = cscale(N, tau);

  // Precompute per-(j, n) coefficients:
  //   coeff[j][i] = exp(πi·Nτ·(j/N + n)²)  where n = i - M
  //   shift[j][i] = N·(j/N + n) = j + N·n
  const allCoeff: Complex[][] = new Array(N);
  const allShift: number[][] = new Array(N);

  for (let j = 0; j < N; j++) {
    allCoeff[j] = new Array(count);
    allShift[j] = new Array(count);
    const a = j / N;

    for (let i = 0; i < count; i++) {
      const n = i - M;
      const s = a + n; // j/N + n

      // exp(πi·Nτ·s²)
      const s2 = s * s;
      const re = -PI * Ntau[1] * s2;
      const im = PI * Ntau[0] * s2;
      allCoeff[j][i] = cexp([re, im]);

      // The z-dependent part uses exp(2πi·Nz·s) = exp(2πi·z·(j + N·n))
      allShift[j][i] = N * s; // = j + N*n
    }
  }

  function theta(z: Complex, j: number): Complex {
    j = ((j % N) + N) % N;
    const coeffs = allCoeff[j];
    const shifts = allShift[j];
    let result: Complex = CZERO;

    for (let i = 0; i < count; i++) {
      const s = shifts[i];
      const zExp: Complex = cexp([-TWO_PI * z[1] * s, TWO_PI * z[0] * s]);
      result = cadd(result, cmul(coeffs[i], zExp));
    }
    return result;
  }

  function thetaAll(z: Complex): Complex[] {
    const results: Complex[] = new Array(N);
    for (let j = 0; j < N; j++) {
      results[j] = CZERO;
    }

    // Fused loop: for each n, compute the z-dependent exp once per unique shift
    // (shifts differ per j, so we still loop per j, but the structure is cache-friendly)
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < N; j++) {
        const s = allShift[j][i];
        const zExp: Complex = cexp([-TWO_PI * z[1] * s, TWO_PI * z[0] * s]);
        results[j] = cadd(results[j], cmul(allCoeff[j][i], zExp));
      }
    }
    return results;
  }

  return {
    theta,
    thetaAll,
    level: N,
    tau,
  };
}

