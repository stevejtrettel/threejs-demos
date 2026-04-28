/**
 * Energy types
 *
 * Concrete energy data structures shared by the energy classes and the
 * builder helpers. Each "kind" of term (spring, charge, hinge, ...) gets
 * its own data interface here.
 */

/**
 * A linear-spring term between vertices `i` and `j`.
 *
 * Energy contribution: `½ · k · (|x_i − x_j| − rest)²`.
 *
 * Stiffness is stored as an absolute coefficient — `stretchSprings` and
 * other builders are responsible for converting a "stiffness density"
 * into an absolute `k` (typically `density · rest`) so the global elastic
 * response is roughly mesh-resolution invariant.
 */
export interface Spring {
  i: number;
  j: number;
  /** Absolute spring constant. */
  k: number;
  /** Rest length. */
  rest: number;
}
