/**
 * Newton's method for square systems `G(x) = 0`, `G: ℝⁿ → ℝⁿ`.
 *
 * Each step solves `DG(x)·δ = G(x)` and sets `x ← x − δ`. Near a nondegenerate
 * root the error squares every step, which is the whole reason to switch to
 * Newton once a slower method has got you close: descent crawls in linearly,
 * Newton lands in three or four steps.
 *
 * `maxStepLength` damps the far field, where a full Newton step can be wild —
 * it caps ‖δ‖ without changing its direction. It does not affect the endgame,
 * since the steps near a root are tiny.
 *
 * The iterate history is kept because it is usually the interesting part: the
 * residual column `1e-1, 1e-3, 1e-9, 1e-16` *is* quadratic convergence, made
 * visible.
 */

import { Matrix, luDecompose, luSolve } from '@/math/linear-algebra';
import type { DifferentiableMap } from './types';

export interface NewtonOptions {
  /** Stop after this many steps (default: 40). */
  maxIterations?: number;

  /** Stop once ‖G(x)‖ drops below this (default: 1e-14). */
  tolerance?: number;

  /** Cap on ‖δ‖ for one step; direction is unchanged (default: Infinity). */
  maxStepLength?: number;
}

export interface NewtonResult {
  /** The final iterate. */
  point: number[];

  /** Every iterate, starting with the initial point. */
  iterates: number[][];

  /** ‖G‖ at each iterate, so `residuals[k]` pairs with `iterates[k]`. */
  residuals: number[];

  /** Whether ‖G‖ reached `tolerance`. */
  converged: boolean;
}

/** Euclidean norm of a `Float64Array` or `number[]`. */
function norm(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/**
 * One Newton step from `p`.
 *
 * @returns the next iterate, or `null` if the Jacobian is singular there (in
 * which case Newton has nothing to say and the caller must fall back).
 */
export function newtonStep(
  map: DifferentiableMap,
  p: number[],
  options: Pick<NewtonOptions, 'maxStepLength'> = {},
): number[] | null {
  const { maxStepLength = Infinity } = options;

  if (map.domainDim !== map.codomainDim) {
    throw new Error(
      `newtonStep: expected a square system, got ℝ^${map.domainDim} → ℝ^${map.codomainDim}`,
    );
  }

  const residual = map.value(p);
  const jacobian = map.jacobian(p);

  let delta: number[];
  try {
    delta = luSolve(luDecompose(jacobian as Matrix), Array.from(residual));
  } catch {
    return null; // singular Jacobian
  }
  if (!delta.every(Number.isFinite)) return null;

  let scale = 1;
  const length = norm(delta);
  if (length > maxStepLength) scale = maxStepLength / length;

  return p.map((c, i) => c - scale * delta[i]);
}

/**
 * Run Newton's method to convergence (or to `maxIterations`).
 *
 * @example
 *   const result = newton(squareSystem, [0.3, 0.8, 0.7]);
 *   result.residuals;  // [1.2e-1, 8.0e-3, 4.1e-6, 1.5e-12, 1.1e-16]
 */
export function newton(
  map: DifferentiableMap,
  start: number[],
  options: NewtonOptions = {},
): NewtonResult {
  const { maxIterations = 40, tolerance = 1e-14 } = options;

  const iterates: number[][] = [start.slice()];
  const residuals: number[] = [norm(map.value(start))];
  let p = start.slice();

  for (let i = 0; i < maxIterations; i++) {
    if (residuals[residuals.length - 1] <= tolerance) break;

    const next = newtonStep(map, p, options);
    if (next === null) break;

    p = next;
    iterates.push(p.slice());
    residuals.push(norm(map.value(p)));
  }

  return {
    point: p,
    iterates,
    residuals,
    converged: residuals[residuals.length - 1] <= tolerance,
  };
}
