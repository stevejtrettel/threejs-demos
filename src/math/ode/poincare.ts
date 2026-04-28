/**
 * Poincaré section — record where a trajectory crosses a hypersurface.
 *
 * Given an ODE and a scalar function `section: state → ℝ`, we integrate
 * the trajectory and collect the state at each sign-change of `section`.
 * Crossings are refined by bisection to near machine precision.
 *
 * Works for any dynamical system, not just Hamiltonian ones. The canonical
 * use is 2n-dim Hamiltonian systems on an energy surface — the Poincaré
 * section slices phase space transversally and shows the nested-tori →
 * chaos structure (Arnold-Liouville, KAM). For those, the default stepper
 * is `gaussLegendre4` so the trajectory stays on the energy surface over
 * many periods. For dissipative systems, pass `rk4` or `euler`; for
 * periodically driven systems the section is at each forcing period
 * (stroboscopic map).
 */

import type { DerivFn, Stepper } from './types';
import { gaussLegendre4 } from './steppers';

export interface PoincareSectionOptions {
  /** The ODE's right-hand side `f(state, t)`. */
  deriv: DerivFn;

  /** Initial state. Copied, not mutated. */
  initial: number[];

  /**
   * Signed "distance" to the section — crossings are sign changes.
   * Example: for a `q1 = 0` section, `section = (s) => s[0]`.
   */
  section: (state: number[]) => number;

  /**
   * Which direction of sign change counts as a crossing.
   * - `'up'`:   section goes −  →  + (most common; picks out one side of the surface)
   * - `'down'`: section goes +  →  −
   * - `'both'`: every sign flip counts
   *
   * Default: `'up'`.
   */
  direction?: 'up' | 'down' | 'both';

  /** Stop after collecting this many crossings. */
  maxCrossings: number;

  /** Hard limit on integration steps. */
  maxSteps: number;

  /** Integration step size. */
  dt: number;

  /** ODE stepper. Default `gaussLegendre4` for Hamiltonian use. */
  stepper?: Stepper;

  /** Initial time. Default 0. */
  t0?: number;
}

export interface PoincareResult {
  /** State vector at each crossing, in the order encountered. */
  crossings: number[][];
  /** Whether bisection converged to the requested tolerance for each crossing. */
  bisectionConverged: boolean[];
  /**
   * State at the end of the integration (after the last full step, not
   * the last crossing). Pass this back as `initial` with `t0 = finalTime`
   * to continue seamlessly — useful for demos that accumulate crossings
   * over multiple frames.
   */
  finalState: number[];
  /** Time at the end of the integration. */
  finalTime: number;
}

const BISECTION_TOL = 1e-10;
const BISECTION_MAX_ITERS = 40;

/**
 * Integrate the ODE and record crossings of the section hypersurface.
 */
export function poincareSection(options: PoincareSectionOptions): PoincareResult {
  const {
    deriv,
    initial,
    section,
    direction = 'up',
    maxCrossings,
    maxSteps,
    dt,
    stepper = gaussLegendre4,
    t0 = 0,
  } = options;

  const crossings: number[][] = [];
  const bisectionConverged: boolean[] = [];

  let state = initial.slice();
  let t = t0;
  let f = section(state);

  for (let step = 0; step < maxSteps && crossings.length < maxCrossings; step++) {
    const nextState = stepper(deriv, state, t, dt);
    const nextT = t + dt;
    const nextF = section(nextState);

    // Detect sign change in the requested direction.
    let crossed = false;
    if (f * nextF < 0) {
      if (direction === 'both') crossed = true;
      else if (direction === 'up'   && nextF > 0) crossed = true;
      else if (direction === 'down' && nextF < 0) crossed = true;
    }

    if (crossed) {
      // Bisect between (state, t, f) and (nextState, nextT, nextF). We only
      // need to track the low side's state/f and the upper time bound —
      // `midState` becomes the new Lo or Hi by updating tLo/tHi accordingly.
      let sLo = state.slice(), tLo = t, fLo = f;
      let tHi = nextT;
      let midState = nextState;
      let converged = false;

      for (let bi = 0; bi < BISECTION_MAX_ITERS; bi++) {
        const tMid = 0.5 * (tLo + tHi);
        midState = stepper(deriv, sLo, tLo, tMid - tLo);
        const fMid = section(midState);

        if (Math.abs(fMid) < BISECTION_TOL) { converged = true; break; }
        if (fMid * fLo < 0) {
          // Crossing is between Lo and Mid; tighten the upper bound.
          tHi = tMid;
        } else {
          // Crossing is between Mid and Hi; advance the lower bound.
          sLo = midState; tLo = tMid; fLo = fMid;
        }
      }

      crossings.push(midState.slice());
      bisectionConverged.push(converged);
    }

    state = nextState;
    t = nextT;
    f = nextF;
  }

  return { crossings, bisectionConverged, finalState: state.slice(), finalTime: t };
}
