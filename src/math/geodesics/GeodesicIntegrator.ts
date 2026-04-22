import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { SurfaceDomain } from '@/math/surfaces/types';
import type { Manifold } from '@/math/manifolds';
import { christoffelFromMetric } from '@/math/manifolds';
import type { TangentVector, BoundedIntegrationResult, BoundaryEdge } from './types';

/**
 * Options for GeodesicIntegrator
 */
export interface GeodesicIntegratorOptions {
  /** Integration step size (default: 0.01). */
  stepSize?: number;
}

/**
 * GeodesicIntegrator
 *
 * Integrates the geodesic equation on a 2D `Manifold` using RK4.
 *
 * A geodesic is the "straightest possible" curve on a Riemannian surface,
 * satisfying:
 *   d²u^k/dt² + Γ^k_ij (du^i/dt)(du^j/dt) = 0
 *
 * The patch's `computeMetric` is required; `computeChristoffel?` is used if
 * provided (fast path), otherwise the generic `christoffelFromMetric` is
 * called per step.
 *
 * Fixed-step RK4 in parameter space — deterministic across frame rates.
 */
export class GeodesicIntegrator implements Parametric {
  readonly params = new Params(this);

  private patch: Manifold;

  /** Reusable point buffer — avoids allocating `number[]` every evaluate. */
  private readonly pBuf: number[] = [0, 0];

  declare stepSize: number;

  constructor(
    patch: Manifold,
    options: GeodesicIntegratorOptions = {}
  ) {
    if (patch.dim !== 2) {
      throw new Error(`GeodesicIntegrator: only dim=2 is supported, got dim=${patch.dim}`);
    }
    this.patch = patch;

    this.params
      .define('stepSize', options.stepSize ?? 0.01)
      .dependOn(patch);
  }

  /** Integrate one RK4 step, advancing `stepSize` in parameter space. */
  integrate(state: TangentVector): TangentVector {
    const h = this.stepSize;

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

  integrateBounded(state: TangentVector, domain: SurfaceDomain): BoundedIntegrationResult {
    if (!this.isInDomain(state.position, domain)) {
      return {
        state,
        hitBoundary: true,
        boundaryEdge: this.whichBoundary(state.position, domain)
      };
    }

    const next = this.integrate(state);

    if (this.isInDomain(next.position, domain)) {
      return { state: next, hitBoundary: false };
    }

    return this.bisectToBoundary(state, next, domain);
  }

  isInDomain(position: [number, number], domain: SurfaceDomain): boolean {
    const [u, v] = position;
    return (
      u >= domain.uMin && u <= domain.uMax &&
      v >= domain.vMin && v <= domain.vMax
    );
  }

  private whichBoundary(position: [number, number], domain: SurfaceDomain): BoundaryEdge {
    const [u, v] = position;
    const violations: { edge: BoundaryEdge; distance: number }[] = [
      { edge: 'uMin', distance: domain.uMin - u },
      { edge: 'uMax', distance: u - domain.uMax },
      { edge: 'vMin', distance: domain.vMin - v },
      { edge: 'vMax', distance: v - domain.vMax }
    ];
    let worst = violations[0];
    for (const v of violations) if (v.distance > worst.distance) worst = v;
    return worst.edge;
  }

  private bisectToBoundary(
    inside: TangentVector,
    outside: TangentVector,
    domain: SurfaceDomain,
    maxIterations: number = 20
  ): BoundedIntegrationResult {
    let lo = 0, hi = 1;
    for (let i = 0; i < maxIterations; i++) {
      const mid = (lo + hi) / 2;
      const midState = this.lerpState(inside, outside, mid);
      if (this.isInDomain(midState.position, domain)) lo = mid;
      else hi = mid;
      if (hi - lo < 1e-6) break;
    }
    const finalState = this.lerpState(inside, outside, lo);
    const boundaryEdge = this.whichBoundary(
      this.lerpState(inside, outside, hi).position, domain
    );
    return { state: finalState, hitBoundary: true, boundaryEdge, stepFraction: lo };
  }

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
   * Geodesic derivative. For 2D: read 6 Christoffel coefficients from the
   * flat `Float64Array` layout `Γ[k*4 + i*2 + j]`.
   */
  private derivative(state: TangentVector): TangentVector {
    const [u, v] = state.position;
    const [u_dot, v_dot] = state.velocity;

    this.pBuf[0] = u; this.pBuf[1] = v;
    const chr = this.patch.computeChristoffel?.(this.pBuf)
      ?? christoffelFromMetric((p) => this.patch.computeMetric(p), this.pBuf);

    // Γ[k*4 + i*2 + j]. For 2D the upper-k=0 block is chr[0..3], k=1 is chr[4..7].
    // Contraction Γ^k_ij u̇^i u̇^j uses symmetry Γ^k_12 = Γ^k_21 (store at idx 1 & 2).
    const g1_11 = chr[0];
    const g1_12 = chr[1];
    const g1_22 = chr[3];
    const g2_11 = chr[4];
    const g2_12 = chr[5];
    const g2_22 = chr[7];

    const u_ddot = -(g1_11 * u_dot * u_dot + 2 * g1_12 * u_dot * v_dot + g1_22 * v_dot * v_dot);
    const v_ddot = -(g2_11 * u_dot * u_dot + 2 * g2_12 * u_dot * v_dot + g2_22 * v_dot * v_dot);

    return {
      position: [u_dot, v_dot],
      velocity: [u_ddot, v_ddot]
    };
  }

  rebuild(): void {
    // Christoffel is computed on the fly; nothing to cache.
  }
}
