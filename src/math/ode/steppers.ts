/**
 * ODE steppers
 *
 * Each stepper is a pure function: (deriv, state, t, dt) → nextState.
 * State is number[], derivative is number[] of the same length.
 */

import type { DerivFn, Stepper } from './types';

/**
 * Euler method (first-order).
 * Simple but inaccurate — useful for debugging or when speed matters more than precision.
 */
export const euler: Stepper = (deriv, state, t, dt) => {
  const d = deriv(state, t);
  return state.map((s, i) => s + dt * d[i]);
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
