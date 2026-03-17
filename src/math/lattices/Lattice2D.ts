/**
 * 2D Lattice Λ = ω₁ℤ + ω₂ℤ ⊂ ℂ
 *
 * A lattice in ℝ² is the same thing as a lattice in ℂ — the basis vectors
 * are stored as Complex = [number, number].
 *
 * Key distinction:
 * - The lattice carries scale and rotation (ω₁, ω₂ ∈ ℂ).
 * - The conformal class τ = ω₂/ω₁ ∈ ℍ forgets both.
 * - Eisenstein invariants g₂, g₃ depend on the full lattice (not just τ).
 *   Rotating by e^{iθ} sends g₂ → e^{−4iθ}g₂, g₃ → e^{−6iθ}g₃,
 *   tracing a trefoil knot on S³.
 *
 * Derived quantities (Eisenstein invariants, S³/R³ projections, Weierstrass ℘)
 * are provided as standalone functions in invariants.ts, projections.ts, and
 * weierstrass.ts respectively.
 */

import {
  type Complex,
  cadd,
  csub,
  cmul,
  cdiv,
  cinv,
  cscale,
  cneg,
  cconj,
  cabs2,
} from '../algebra/complex';

// ── Tolerances ──────────────────────────────────────────

const TOL_SL2Z = 1e-10;
const TOL_DEGENERATE = 1e-15;
const TOL_MEMBERSHIP = 1e-8;

// ── SL(2,ℤ) reduction result ─────────────────────────────

export interface TauData {
  /** τ = ω₂/ω₁ ∈ ℍ (upper half-plane) */
  tau: Complex;
  /** The first basis vector (carries scale and rotation) */
  omega1: Complex;
}

export interface TauReducedData extends TauData {
  /** The SL(2,ℤ) matrix [[a,b],[c,d]] that maps the original τ to the reduced τ */
  transform: [[number, number], [number, number]];
}

// ── Lattice class ────────────────────────────────────────

export class Lattice2D {
  readonly omega1: Complex;
  readonly omega2: Complex;

  constructor(omega1: Complex, omega2: Complex) {
    this.omega1 = omega1;
    this.omega2 = omega2;
  }

  // ── Basis reduction ──────────────────────────────────

  /**
   * Lagrange–Gauss reduction: find a shortest basis for the same lattice.
   *
   * Returns a new Lattice2D with the reduced basis satisfying:
   *   |ω₁| ≤ |ω₂|  and  |Re(ω̄₁·ω₂)| ≤ |ω₁|²/2
   *
   * Algorithm: iteratively subtract the nearest integer multiple of ω₁
   * from ω₂, then swap if ω₂ became shorter. This is the 2D analogue
   * of the Euclidean algorithm.
   */
  reduce(): Lattice2D {
    let v1 = this.omega1;
    let v2 = this.omega2;

    // Ensure |v1| ≤ |v2|
    if (cabs2(v1) > cabs2(v2)) {
      [v1, v2] = [v2, v1];
    }

    for (let iter = 0; iter < 100; iter++) {
      // Project: μ = Re(v̄₁·v₂) / |v₁|²
      const dot = cmul(cconj(v1), v2);
      const mu = dot[0] / cabs2(v1);

      // Subtract nearest integer multiple
      const n = Math.round(mu);
      if (n === 0) break;

      v2 = csub(v2, cscale(n, v1));

      // Swap if v2 is now shorter
      if (cabs2(v2) < cabs2(v1)) {
        [v1, v2] = [v2, v1];
      }
    }

    return new Lattice2D(v1, v2);
  }

  // ── Conformal class ──────────────────────────────────

  /**
   * Compute τ = ω₂/ω₁ ∈ ℍ and the scaling factor ω₁.
   *
   * Ensures Im(τ) > 0 by swapping/negating basis vectors if needed.
   * Both values are needed: τ for modular form computation,
   * ω₁ to recover scale and rotation.
   */
  tau(): TauData {
    let w1 = this.omega1;
    let w2 = this.omega2;

    let t = cdiv(w2, w1);

    // Ensure Im(τ) > 0
    if (t[1] < 0) {
      // Negate ω₂: τ → −τ, which flips the sign of Im(τ).
      w2 = cneg(w2);
      t = cdiv(w2, w1);
    }

    return { tau: t, omega1: w1 };
  }

  /**
   * Reduce τ into the SL(2,ℤ) fundamental domain:
   *   |τ| ≥ 1,  |Re(τ)| ≤ 1/2
   *
   * Uses iterated S (τ → −1/τ) and T (τ → τ+1) moves.
   * Returns the reduced τ, the corresponding ω₁, and the SL(2,ℤ) matrix.
   *
   * In the fundamental domain, |q| = e^{−2π·Im(τ)} ≤ e^{−π√3} ≈ 0.0043,
   * so q-series converge absurdly fast.
   */
  tauReduced(): TauReducedData {
    const { tau: tauOrig, omega1: w1Orig } = this.tau();

    let t = tauOrig;

    // Track the SL(2,ℤ) transformation as a 2×2 matrix [[a,b],[c,d]]
    // acting as τ → (aτ+b)/(cτ+d)
    // Start with identity
    let a = 1, b = 0, c = 0, d = 1;

    for (let iter = 0; iter < 100; iter++) {
      let changed = false;

      // T move: τ → τ − round(Re(τ))
      const n = Math.round(t[0]);
      if (n !== 0) {
        t = [t[0] - n, t[1]];
        // T^{-n}: [[1, -n], [0, 1]] applied on the left
        a -= n * c;
        b -= n * d;
        changed = true;
      }

      // S move: τ → −1/τ  if |τ| < 1
      const absT2 = cabs2(t);
      if (absT2 < 1 - TOL_SL2Z) {
        // −1/τ
        t = cneg(cinv(t));
        // S = [[0, -1], [1, 0]] applied on the left
        const newA = -c, newB = -d;
        c = a;
        d = b;
        a = newA;
        b = newB;

        changed = true;
      }

      if (!changed) break;
    }

    // Compute the actual reduced ω₁: ω₁' = (c·τ_orig + d) · ω₁_orig
    // Under τ → (aτ+b)/(cτ+d), the new lattice basis is:
    //   ω₁' = (c·τ_orig + d) · ω₁_orig
    //   ω₂' = (a·τ_orig + b) · ω₁_orig
    const cTauPlusD: Complex = cadd(cscale(c, tauOrig), [d, 0]);
    const omega1Reduced = cmul(cTauPlusD, w1Orig);

    return {
      tau: t,
      omega1: omega1Reduced,
      transform: [[a, b], [c, d]],
    };
  }

  // ── Gram matrix and covolume ─────────────────────────

  /**
   * Gram matrix G_{ij} = Re(ω̄ᵢ·ωⱼ) (the inner product matrix).
   *
   * Returns [[⟨ω₁,ω₁⟩, ⟨ω₁,ω₂⟩], [⟨ω₂,ω₁⟩, ⟨ω₂,ω₂⟩]]
   */
  gramMatrix(): [[number, number], [number, number]] {
    const g11 = cabs2(this.omega1);
    const g22 = cabs2(this.omega2);
    const g12 = cmul(cconj(this.omega1), this.omega2)[0]; // Re(ω̄₁·ω₂)
    return [[g11, g12], [g12, g22]];
  }

  /**
   * Covolume = area of the fundamental parallelogram = |Im(ω̄₁·ω₂)|
   */
  covolume(): number {
    return Math.abs(cmul(cconj(this.omega1), this.omega2)[1]);
  }

  // ── Transformations ──────────────────────────────────

  /**
   * Return a new lattice rotated by angle θ.
   */
  rotate(theta: number): Lattice2D {
    const r: Complex = [Math.cos(theta), Math.sin(theta)];
    return new Lattice2D(cmul(r, this.omega1), cmul(r, this.omega2));
  }

  /**
   * Return a new lattice scaled by factor s.
   */
  scale(s: number): Lattice2D {
    return new Lattice2D(cscale(s, this.omega1), cscale(s, this.omega2));
  }

  // ── Membership ───────────────────────────────────────

  /**
   * Test whether a point v ∈ ℂ is (approximately) a lattice point.
   *
   * Solves v = m·ω₁ + n·ω₂ for (m,n) and checks if they're near-integers.
   */
  contains(v: Complex, tol: number = TOL_MEMBERSHIP): boolean {
    const [s, t] = this.coordinates(v);
    return (
      Math.abs(s - Math.round(s)) < tol &&
      Math.abs(t - Math.round(t)) < tol
    );
  }

  // ── Coordinates and reduction ─────────────────────────

  /**
   * Decompose a point z ∈ ℂ into lattice coordinates.
   *
   * Solves z = s·ω₁ + t·ω₂ and returns [s, t].
   */
  coordinates(z: Complex): [number, number] {
    const det =
      this.omega1[0] * this.omega2[1] - this.omega1[1] * this.omega2[0];
    if (Math.abs(det) < TOL_DEGENERATE) return [0, 0];

    const s = (z[0] * this.omega2[1] - z[1] * this.omega2[0]) / det;
    const t = (this.omega1[0] * z[1] - this.omega1[1] * z[0]) / det;
    return [s, t];
  }

  /**
   * Reduce a point z ∈ ℂ modulo the lattice (z mod Λ).
   *
   * Returns z' such that z - z' ∈ Λ and z' = s·ω₁ + t·ω₂ with s, t ∈ [0, 1).
   */
  mod(z: Complex): Complex {
    const [s, t] = this.coordinates(z);
    const sFrac = s - Math.floor(s);
    const tFrac = t - Math.floor(t);
    return cadd(cscale(sFrac, this.omega1), cscale(tFrac, this.omega2));
  }
}
