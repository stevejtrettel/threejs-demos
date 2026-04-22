import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { SurfaceDomain } from '@/math/surfaces/types';
import { rk4 } from '@/math/ode/steppers';
import type { Stepper } from '@/math/ode/types';
import type { BoundaryEdge } from '@/math/geodesics/types';
import type { VectorField, FlowState, BoundedFlowResult } from './types';

export interface FlowIntegratorOptions {
  /**
   * Integration step size in time (default: 0.01).
   */
  stepSize?: number;

  /**
   * ODE stepper (default: rk4). Swap to `euler` for speed / debugging.
   */
  stepper?: Stepper;
}

/**
 * FlowIntegrator
 *
 * Integrates the ODE `d/dt (u, v) = X(u, v, t)` for a given `VectorField X`.
 *
 * Parallel to `GeodesicIntegrator`, but first-order (state = position only,
 * no separate velocity). Reuses the existing `math/ode/` steppers.
 *
 * **Step size vs frame time:** same convention as `GeodesicIntegrator` — each
 * `integrate()` call advances by exactly `stepSize` in time, independent of
 * wall-clock. That means flow shapes are frame-rate-independent.
 *
 * @example
 *   const field = new FromFunction(
 *     (u, v) => [v, -u],                       // rotation in R²
 *     { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }
 *   );
 *   const integrator = new FlowIntegrator(field, { stepSize: 0.02 });
 *
 *   let state: FlowState = { position: [1, 0], t: 0 };
 *   for (let i = 0; i < 300; i++) {
 *     state = integrator.integrate(state);
 *   }
 */
export class FlowIntegrator implements Parametric {
  readonly params = new Params(this);

  private field: VectorField;
  private stepper: Stepper;

  declare stepSize: number;

  constructor(field: VectorField, options: FlowIntegratorOptions = {}) {
    this.field = field;
    this.stepper = options.stepper ?? rk4;

    this.params
      .define('stepSize', options.stepSize ?? 0.01)
      .dependOn(field);
  }

  /**
   * Advance the flow by one `stepSize` step.
   *
   * The integrator is 2D-locked on its `FlowState.position` type, but calls
   * `field.evaluate` through the n-D interface (single-element array in,
   * `Float64Array` out).
   */
  integrate(state: FlowState): FlowState {
    const deriv = (s: number[], t: number): number[] => {
      const v = this.field.evaluate(s, t);
      return [v[0], v[1]];
    };

    const next = this.stepper(deriv, state.position, state.t, this.stepSize);

    return {
      position: [next[0], next[1]],
      t: state.t + this.stepSize,
    };
  }

  /**
   * Integrate one step with domain boundary checking.
   *
   * Mirrors `GeodesicIntegrator.integrateBounded` — if a full step would
   * leave the domain, bisect to find (approximately) the boundary crossing
   * and report which edge was hit.
   */
  integrateBounded(
    state: FlowState,
    domain: SurfaceDomain,
  ): BoundedFlowResult {
    if (!this.isInDomain(state.position, domain)) {
      return {
        state,
        hitBoundary: true,
        boundaryEdge: this.whichBoundary(state.position, domain),
      };
    }

    const next = this.integrate(state);

    if (this.isInDomain(next.position, domain)) {
      return { state: next, hitBoundary: false };
    }

    return this.bisectToBoundary(state, next, domain);
  }

  private isInDomain(position: [number, number], domain: SurfaceDomain): boolean {
    const [u, v] = position;
    return (
      u >= domain.uMin &&
      u <= domain.uMax &&
      v >= domain.vMin &&
      v <= domain.vMax
    );
  }

  private whichBoundary(
    position: [number, number],
    domain: SurfaceDomain,
  ): BoundaryEdge {
    const [u, v] = position;
    const violations: { edge: BoundaryEdge; distance: number }[] = [
      { edge: 'uMin', distance: domain.uMin - u },
      { edge: 'uMax', distance: u - domain.uMax },
      { edge: 'vMin', distance: domain.vMin - v },
      { edge: 'vMax', distance: v - domain.vMax },
    ];

    let worst = violations[0];
    for (const violation of violations) {
      if (violation.distance > worst.distance) {
        worst = violation;
      }
    }
    return worst.edge;
  }

  private bisectToBoundary(
    inside: FlowState,
    outside: FlowState,
    domain: SurfaceDomain,
    maxIterations: number = 20,
  ): BoundedFlowResult {
    let lo = 0;
    let hi = 1;

    for (let i = 0; i < maxIterations; i++) {
      const mid = (lo + hi) / 2;
      const midState = this.lerpState(inside, outside, mid);

      if (this.isInDomain(midState.position, domain)) {
        lo = mid;
      } else {
        hi = mid;
      }

      if (hi - lo < 1e-6) break;
    }

    const finalState = this.lerpState(inside, outside, lo);
    const boundaryEdge = this.whichBoundary(
      this.lerpState(inside, outside, hi).position,
      domain,
    );

    return {
      state: finalState,
      hitBoundary: true,
      boundaryEdge,
      stepFraction: lo,
    };
  }

  private lerpState(a: FlowState, b: FlowState, t: number): FlowState {
    return {
      position: [
        a.position[0] + t * (b.position[0] - a.position[0]),
        a.position[1] + t * (b.position[1] - a.position[1]),
      ],
      t: a.t + t * (b.t - a.t),
    };
  }
}
