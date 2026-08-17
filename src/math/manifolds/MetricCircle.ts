/**
 * MetricCircle.ts
 *
 * A circle carrying a position-dependent metric h(t) dt², t ∈ [0, 2π).
 *
 * The 1-dimensional sibling of `MetricSurface`, and the natural home for the
 * configuration space of a one-degree-of-freedom mechanism, where h is the
 * kinetic-energy metric and the geodesic flow is the physical motion.
 *
 * ## Why this is not just a `GeodesicIntegrator` with `dim = 1`
 *
 * In one dimension the geodesic equation
 *
 *     ẗ = −(h′/2h) ṫ²
 *
 * has the first integral h ṫ² — the energy — so it can be solved once and for
 * all rather than stepped:
 *
 *     ṫ = ± v / √(h(t)),      v = √(h ṫ²) constant.
 *
 * Integrating the second-order form numerically would let the speed drift;
 * flowing with the closed form conserves it identically, which is what a demo
 * running indefinitely needs. Equivalently: a geodesic is the circle traversed
 * at constant speed in *arclength*, and this class is mostly bookkeeping for
 * the arclength coordinate.
 *
 * There is no curvature and there are no distinct geodesics up to speed and
 * direction: the whole content is the reparameterization. Everything below is
 * built on one cumulative table of s(t) = ∫₀ᵗ √h, sampled once per metric.
 */

import { Matrix } from '@/math/linear-algebra';
import type { Manifold, ManifoldDomain } from './types';

const TWO_PI = Math.PI * 2;

export interface MetricCircleOptions {
  /**
   * The metric coefficient h(t) > 0. Must be 2π-periodic; only its values on
   * one period are ever read.
   */
  metric: (t: number) => number;
  /**
   * Samples in the arclength table (default 2048). Arclength is accumulated by
   * Simpson's rule over this many panels, so the table is far more accurate
   * than its size suggests; the count mainly bounds the inverse lookup's
   * resolution before interpolation.
   */
  resolution?: number;
}

export class MetricCircle implements Manifold {
  readonly dim = 1;

  private readonly metric: (t: number) => number;
  private readonly resolution: number;

  /** Cumulative arclength at t = 2πi/resolution, length resolution + 1. */
  private readonly cumulative: Float64Array;
  /** √h at those same sample points — the derivative of `cumulative`. */
  private readonly derivative: Float64Array;

  constructor(options: MetricCircleOptions) {
    this.metric = options.metric;
    this.resolution = options.resolution ?? 2048;
    this.cumulative = new Float64Array(this.resolution + 1);
    this.derivative = new Float64Array(this.resolution + 1);
    this.buildTable();
  }

  // --- Manifold ---------------------------------------------------------------

  getDomainBounds(): ManifoldDomain {
    return { min: [0], max: [TWO_PI] };
  }

  computeMetric(p: number[]): Matrix {
    const m = new Matrix(1, 1);
    m.data[0] = this.metric(wrap(p[0]));
    return m;
  }

  /**
   * Γ¹₁₁ = h′/2h, by central differences.
   *
   * Present for `Manifold` conformance and for anyone wanting to check the
   * second-order geodesic equation; the flow below never needs it. The step is
   * deliberately loose (1e-4 rather than the usual 1e-6) because a linkage
   * metric can be numerically delicate at isolated configurations, where too
   * fine a difference measures rounding rather than slope.
   */
  computeChristoffel(p: number[]): Float64Array {
    const t = wrap(p[0]);
    const e = 1e-4;
    const h = this.metric(t);
    const dh = (this.metric(t + e) - this.metric(t - e)) / (2 * e);
    const out = new Float64Array(1);
    out[0] = dh / (2 * h);
    return out;
  }

  // --- Metric quantities ------------------------------------------------------

  /** h(t). */
  h(t: number): number {
    return this.metric(wrap(t));
  }

  /** √h(t) — the local stretch from parameter to arclength. */
  speed(t: number): number {
    return Math.sqrt(this.metric(wrap(t)));
  }

  /** Total metric circumference ∮ √h dt. */
  get circumference(): number {
    return this.cumulative[this.resolution];
  }

  /**
   * Arclength from t = 0, in [0, circumference).
   *
   * Cubic Hermite within a panel. Linear interpolation would be the obvious
   * choice, but its O(Δt²) error — around 1e-7 here — is large enough to show
   * up when this is inverted, and the panel endpoint slopes are already known
   * exactly (they are √h), so the cubic is free.
   */
  arclengthAt(t: number): number {
    const x = (wrap(t) / TWO_PI) * this.resolution;
    const i = Math.min(Math.floor(x), this.resolution - 1);
    const u = x - i;
    const dt = TWO_PI / this.resolution;

    const s0 = this.cumulative[i];
    const s1 = this.cumulative[i + 1];
    const m0 = this.derivative[i] * dt;
    const m1 = this.derivative[i + 1] * dt;

    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * s0
         + (u3 - 2 * u2 + u) * m0
         + (-2 * u3 + 3 * u2) * s1
         + (u3 - u2) * m1;
  }

  /**
   * Inverse of `arclengthAt`: the parameter t at arclength s.
   *
   * Binary search on the cumulative table, then Newton on ds/dt = √h. Three
   * iterations is comfortably past convergence for any panel-sized bracket.
   */
  parameterAt(s: number): number {
    const total = this.circumference;
    let target = s % total;
    if (target < 0) target += total;

    let lo = 0;
    let hi = this.resolution;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] <= target) lo = mid;
      else hi = mid;
    }

    let t = (lo / this.resolution) * TWO_PI
          + (target - this.cumulative[lo]) / Math.max(this.derivative[lo], 1e-12);
    for (let k = 0; k < 3; k++) {
      const residual = this.arclengthAt(t) - target;
      if (Math.abs(residual) < 1e-15) break;
      t -= residual / Math.max(this.speed(t), 1e-12);
    }
    return wrap(t);
  }

  /** `count` parameter values spaced equally in arclength, starting at `t0`. */
  equallySpaced(count: number, t0 = 0): number[] {
    const s0 = this.arclengthAt(t0);
    const step = this.circumference / count;
    return Array.from({ length: count }, (_, i) => this.parameterAt(s0 + i * step));
  }

  // --- The geodesic flow ------------------------------------------------------

  /**
   * Start a geodesic through parameter `t0` at metric speed `v`.
   *
   * Negative `v` travels the other way. See `CircleGeodesic` for why the state
   * it returns is arclength rather than the parameter.
   */
  geodesic(t0: number, v: number): CircleGeodesic {
    return new CircleGeodesic(this, t0, v);
  }

  /** dt/dτ at t for a geodesic of metric speed `v` — what the ball's rate looks like. */
  parameterRate(t: number, v: number): number {
    return v / this.speed(t);
  }

  /** The metric speed of a motion passing through t at parameter rate `tDot`. */
  speedOf(t: number, tDot: number): number {
    return tDot * this.speed(t);
  }

  // --- Internals --------------------------------------------------------------

  private buildTable(): void {
    const n = this.resolution;
    const dt = TWO_PI / n;
    this.cumulative[0] = 0;
    this.derivative[0] = Math.sqrt(this.metric(0));
    for (let i = 0; i < n; i++) {
      const a = i * dt;
      // Simpson over the panel: exact for cubics, so the table is accurate well
      // past what the panel count alone would give.
      const fa = this.derivative[i];
      const fm = Math.sqrt(this.metric(a + dt / 2));
      const fb = Math.sqrt(this.metric(a + dt));
      this.cumulative[i + 1] = this.cumulative[i] + (dt / 6) * (fa + 4 * fm + fb);
      this.derivative[i + 1] = fb;
    }
  }
}

/**
 * A geodesic on a `MetricCircle`, carried in arclength.
 *
 * The state is `s`, not `t`, and that is the whole point. A geodesic is uniform
 * motion in arclength, so advancing it is `s += v·dτ` — one multiply, with no
 * approximation and nothing to accumulate. Holding the parameter instead would
 * mean converting to arclength and back on every step, and those conversions,
 * accurate as they are, would deposit a little error each time: over a few
 * thousand frames that becomes visible drift in a quantity the mathematics says
 * is exactly conserved.
 */
export class CircleGeodesic {
  private readonly circle: MetricCircle;
  private s: number;

  /** Metric speed. Writing to it re-kicks the geodesic without moving it. */
  speed: number;

  constructor(circle: MetricCircle, t0: number, speed: number) {
    this.circle = circle;
    this.s = circle.arclengthAt(t0);
    this.speed = speed;
  }

  /** Current parameter on the circle. */
  get t(): number {
    return this.circle.parameterAt(this.s);
  }

  /** Current arclength travelled, modulo the circumference. */
  get arclength(): number {
    return this.s;
  }

  /** Move the geodesic to a parameter without changing its speed. */
  setParameter(t: number): void {
    this.s = this.circle.arclengthAt(t);
  }

  /** Advance by proper time `dtau`. */
  advance(dtau: number): void {
    const total = this.circle.circumference;
    this.s = (this.s + this.speed * dtau) % total;
    if (this.s < 0) this.s += total;
  }

  /** dt/dτ right now — the visible rate of the parameter, which is what varies. */
  get parameterRate(): number {
    return this.circle.parameterRate(this.t, this.speed);
  }
}

function wrap(t: number): number {
  const x = t % TWO_PI;
  return x < 0 ? x + TWO_PI : x;
}
