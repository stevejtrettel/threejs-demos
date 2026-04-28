/**
 * ODE steppers
 *
 * Each stepper is a pure function: (deriv, state, t, dt) → nextState.
 * State is number[], derivative is number[] of the same length.
 */

import type { Stepper } from './types';

/**
 * Euler method (first-order).
 * Simple but inaccurate — useful for debugging or when speed matters more than precision.
 */
export const euler: Stepper = (deriv, state, t, dt) => {
  const d = deriv(state, t);
  return state.map((s, i) => s + dt * d[i]);
};

/**
 * Implicit midpoint rule — 2nd-order symplectic integrator.
 *
 * Update rule: `y_{n+1} = y_n + dt · f((y_n + y_{n+1}) / 2)`.
 *
 * For ODEs arising from a Hamiltonian, this integrator preserves the
 * symplectic 2-form exactly at every step. Energy error oscillates with
 * bounded amplitude rather than drifting secularly, so long-time
 * Hamiltonian runs stay on (near) the right level sets forever.
 *
 * Works for *any* Hamiltonian, separable or not (including the n-pendulum
 * whose kinetic energy depends on q through the mass matrix). Explicit
 * symplectic methods like Störmer-Verlet require `H = T(p) + V(q)` and a
 * split-force signature; this implicit method fits the plain `DerivFn`.
 *
 * Per-step cost: fixed-point iteration on the midpoint equation. For
 * non-stiff problems and reasonable `dt`, 3–5 iterations converge.
 * Tolerance and max-iteration count are tuned conservatively below.
 */
export const implicitMidpoint: Stepper = (deriv, state, t, dt) => {
  const n = state.length;
  const tMid = t + dt / 2;
  const MAX_ITER = 25;
  const TOL = 1e-11;

  const y1 = state.slice();        // current guess for y_{n+1}
  const mid = new Array(n);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    for (let i = 0; i < n; i++) mid[i] = (state[i] + y1[i]) / 2;
    const fMid = deriv(mid, tMid);
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      const next = state[i] + dt * fMid[i];
      const d = Math.abs(next - y1[i]);
      if (d > maxDiff) maxDiff = d;
      y1[i] = next;
    }
    if (maxDiff < TOL) break;
  }

  return y1;
};

/**
 * Gauss-Legendre 4th-order implicit Runge-Kutta — symplectic, 4th-order,
 * works for any Hamiltonian (separable or not).
 *
 * 2-stage implicit RK with the Butcher tableau
 *
 *   c₁ = ½ − √3/6   a₁₁ = 1/4              a₁₂ = 1/4 − √3/6
 *   c₂ = ½ + √3/6   a₂₁ = 1/4 + √3/6       a₂₂ = 1/4
 *                   b₁ = 1/2               b₂ = 1/2
 *
 * Each step solves `k_i = f(t + cᵢ·dt, y + dt·Σⱼ aᵢⱼ kⱼ)` for the stage
 * derivatives `k₁, k₂`, then advances `y_{n+1} = y + ½·dt·(k₁ + k₂)`.
 *
 * Per-step cost: ~5–10 fixed-point iterations × 2 function evals each
 * ≈ 15–20 evals/step (vs 4 for RK4). Much more expensive per step, but
 * for long Hamiltonian runs the energy error is bounded-oscillating
 * instead of drifting. For chaotic systems over many seconds this is
 * the right choice; for short runs RK4 is cheaper.
 */
export const gaussLegendre4: Stepper = (deriv, state, t, dt) => {
  const n = state.length;
  const sqrt3 = Math.sqrt(3);
  const c1 = 0.5 - sqrt3 / 6;
  const c2 = 0.5 + sqrt3 / 6;
  const a11 = 0.25;
  const a12 = 0.25 - sqrt3 / 6;
  const a21 = 0.25 + sqrt3 / 6;
  const a22 = 0.25;

  const MAX_ITER = 25;
  const TOL = 1e-11;

  // Initial guess: k₁ = k₂ = f(t, y).
  const f0 = deriv(state, t);
  const k1 = f0.slice();
  const k2 = f0.slice();

  const arg1 = new Array(n);
  const arg2 = new Array(n);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    for (let i = 0; i < n; i++) {
      arg1[i] = state[i] + dt * (a11 * k1[i] + a12 * k2[i]);
      arg2[i] = state[i] + dt * (a21 * k1[i] + a22 * k2[i]);
    }
    const f1 = deriv(arg1, t + c1 * dt);
    const f2 = deriv(arg2, t + c2 * dt);

    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      const d1 = Math.abs(f1[i] - k1[i]);
      const d2 = Math.abs(f2[i] - k2[i]);
      if (d1 > maxDiff) maxDiff = d1;
      if (d2 > maxDiff) maxDiff = d2;
      k1[i] = f1[i];
      k2[i] = f2[i];
    }
    if (maxDiff < TOL) break;
  }

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = state[i] + 0.5 * dt * (k1[i] + k2[i]);
  }
  return out;
};

/**
 * Classical 4th-order Runge-Kutta.
 * The workhorse — good accuracy for smooth problems.
 */
export const rk4: Stepper = (deriv, state, t, dt) => {
  const n = state.length;

  const k1 = deriv(state, t);

  const s2 = new Array(n);
  for (let i = 0; i < n; i++) s2[i] = state[i] + 0.5 * dt * k1[i];
  const k2 = deriv(s2, t + 0.5 * dt);

  const s3 = new Array(n);
  for (let i = 0; i < n; i++) s3[i] = state[i] + 0.5 * dt * k2[i];
  const k3 = deriv(s3, t + 0.5 * dt);

  const s4 = new Array(n);
  for (let i = 0; i < n; i++) s4[i] = state[i] + dt * k3[i];
  const k4 = deriv(s4, t + dt);

  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = state[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return result;
};
