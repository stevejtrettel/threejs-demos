/**
 * Projected gradient descent on an implicitly-defined surface.
 *
 * Minimize `φ: ℝⁿ → ℝ` subject to staying on `{ g = 0 }`, by the two-leg step
 *
 *     predict:  q = p − h·P(∇φ(p))        P = projection onto the tangent space
 *     correct:  p' = retract(q)           Newton along the normal, back onto S
 *
 * Neither leg alone is the method. The predictor is where the *descent*
 * happens — it is ordinary gradient descent restricted to directions that move
 * along the surface. The corrector contributes no descent at all; it repairs
 * the constraint violation the predictor introduced by moving in a straight
 * line along a curved surface. Since that violation is second order in `h`, the
 * corrector leg is roughly `h²` long against the predictor's `h`, which is why
 * a small step size makes the zigzag invisible and a large one makes it
 * obvious.
 *
 * Stopping is on the *tangential* gradient, not the full one: at a constrained
 * minimum `∇φ` is generally nonzero and points straight out along the normal,
 * where the constraint forbids moving.
 */

import type { ScalarObjective } from '@/math/rootfind';
import type { ImplicitSurface } from './ImplicitSurface';

export interface ProjectedGradientOptions {
  /** Multiplier on the projected gradient (default: 0.05). */
  stepSize?: number;

  /**
   * Cap on the geometric length of one predictor leg (default: 0.15).
   *
   * Far from the minimum the gradient can be enormous — for a polynomial
   * system, arbitrarily so — and an uncapped step would fling the point across
   * the surface. Capping the length leaves the direction alone.
   */
  maxStepLength?: number;

  /** Give up after this many steps (default: 4000). */
  maxSteps?: number;

  /** Converged once the tangential gradient is shorter than this (default: 1e-10). */
  tolerance?: number;
}

/** One predictor–corrector step, with both legs kept so they can be drawn. */
export interface ProjectedGradientStep {
  /** Where the step started — on the surface. */
  from: number[];

  /** After the tangential step — off the surface, in general. */
  predicted: number[];

  /** After the retraction — back on the surface. */
  to: number[];

  /** The tangential part of `∇φ` at `from`, before scaling. */
  tangentialGradient: Float64Array;
}

export interface ProjectedGradientResult {
  /** The trail on the surface. `points[0]` is the retracted starting point. */
  points: number[][];

  /** One entry per step taken; `steps[k]` goes from `points[k]` to `points[k+1]`. */
  steps: ProjectedGradientStep[];

  /** Whether the tangential gradient fell below `tolerance`. */
  converged: boolean;
}

function norm(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/**
 * One predictor–corrector step from a point already on the surface.
 *
 * Returns a step whose `to` equals `from` when the tangential gradient
 * vanishes — a constrained critical point, where the method has nothing left
 * to do.
 */
export function projectedGradientStep(
  surface: ImplicitSurface,
  objective: ScalarObjective,
  p: number[],
  options: ProjectedGradientOptions = {},
): ProjectedGradientStep {
  const { stepSize = 0.05, maxStepLength = 0.15 } = options;

  const tangential = surface.projectTangent(objective.gradient(p), p);
  const length = norm(tangential);

  if (!(length > 0) || !Number.isFinite(length)) {
    return { from: p.slice(), predicted: p.slice(), to: p.slice(), tangentialGradient: tangential };
  }

  const scale = Math.min(stepSize, maxStepLength / length);
  const predicted = p.map((c, i) => c - scale * tangential[i]);
  const to = surface.retract(predicted);

  return { from: p.slice(), predicted, to, tangentialGradient: tangential };
}

/**
 * Run projected gradient descent from `start` until it converges or runs out
 * of steps.
 *
 * `start` need not be on the surface — it is retracted first.
 *
 * @example
 *   const flow = projectedGradientFlow(fermat, phi, [-1.2, 1.6, 0.9], {
 *     stepSize: 0.03,
 *     maxSteps: 1500,
 *   });
 *   flow.points.length;   // trail vertices, all on the surface
 */
export function projectedGradientFlow(
  surface: ImplicitSurface,
  objective: ScalarObjective,
  start: number[],
  options: ProjectedGradientOptions = {},
): ProjectedGradientResult {
  const { maxSteps = 4000, tolerance = 1e-10 } = options;

  let p = surface.retract(start);
  const points: number[][] = [p.slice()];
  const steps: ProjectedGradientStep[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const step = projectedGradientStep(surface, objective, p, options);

    if (norm(step.tangentialGradient) <= tolerance) {
      return { points, steps, converged: true };
    }
    if (!step.to.every(Number.isFinite)) break;

    steps.push(step);
    p = step.to;
    points.push(p.slice());
  }

  return { points, steps, converged: false };
}
