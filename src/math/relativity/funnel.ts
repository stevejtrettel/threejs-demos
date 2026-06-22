/**
 * Funnel embedding of a rotationally-symmetric optical metric.
 *
 * A spherically-symmetric static spacetime has a rotationally-symmetric optical
 * metric. In polar form on the spatial plane,
 *
 *   h^{opt} = h_rr(r) dr² + ρ_c(r)² dφ²,
 *
 * where `ρ_c(r)` is the **circumferential radius** (proper circumference / 2π).
 * Such a metric embeds as a surface of revolution `(ρ_c(r)·cosφ, z(r),
 * ρ_c(r)·sinφ)` provided the meridian can keep up:
 *
 *   ρ_c'(r)² + z'(r)² = h_rr(r)   ⟹   z'(r) = √( h_rr − ρ_c'² ).
 *
 * The embedding exists only where `h_rr ≥ ρ_c'²`. For a black-hole optical
 * metric the throat flares faster than the meridian allows below some radius,
 * so **only the outer portion embeds** — exactly the surface the user wants to
 * draw. We integrate `z` inward from the rim and stop where the radicand goes
 * negative.
 *
 * The resulting `FunnelSurface` is a `Surface` (for meshing) and also exposes
 * `lift(x, y)` mapping a planar optical-chart point onto the funnel, so light
 * rays integrated in the optical metric can be drawn *on* the embedded surface.
 */

import * as THREE from 'three';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import type { Chart } from './types';

/** A radial profile of a rotationally-symmetric metric, sampled at `r`. */
export interface RadialProfile {
  /** Radial metric component `h_rr(r)` (meridian stretch²). */
  hrr: number;
  /** Circumferential radius `ρ_c(r) = √(h_φφ)`. */
  rho: number;
}

/**
 * Extract the radial profile of an optical chart whose spatial coordinates are
 * Cartesian `(x, y)`. Sampling on the `+x` axis at `(r, 0)`: the `x`-direction
 * is radial (`h_rr = g_xx`) and the `y`-direction is angular, with
 * `ρ_c = r·√(g_yy)`.
 */
export function radialFromOpticalChart(chart: Chart): (r: number) => RadialProfile {
  return (r: number) => {
    const g = chart.computeMetric([r, 0]).data;
    return { hrr: g[0], rho: r * Math.sqrt(g[3]) };
  };
}

export interface FunnelOptions {
  /** Outer rim radius (where the funnel starts, ~flat). Default 12. */
  rMax?: number;
  /** Lower bound to attempt; integration stops earlier if embedding fails. */
  rMinTarget?: number;
  /** Number of radial samples. Default 400. */
  samples?: number;
}

/** Integrated funnel profile, radii ascending. */
export interface FunnelProfile {
  /** Sample radii, ascending, over the embeddable range. */
  r: number[];
  /** Circumferential radius at each `r`. */
  rho: number[];
  /** Height at each `r` (≤ 0; rim at z = 0, throat deepest). */
  z: number[];
  /** Innermost radius that still embeds. */
  rMinEmbed: number;
  /** Outer rim radius. */
  rMax: number;
}

/**
 * Integrate the funnel profile inward from the rim, stopping where the surface
 * of revolution can no longer embed the metric.
 */
export function funnelProfile(
  radial: (r: number) => RadialProfile,
  options: FunnelOptions = {},
): FunnelProfile {
  const { rMax = 12, rMinTarget = 1e-3, samples = 400 } = options;
  const dr = (rMax - rMinTarget) / samples;

  // March inward, building arrays in descending r, then reverse.
  const rDesc: number[] = [];
  const rhoDesc: number[] = [];
  const zDesc: number[] = [];

  let z = 0;
  let prevRho = radial(rMax).rho;
  rDesc.push(rMax);
  rhoDesc.push(prevRho);
  zDesc.push(0);

  let rMinEmbed = rMax;
  for (let r = rMax - dr; r > rMinTarget; r -= dr) {
    const { hrr, rho } = radial(r);
    const rhoPrime = (prevRho - rho) / dr; // dρ/dr (prev is at larger r)
    const radicand = hrr - rhoPrime * rhoPrime;
    if (radicand < 0) break; // embedding fails — stop here
    z -= Math.sqrt(radicand) * dr; // going inward, surface descends
    rDesc.push(r);
    rhoDesc.push(rho);
    zDesc.push(z);
    rMinEmbed = r;
    prevRho = rho;
  }

  return {
    r: rDesc.reverse(),
    rho: rhoDesc.reverse(),
    z: zDesc.reverse(),
    rMinEmbed,
    rMax,
  };
}

/**
 * The embeddable optical funnel as a `Surface` of revolution, plus a `lift`
 * from planar optical coordinates onto it.
 */
export class FunnelSurface implements Surface {
  readonly profile: FunnelProfile;

  constructor(profile: FunnelProfile) {
    this.profile = profile;
  }

  /** Build directly from an optical chart. */
  static fromOpticalChart(chart: Chart, options?: FunnelOptions): FunnelSurface {
    return new FunnelSurface(funnelProfile(radialFromOpticalChart(chart), options));
  }

  /** Interpolate (ρ_c, z) at radius `r`, clamped to the embeddable range. */
  private sample(r: number): { rho: number; z: number } {
    const { r: rs, rho, z } = this.profile;
    if (r <= rs[0]) return { rho: rho[0], z: z[0] };
    if (r >= rs[rs.length - 1]) return { rho: rho[rs.length - 1], z: z[rs.length - 1] };
    // Binary search for the bracketing samples.
    let lo = 0, hi = rs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (rs[mid] <= r) lo = mid; else hi = mid;
    }
    const t = (r - rs[lo]) / (rs[hi] - rs[lo]);
    return {
      rho: rho[lo] + t * (rho[hi] - rho[lo]),
      z: z[lo] + t * (z[hi] - z[lo]),
    };
  }

  /** Lift a planar optical-chart point `(x, y)` onto the funnel. */
  lift(x: number, y: number): THREE.Vector3 {
    const r = Math.hypot(x, y);
    const phi = Math.atan2(y, x);
    const { rho, z } = this.sample(r);
    return new THREE.Vector3(rho * Math.cos(phi), z, rho * Math.sin(phi));
  }

  // --- Surface interface (mesh the funnel itself) ---

  evaluate(u: number, v: number): THREE.Vector3 {
    // u: angle ∈ [0, 2π); v ∈ [0, 1] maps rim (0) → throat (1).
    const { rMinEmbed, rMax } = this.profile;
    const r = rMax + v * (rMinEmbed - rMax);
    const { rho, z } = this.sample(r);
    return new THREE.Vector3(rho * Math.cos(u), z, rho * Math.sin(u));
  }

  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 1 };
  }
}
