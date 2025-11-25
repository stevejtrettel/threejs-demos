import { Params, subscribeTo } from '@/Params';
import type { Parametric } from '@/math/types';
import type { DifferentialSurface } from '@/math/surfaces/types';
import type { TangentVector, ChristoffelSymbols } from './types';

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
 * Integrates the geodesic equation on a differential surface using RK4.
 *
 * A geodesic is the "straightest possible" curve on a surface, satisfying:
 *   d²u^k/dt² + Γ^k_ij (du^i/dt)(du^j/dt) = 0
 *
 * Where Γ^k_ij are the Christoffel symbols computed from the surface metric.
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
 *   // Integrate forward in time
 *   for (let i = 0; i < 100; i++) {
 *     state = integrator.integrate(state, 0.016);
 *   }
 */
export class GeodesicIntegrator implements Parametric {
  readonly params = new Params(this);

  private surface: DifferentialSurface;

  /**
   * Integration step size
   * Smaller values are more accurate but require more computation
   */
  declare stepSize: number;

  constructor(
    surface: DifferentialSurface,
    options: GeodesicIntegratorOptions = {}
  ) {
    this.surface = surface;

    this.params.define('stepSize', options.stepSize ?? 0.01);

    // Subscribe to surface parameter changes
    subscribeTo(surface, this);
  }

  /**
   * Integrate geodesic equation one step forward
   *
   * Uses RK4 (4th order Runge-Kutta) for numerical integration.
   *
   * @param state - Current state (position and velocity on surface)
   * @param dt - Time step to integrate (uses this.stepSize internally)
   * @returns New state after integration
   */
  integrate(state: TangentVector, dt: number): TangentVector {
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
   * Compute Christoffel symbols using finite differences
   *
   * The Christoffel symbols Γ^k_ij encode how the coordinate system
   * changes as you move around the surface. They're computed from
   * the metric tensor and its derivatives.
   *
   * Formula: Γ^k_ij = (1/2) g^kl (∂g_lj/∂x^i + ∂g_li/∂x^j - ∂g_ij/∂x^l)
   */
  private computeChristoffel(u: number, v: number): ChristoffelSymbols {
    const h = 0.0001; // Finite difference step

    // Compute metric at (u, v)
    const g = this.surface.computeMetric(u, v);
    const E = g.E;
    const F = g.F;
    const G = g.G;

    // Compute metric derivatives using central differences
    const g_u_plus = this.surface.computeMetric(u + h, v);
    const g_u_minus = this.surface.computeMetric(u - h, v);
    const g_v_plus = this.surface.computeMetric(u, v + h);
    const g_v_minus = this.surface.computeMetric(u, v - h);

    const E_u = (g_u_plus.E - g_u_minus.E) / (2 * h);
    const E_v = (g_v_plus.E - g_v_minus.E) / (2 * h);
    const F_u = (g_u_plus.F - g_u_minus.F) / (2 * h);
    const F_v = (g_v_plus.F - g_v_minus.F) / (2 * h);
    const G_u = (g_u_plus.G - g_u_minus.G) / (2 * h);
    const G_v = (g_v_plus.G - g_v_minus.G) / (2 * h);

    // Compute inverse metric: g^ij
    const det = E * G - F * F;
    const E_inv = G / det;  // g^11
    const F_inv = -F / det; // g^12 = g^21
    const G_inv = E / det;  // g^22

    // Compute Christoffel symbols
    // Γ^1_11 = (1/2) [g^11 E_u + g^12 (2F_u - E_v)]
    const gamma_1_11 = 0.5 * (E_inv * E_u + F_inv * (2 * F_u - E_v));

    // Γ^1_12 = (1/2) [g^11 E_v + g^12 G_u]
    const gamma_1_12 = 0.5 * (E_inv * E_v + F_inv * G_u);

    // Γ^1_22 = (1/2) [g^11 (2F_v - G_u) + g^12 (2G_v - G_u)]
    const gamma_1_22 = 0.5 * (E_inv * (2 * F_v - G_u) + F_inv * (2 * G_v - G_u));

    // Γ^2_11 = (1/2) [g^12 E_u + g^22 (2F_u - E_v)]
    const gamma_2_11 = 0.5 * (F_inv * E_u + G_inv * (2 * F_u - E_v));

    // Γ^2_12 = (1/2) [g^12 E_v + g^22 G_u]
    const gamma_2_12 = 0.5 * (F_inv * E_v + G_inv * G_u);

    // Γ^2_22 = (1/2) [g^12 (2F_v - G_u) + g^22 G_v]
    const gamma_2_22 = 0.5 * (F_inv * (2 * F_v - G_u) + G_inv * G_v);

    return {
      gamma_1_11,
      gamma_1_12,
      gamma_1_22,
      gamma_2_11,
      gamma_2_12,
      gamma_2_22
    };
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
