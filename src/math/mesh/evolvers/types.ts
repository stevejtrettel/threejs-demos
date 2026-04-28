/**
 * Evolver types
 *
 * An evolver advances an `Embedding` by one time step `dt`, mutating its
 * `positions` in place. The integration scheme (Euler, semi-implicit
 * Euler, momentum, ...) is owned by the concrete evolver class — they
 * are short enough that going through a generic ODE stepper would obscure
 * more than it reuses.
 *
 * After stepping, the demo should call `meshView.sync()` to push the new
 * positions to the GPU.
 */

export interface Evolver {
  /** Advance the embedding by one time step. Mutates `positions` in place. */
  step(dt: number): void;
}
