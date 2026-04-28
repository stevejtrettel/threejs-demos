/**
 * Torque-free rigid body on `SO(3) × ℝ³`.
 *
 * State is `(R, L)` with `R ∈ SO(3)` the body-to-world rotation and `L ∈ ℝ³`
 * the body-frame angular momentum. With principal moments `I = diag(I₁, I₂, I₃)`
 * the equations of motion are
 *
 *   dL/dt = L × Ω,   Ω = I⁻¹ L
 *   dR/dt = R · hat(Ω).
 *
 * The `L` equation lives in `ℝ³` and is an ODE solvable with any standard
 * stepper. The `R` equation must keep `R` exactly on `SO(3)` — naive
 * vectorial integration drifts off the group over long runs. We use a
 * Lie-group splitting step:
 *
 *   R_{n+1} = R_n · exp(dt · hat(Ω_n))
 *
 * The matrix exponential `exp` lands back in `SO(3)` by construction
 * (Rodrigues' formula), so `R Rᵀ = I` and `det R = 1` hold to machine
 * precision every step, no re-orthogonalization needed.
 *
 * `H(L) = ½ Σ L_i² / I_i` and `|L|²` are both conserved on the continuous
 * flow. With RK4 on `L` they're conserved to stepper accuracy; with the
 * implicit-midpoint stepper they're conserved without secular drift.
 */

import { Matrix } from '@/math/linear-algebra';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Stepper } from '@/math/ode';
import { rk4 } from '@/math/ode';
import { SO3 } from './groups/SO3';

export interface RigidBodyState {
  /** Body-to-world rotation, 3×3 matrix in `SO(3)`. */
  R: Matrix;
  /** Body-frame angular momentum, length-3 vector. */
  L: number[];
}

export interface RigidBodyOptions {
  /** Principal moments of inertia `I₁, I₂, I₃`. Must be positive. */
  inertia: [number, number, number];
  /** Stepper for the `L` ODE. Defaults to `rk4`. */
  stepper?: Stepper;
  /**
   * Optional body-frame torque `τ(R, L)`. If provided, Euler's equation
   * becomes `dL/dt = L × Ω + τ`. `R` is frozen at the start of each
   * splitting step for the L-substep — first-order in `dt`.
   *
   * Use for e.g. spinning-top demos where gravity-through-offset-COM
   * supplies a torque that depends on the current orientation.
   */
  torque?: (R: Matrix, L: number[]) => number[];
}

/**
 * Rigid-body Hamiltonian `H(L) = ½ Σ L_i² / I_i` as a scalar field on
 * `so(3)* ≅ ℝ³`. Usable with `liePoissonManifold(SO3)` + `PoissonGradient`
 * for generic Lie-Poisson flow, as a sanity-check alternative to the
 * specialized splitting integrator below.
 */
export function rigidBodyHamiltonian(
  inertia: [number, number, number],
): DifferentiableScalarField {
  const [I1, I2, I3] = inertia;
  return {
    dim: 3,
    getDomain: (): ManifoldDomain => ({
      min: [-Infinity, -Infinity, -Infinity],
      max: [ Infinity,  Infinity,  Infinity],
    }),
    evaluate: (L) =>
      0.5 * (L[0] * L[0] / I1 + L[1] * L[1] / I2 + L[2] * L[2] / I3),
    computePartials: (L) => {
      const out = new Float64Array(3);
      out[0] = L[0] / I1;
      out[1] = L[1] / I2;
      out[2] = L[2] / I3;
      return out;
    },
  };
}

/**
 * One splitting step. Pure — does not mutate input state.
 *
 * 1. Advance `L` via `dL/dt = L × (I⁻¹ L)` using the given stepper.
 * 2. Advance `R` via `R ← R · exp(dt · hat(I⁻¹ L_new))` using the new `L`.
 *
 * Step 2 keeps `R` exactly in `SO(3)`.
 */
export function rigidBodyStep(
  state: RigidBodyState,
  dt: number,
  options: RigidBodyOptions,
): RigidBodyState {
  const [I1, I2, I3] = options.inertia;
  const stepper = options.stepper ?? rk4;

  const deriv = (L: number[]): number[] => {
    const Omega0 = L[0] / I1;
    const Omega1 = L[1] / I2;
    const Omega2 = L[2] / I3;
    const dLx = L[1] * Omega2 - L[2] * Omega1;
    const dLy = L[2] * Omega0 - L[0] * Omega2;
    const dLz = L[0] * Omega1 - L[1] * Omega0;
    if (options.torque) {
      const tau = options.torque(state.R, L);
      return [dLx + tau[0], dLy + tau[1], dLz + tau[2]];
    }
    return [dLx, dLy, dLz];
  };

  const Lnext = stepper(deriv, state.L, 0, dt);

  const OmegaNext = [Lnext[0] / I1, Lnext[1] / I2, Lnext[2] / I3];
  const dR = SO3.exp([OmegaNext[0] * dt, OmegaNext[1] * dt, OmegaNext[2] * dt]);
  const Rnext = state.R.multiply(dR);

  return { R: Rnext, L: Lnext };
}
