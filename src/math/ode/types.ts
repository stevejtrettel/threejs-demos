/**
 * ODE integration types
 *
 * State is number[] — pack whatever variables you need.
 * For a second-order ODE like r'' = -r, use state = [r, r'].
 * For auxiliary quantities (like arc-length y), just append: [r, r', y].
 */

/**
 * Derivative function: given state and time, return the derivative.
 *
 * Example (harmonic oscillator r'' = -r):
 *   ([r, rp], t) => [rp, -r]
 */
export type DerivFn = (state: number[], t: number) => number[];

/**
 * A stepper advances the state by one time step.
 *
 * Pure function: does not mutate the input state.
 */
export type Stepper = (
  deriv: DerivFn,
  state: number[],
  t: number,
  dt: number,
) => number[];
