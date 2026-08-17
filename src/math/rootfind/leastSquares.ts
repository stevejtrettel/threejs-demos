/**
 * The least-squares objective attached to a map.
 *
 * Given `F: ℝⁿ → ℝᵐ` and a target `c ∈ ℝᵐ`, solving `F = c` is the same as
 * minimizing
 *
 *     φ(p) = ½‖F(p) − c‖²,     ∇φ(p) = DF(p)ᵀ (F(p) − c).
 *
 * The two are equivalent only where the minimum is actually zero, which is the
 * point: descent on φ is a *search*, and it can stall at a positive local
 * minimum where no solution exists. That failure mode is a feature of the
 * picture, not something to hide.
 *
 * The ½ is what makes the gradient come out without a stray factor of 2; it
 * rescales the objective, never the location of its minima.
 */

import type { DifferentiableMap, ScalarObjective } from './types';

/**
 * `φ(p) = ½‖F(p) − c‖²` as a `ScalarObjective`.
 *
 * `target` defaults to the origin, i.e. plain `½‖F‖²`.
 *
 * @example
 *   const phi = leastSquaresObjective(F, [0, 1]);
 *   phi.gradient([0.3, 0.8, 0.7]);   // DFᵀ(F − c)
 */
export function leastSquaresObjective(
  map: DifferentiableMap,
  target?: number[],
): ScalarObjective {
  const c = target ?? new Array(map.codomainDim).fill(0);
  if (c.length !== map.codomainDim) {
    throw new Error(
      `leastSquaresObjective: target has length ${c.length}, expected ${map.codomainDim}`,
    );
  }

  return {
    dim: map.domainDim,

    value(p: number[]): number {
      const v = map.value(p);
      let sum = 0;
      for (let i = 0; i < c.length; i++) {
        const d = v[i] - c[i];
        sum += d * d;
      }
      return 0.5 * sum;
    },

    gradient(p: number[]): Float64Array {
      const v = map.value(p);
      const J = map.jacobian(p);
      const out = new Float64Array(map.domainDim);
      for (let i = 0; i < c.length; i++) {
        const d = v[i] - c[i];
        for (let k = 0; k < map.domainDim; k++) out[k] += J.get(i, k) * d;
      }
      return out;
    },
  };
}

/** `‖F(p) − c‖` — how far `p` is from solving the system. */
export function residualNorm(
  map: DifferentiableMap,
  target: number[],
  p: number[],
): number {
  const v = map.value(p);
  let sum = 0;
  for (let i = 0; i < target.length; i++) {
    const d = v[i] - target[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
