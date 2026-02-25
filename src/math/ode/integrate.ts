/**
 * ODE trajectory integration
 *
 * Runs a stepper in a loop and collects the results.
 */

import type { DerivFn, Stepper } from './types';
import { rk4 } from './steppers';

export interface IntegrateOptions {
  /** The derivative function: (state, t) → dState */
  deriv: DerivFn;
  /** Initial state */
  initial: number[];
  /** Time step */
  dt: number;
  /** Number of steps */
  steps: number;
  /** Stepper to use (default: rk4) */
  stepper?: Stepper;
  /** Optional early termination: return true to stop */
  stop?: (state: number[], t: number) => boolean;
}

export interface Trajectory {
  /** State at each time step (length = steps + 1, including initial) */
  states: number[][];
  /** Time at each step */
  times: number[];
}

/**
 * Integrate an ODE and return the full trajectory.
 *
 * @example
 * // Harmonic oscillator: r'' = -r
 * const traj = integrate({
 *   deriv: ([r, rp]) => [rp, -r],
 *   initial: [0, 1],
 *   dt: 0.01,
 *   steps: 1000,
 * });
 */
export function integrate(options: IntegrateOptions): Trajectory {
  const { deriv, initial, dt, steps, stop } = options;
  const step = options.stepper ?? rk4;

  const states: number[][] = [initial];
  const times: number[] = [0];

  let state = initial;
  let t = 0;

  for (let i = 0; i < steps; i++) {
    state = step(deriv, state, t, dt);
    t += dt;
    states.push(state);
    times.push(t);

    if (stop?.(state, t)) break;
  }

  return { states, times };
}
