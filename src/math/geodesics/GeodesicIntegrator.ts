import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { MetricPatch, SurfaceDomain, ChristoffelSymbols } from '@/math/surfaces/types';
import { christoffelFromMetric } from '@/math/surfaces/christoffel';
import type { TangentVector, BoundedIntegrationResult, BoundaryEdge } from './types';

/**
 * Options for GeodesicIntegrator
 */
export interface GeodesicIntegratorOptions {
  /**
   * Integration step size (default: 0.01)
   * Smaller = more accurate but slower
   */
  stepSize?: number;
}

/**
 * GeodesicIntegrator
 *
 * Integrates the geodesic equation on a `MetricPatch` using RK4.
 *
 * A geodesic is the "straightest possible" curve on a Riemannian surface,
 * satisfying:
 *   d²u^k/dt² + Γ^k_ij (du^i/dt)(du^j/dt) = 0
 *
 * Where Γ^k_ij are the Christoffel symbols of the patch's metric. Any
 * `DifferentialSurface` (embedding + induced metric) works, as does any
 * abstract metric — the integrator only touches `computeMetric` and
 * optionally `computeChristoffel`.
 *
 * **Note on step size vs frame time:**
 * The integrator uses a fixed `stepSize` in parameter space, NOT wall-clock time.
 * This ensures consistent geodesic paths regardless of frame rate. Each call to
 * `integrate()` advances the geodesic by exactly `stepSize` in arc-length-like
 * parameter space units.
 *
 * @example
 *   const torus = new Torus({ R: 2, r: 1 });
 *   const integrator = new GeodesicIntegrator(torus, { stepSize: 0.01 });
 *
 *   let state: TangentVector = {
 *     position: [0, 0],
 *     velocity: [1, 0]
 *   };
 *
 *   // Each call advances by stepSize (independent of frame rate)
 *   for (let i = 0; i < 100; i++) {
 *     state = integrator.integrate(state);
 *   }
 */
export class GeodesicIntegrator implements Parametric {
  readonly params = new Params(this);

  private patch: MetricPatch;

  /**
   * Integration step size
   * Smaller values are more accurate but require more computation
   */
  declare stepSize: number;

  constructor(
    patch: MetricPatch,
    options: GeodesicIntegratorOptions = {}
  ) {
    this.patch = patch;

    // Define parameters and dependencies
    this.params
      .define('stepSize', options.stepSize ?? 0.01)
      .dependOn(patch);
  }

  /**
   * Integrate geodesic equation one step forward
   *
   * Uses RK4 (4th order Runge-Kutta) for numerical integration.
   * Advances by exactly `stepSize` in parameter space.
   *
   * @param state - Current state (position and velocity on surface)
   * @returns New state after integration
   */
  integrate(state: TangentVector): TangentVector {
    const h = this.stepSize;

    // RK4 integration
    const k1 = this.derivative(state);

    const k2 = this.derivative({
      position: [
        state.position[0] + 0.5 * h * k1.position[0],
        state.position[1] + 0.5 * h * k1.position[1]
      ],
      velocity: [
        state.velocity[0] + 0.5 * h * k1.velocity[0],
        state.velocity[1] + 0.5 * h * k1.velocity[1]
      ]
    });

    const k3 = this.derivative({
      position: [
        state.position[0] + 0.5 * h * k2.position[0],
        state.position[1] + 0.5 * h * k2.position[1]
      ],
      velocity: [
        state.velocity[0] + 0.5 * h * k2.velocity[0],
        state.velocity[1] + 0.5 * h * k2.velocity[1]
      ]
    });

    const k4 = this.derivative({
      position: [
        state.position[0] + h * k3.position[0],
        state.position[1] + h * k3.position[1]
      ],
      velocity: [
        state.velocity[0] + h * k3.velocity[0],
        state.velocity[1] + h * k3.velocity[1]
      ]
    });

    // Combine using RK4 formula
    return {
      position: [
        state.position[0] + (h / 6) * (k1.position[0] + 2 * k2.position[0] + 2 * k3.position[0] + k4.position[0]),
        state.position[1] + (h / 6) * (k1.position[1] + 2 * k2.position[1] + 2 * k3.position[1] + k4.position[1])
      ],
      velocity: [
        state.velocity[0] + (h / 6) * (k1.velocity[0] + 2 * k2.velocity[0] + 2 * k3.velocity[0] + k4.velocity[0]),
        state.velocity[1] + (h / 6) * (k1.velocity[1] + 2 * k2.velocity[1] + 2 * k3.velocity[1] + k4.velocity[1])
      ]
    };
  }

  /**
   * Integrate with domain boundary checking
   *
   * If the geodesic would step outside the domain, uses bisection to find
   * the exact boundary intersection point.
   *
   * @param state - Current state (position and velocity on surface)
   * @param domain - Domain bounds to check against
   * @returns Integration result with boundary hit information
   *
   * @example
   *   const result = integrator.integrateBounded(state, surface.getDomain());
   *   if (result.hitBoundary) {
   *     console.log(`Hit ${result.boundaryEdge} boundary`);
   *   }
   */
  integrateBounded(state: TangentVector, domain: SurfaceDomain): BoundedIntegrationResult {
    // First, check if we're already outside (shouldn't happen, but be safe)
    if (!this.isInDomain(state.position, domain)) {
      return {
        state,
        hitBoundary: true,
        boundaryEdge: this.whichBoundary(state.position, domain)
      };
    }

    // Try a full step
    const next = this.integrate(state);

    // If still inside, we're done
    if (this.isInDomain(next.position, domain)) {
      return {
        state: next,
        hitBoundary: false
      };
    }

    // We stepped outside - use bisection to find exact boundary crossing
    return this.bisectToBoundary(state, next, domain);
  }

  /**
   * Check if a position is within the domain bounds
   */
  isInDomain(position: [number, number], domain: SurfaceDomain): boolean {
    const [u, v] = position;
    return (
      u >= domain.uMin &&
      u <= domain.uMax &&
      v >= domain.vMin &&
      v <= domain.vMax
    );
  }

  /**
   * Determine which boundary edge a point is closest to / beyond
   */
  private whichBoundary(position: [number, number], domain: SurfaceDomain): BoundaryEdge {
    const [u, v] = position;

    // Check which boundary is violated (or closest to being violated)
    const violations: { edge: BoundaryEdge; distance: number }[] = [
      { edge: 'uMin', distance: domain.uMin - u },
      { edge: 'uMax', distance: u - domain.uMax },
      { edge: 'vMin', distance: domain.vMin - v },
      { edge: 'vMax', distance: v - domain.vMax }
    ];

    // Return the most violated boundary
    let worst = violations[0];
    for (const v of violations) {
      if (v.distance > worst.distance) {
        worst = v;
      }
    }

    return worst.edge;
  }

  /**
   * Use bisection to find the exact boundary crossing point
   *
   * Binary search between an inside point and outside point to find
   * where the geodesic crosses the boundary.
   */
  private bisectToBoundary(
    inside: TangentVector,
    outside: TangentVector,
    domain: SurfaceDomain,
    maxIterations: number = 20
  ): BoundedIntegrationResult {
    let lo = 0;  // Fraction where we're inside
    let hi = 1;  // Fraction where we're outside

    // Binary search for the crossing point
    for (let i = 0; i < maxIterations; i++) {
      const mid = (lo + hi) / 2;
      const midState = this.lerpState(inside, outside, mid);

      if (this.isInDomain(midState.position, domain)) {
        lo = mid;  // Still inside, search higher
      } else {
        hi = mid;  // Outside, search lower
      }

      // Early exit if we've converged enough
      if (hi - lo < 1e-6) {
        break;
      }
    }

    // Return the last known inside state
    const finalState = this.lerpState(inside, outside, lo);
    const boundaryEdge = this.whichBoundary(
      this.lerpState(inside, outside, hi).position,
      domain
    );

    return {
      state: finalState,
      hitBoundary: true,
      boundaryEdge,
      stepFraction: lo
    };
  }

  /**
   * Linear interpolation between two states
   */
  private lerpState(a: TangentVector, b: TangentVector, t: number): TangentVector {
    return {
      position: [
        a.position[0] + t * (b.position[0] - a.position[0]),
        a.position[1] + t * (b.position[1] - a.position[1])
      ],
      velocity: [
        a.velocity[0] + t * (b.velocity[0] - a.velocity[0]),
        a.velocity[1] + t * (b.velocity[1] - a.velocity[1])
      ]
    };
  }

  /**
   * Compute derivative for geodesic equation
   *
   * Returns d/dt of state = [position, velocity]
   * For geodesics: d/dt[u, v] = [u̇, v̇]
   *                d/dt[u̇, v̇] = [-Γ^k_ij u̇^i u̇^j, ...]
   */
  private derivative(state: TangentVector): TangentVector {
    const [u, v] = state.position;
    const [u_dot, v_dot] = state.velocity;

    const gamma = this.computeChristoffel(u, v);

    // Geodesic equation: d²u^k/dt² = -Γ^k_ij (du^i/dt)(du^j/dt)
    const u_ddot = -(
      gamma.gamma_1_11 * u_dot * u_dot +
      2 * gamma.gamma_1_12 * u_dot * v_dot +
      gamma.gamma_1_22 * v_dot * v_dot
    );

    const v_ddot = -(
      gamma.gamma_2_11 * u_dot * u_dot +
      2 * gamma.gamma_2_12 * u_dot * v_dot +
      gamma.gamma_2_22 * v_dot * v_dot
    );

    return {
      position: [u_dot, v_dot],      // d/dt[u, v] = [u̇, v̇]
      velocity: [u_ddot, v_ddot]     // d/dt[u̇, v̇] = [ü, v̈]
    };
  }

  /**
   * Christoffel symbols at (u, v).
   *
   * Uses the patch's analytic `computeChristoffel` when provided; otherwise
   * falls back to finite differences over `computeMetric`.
   */
  private computeChristoffel(u: number, v: number): ChristoffelSymbols {
    return this.patch.computeChristoffel?.(u, v)
      ?? christoffelFromMetric(this.patch, u, v);
  }

  /**
   * Rebuild method for Parametric interface
   *
   * Called when surface parameters change. Currently we compute
   * Christoffel symbols on-the-fly, so no caching to rebuild.
   */
  rebuild(): void {
    // Could cache Christoffel symbols here for optimization
    // For now, we compute them on-the-fly during integration
  }
}
