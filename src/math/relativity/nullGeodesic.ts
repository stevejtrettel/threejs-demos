/**
 * Null geodesics: building null initial velocities and sampling light cones.
 *
 * Light rays are the null geodesics of a Lorentzian chart. Two pieces:
 *
 *   • `nullVelocity` — given an event and a *spatial* direction, solve the
 *     null condition `g(v, v) = 0` for the time component, returning a
 *     future-pointing null velocity. Works for any (non-degenerate) chart by
 *     solving the quadratic in `v^t`; for a static block-diagonal metric it
 *     reduces to `v^t = √(h(dir,dir)) / N`.
 *
 *   • `sampleLightCone` — emit a fan of null directions from one event, flow
 *     each as a null geodesic (n-D `geodesicDeriv` + RK4), and return the
 *     resulting grid of plotted points. The union of those rays *is* the light
 *     cone of the event; the rendering layer turns the grid into a surface.
 *
 * Pure geometry — no THREE.js. Points come back as `[x, y, z]` tuples via the
 * chart's `embed`.
 */

import { integrate } from '@/math/ode';
import { geodesicDeriv } from '@/math/geodesics/geodesicFlow';
import type { Chart, Vec3Tuple } from './types';

/**
 * Future-pointing null velocity at `event` with the given spatial direction.
 *
 * @param chart      Lorentzian chart (must have a `timeIndex`).
 * @param event      Full coordinates of the emission event, length `chart.dim`.
 * @param spatialDir Direction in the spatial coordinate basis, length
 *                   `chart.dim − 1` (time slot omitted, remaining order kept).
 * @returns          Null velocity, length `chart.dim`.
 */
export function nullVelocity(chart: Chart, event: number[], spatialDir: number[]): number[] {
  const tIdx = chart.timeIndex;
  if (tIdx === null) {
    throw new Error('nullVelocity: chart is spatial (no timeIndex).');
  }
  const n = chart.dim;
  const spatialIdx: number[] = [];
  for (let a = 0; a < n; a++) if (a !== tIdx) spatialIdx.push(a);

  // Assemble the spatial part of v, leaving the time slot for the unknown.
  const v = new Array(n).fill(0);
  for (let s = 0; s < spatialIdx.length; s++) v[spatialIdx[s]] = spatialDir[s];

  const g = chart.computeMetric(event).data;

  // g(v,v) = A τ² + 2 B τ + C = 0, with τ = v^t.
  const A = g[tIdx * n + tIdx]; // g_tt < 0
  let B = 0;
  let C = 0;
  for (let a = 0; a < n; a++) {
    if (a === tIdx) continue;
    B += g[tIdx * n + a] * v[a];
    for (let b = 0; b < n; b++) {
      if (b === tIdx) continue;
      C += g[a * n + b] * v[a] * v[b];
    }
  }

  const disc = B * B - A * C;
  if (disc < 0) {
    throw new Error('nullVelocity: no real null solution (degenerate metric?).');
  }
  const root = Math.sqrt(disc);
  const tau1 = (-B + root) / A;
  const tau2 = (-B - root) / A;

  // Pick the future-pointing root. For a horizon-penetrating chart the time
  // component flips sign across the horizon, so use its `futurePointing` test;
  // otherwise (static block-diagonal) the future root is the positive one.
  let tau: number;
  if (chart.futurePointing) {
    const a = v.slice(); a[tIdx] = tau1;
    const b = v.slice(); b[tIdx] = tau2;
    if (chart.futurePointing(event, a)) tau = tau1;
    else if (chart.futurePointing(event, b)) tau = tau2;
    else tau = Math.max(tau1, tau2);
  } else {
    tau = tau1 > 0 ? tau1 : tau2;
  }
  v[tIdx] = tau;
  return v;
}

export interface LightConeOptions {
  /** Number of null directions around the spatial circle. Default 128. */
  rays?: number;
  /** Integration steps per ray. Default 600. */
  steps?: number;
  /** Affine step size. Default 0.02. */
  dt?: number;
  /**
   * Optional stop test in full chart coordinates. When a ray's point satisfies
   * it (e.g. inside an event horizon), the ray freezes at its last point so
   * the returned grid stays rectangular. Returns the index where it froze.
   */
  stop?: (coords: number[]) => boolean;
  /**
   * Christoffel finite-difference step for charts without an analytic
   * `computeChristoffel`. Default uses `christoffelFromMetric`'s own default.
   */
  christoffelStep?: number;
}

/**
 * A single null ray's sampled track: plotted points and the raw end state.
 */
export interface NullRay {
  /** Plotted points `[x,y,z]`, length `steps + 1`. */
  points: Vec3Tuple[];
  /** Full chart coordinates at each step (for stop tests / coloring). */
  coords: number[][];
  /** True if the ray hit the `stop` predicate. */
  stopped: boolean;
}

/**
 * Sample the future light cone of `event`: a fan of `rays` null geodesics.
 *
 * Currently specialized to a **2D spatial** chart (`chart.dim === 3`): the
 * directions sweep the unit circle in the spatial plane. The returned rays,
 * stacked, form the grid the rendering layer sweeps into a cone surface.
 */
export function sampleLightCone(
  chart: Chart,
  event: number[],
  options: LightConeOptions = {},
): NullRay[] {
  const { rays = 128, steps = 600, dt = 0.02, stop, christoffelStep } = options;
  if (chart.timeIndex === null) {
    throw new Error('sampleLightCone: needs a Lorentzian chart.');
  }
  if (chart.dim !== 3) {
    throw new Error(`sampleLightCone: only 2D-spatial charts (dim 3) supported, got dim ${chart.dim}.`);
  }

  const deriv = geodesicDeriv(chart, christoffelStep);
  const out: NullRay[] = new Array(rays);

  for (let i = 0; i < rays; i++) {
    const ang = (2 * Math.PI * i) / rays;
    const dir = [Math.cos(ang), Math.sin(ang)];
    const v0 = nullVelocity(chart, event, dir);

    const points: Vec3Tuple[] = new Array(steps + 1);
    const coords: number[][] = new Array(steps + 1);
    let state = [...event, ...v0];
    coords[0] = state.slice(0, 3);
    points[0] = chart.embed(coords[0]);

    let stopped = false;
    for (let k = 1; k <= steps; k++) {
      if (!stopped) {
        const traj = integrate({ deriv, initial: state, dt, steps: 1 });
        state = traj.states[traj.states.length - 1];
        const c = state.slice(0, 3);
        if (stop?.(c) || !c.every(Number.isFinite)) {
          stopped = true;
          coords[k] = coords[k - 1];
          points[k] = points[k - 1];
        } else {
          coords[k] = c;
          points[k] = chart.embed(c);
        }
      } else {
        coords[k] = coords[k - 1];
        points[k] = points[k - 1];
      }
    }
    out[i] = { points, coords, stopped };
  }

  return out;
}

export interface OpticalLightConeOptions {
  /** Number of directions around the spatial circle. Default 160. */
  rays?: number;
  /** Integration steps per ray. Default 400. */
  steps?: number;
  /** Optical-metric affine step. Default 0.04. */
  dt?: number;
  /**
   * Vertical (wavefront-time) scale. The cone is lifted by optical arc length,
   * so `timeScale = 1` gives a genuine 45° light cone in (optical-space, time);
   * smaller values compress it. Default 1.
   */
  timeScale?: number;
  /** Stop test in spatial coordinates `[x, y]` (e.g. near a horizon / hole). */
  stop?: (xy: number[]) => boolean;
  /** Christoffel finite-difference step. */
  christoffelStep?: number;
}

/**
 * The **optical-metric light cone** — the wavefront construction the legacy
 * black-hole demos used, rebuilt on the optical chart.
 *
 * Each null direction is flowed as a geodesic of the 2D Riemannian *optical*
 * metric (the spatial light path), and lifted into spacetime by its optical arc
 * length: a point reached at optical distance `s` is plotted at height `s`. The
 * union is the future light cone — equivalently, the wavefront swept out in
 * time. Because the optical metric merely *slows* light near a horizon (the
 * funnel is infinitely deep) rather than blowing up like coordinate time, rays
 * can spiral right up to the hole, giving the wrapping/refocusing that makes the
 * picture interesting — no early cutoff needed.
 *
 * Returns the same `NullRay` grid as `sampleLightCone`, so `lightConeGeometry`
 * and a length slider work unchanged. The spatial chart must be 2D (`dim === 2`).
 */
export function sampleOpticalLightCone(
  optical: Chart,
  event: number[],
  options: OpticalLightConeOptions = {},
): NullRay[] {
  const { rays = 160, steps = 400, dt = 0.04, timeScale = 1, stop, christoffelStep } = options;
  if (optical.dim !== 2) {
    throw new Error(`sampleOpticalLightCone: needs a 2D optical chart, got dim ${optical.dim}.`);
  }

  const deriv = geodesicDeriv(optical, christoffelStep);
  const out: NullRay[] = new Array(rays);
  const g0 = optical.computeMetric(event).data; // metric at the apex (same for all rays)

  for (let i = 0; i < rays; i++) {
    const ang = (2 * Math.PI * i) / rays;
    const cx = Math.cos(ang);
    const sy = Math.sin(ang);
    // Unit optical speed in this direction.
    const norm = g0[0] * cx * cx + (g0[1] + g0[2]) * cx * sy + g0[3] * sy * sy;
    const speed = 1 / Math.sqrt(norm);
    let state = [event[0], event[1], cx * speed, sy * speed];

    const points: Vec3Tuple[] = new Array(steps + 1);
    const coords: number[][] = new Array(steps + 1);
    coords[0] = [event[0], event[1]];
    points[0] = [event[0], 0, event[1]];

    let stopped = false;
    for (let k = 1; k <= steps; k++) {
      if (!stopped) {
        const traj = integrate({ deriv, initial: state, dt, steps: 1 });
        state = traj.states[traj.states.length - 1];
        const xy = [state[0], state[1]];
        if (stop?.(xy) || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
          stopped = true;
          coords[k] = coords[k - 1];
          points[k] = points[k - 1];
        } else {
          coords[k] = xy;
          points[k] = [xy[0], k * dt * timeScale, xy[1]];
        }
      } else {
        coords[k] = coords[k - 1];
        points[k] = points[k - 1];
      }
    }
    out[i] = { points, coords, stopped };
  }

  return out;
}

/** A traced optical ray with the two natural "clocks" accumulated along it. */
export interface OpticalConeRay {
  /** Spatial path. */
  x: number[];
  y: number[];
  /** Accumulated spatial proper length σ = ∫ N·ds_optical = ∫ ds_space. */
  sigma: number[];
  /** Accumulated coordinate time t = ∫ ds_optical (= optical arc length). */
  t: number[];
}

export interface TraceOpticalConeOptions {
  /** Number of directions around the spatial circle. Default 200. */
  rays?: number;
  /** Integration steps per ray. Default 700. */
  steps?: number;
  /** Optical-metric affine step. Default 0.04. */
  dt?: number;
  /** Squared lapse `N²(x)` of the spacetime — sets how much time runs per step. */
  lapseSq: (xy: number[]) => number;
  /** Stop test in spatial coordinates `[x, y]` (escape / hole core safety). */
  stop?: (xy: number[]) => boolean;
  /** Christoffel finite-difference step. */
  christoffelStep?: number;
}

/**
 * Trace the optical-geodesic rays of a light cone, recording at each step both
 * the **spatial proper length** σ travelled and the **coordinate time** t
 * elapsed. These are the two clocks that distinguish the conformal cone (lift
 * by σ — uniform) from the actual-metric cone (lift by t — which races ahead
 * near the hole, where `N→0`).
 *
 * Integration is in the well-behaved optical metric, so there is no stiffness:
 * a ray that plunges toward a horizon simply accumulates ever more t per unit σ.
 */
export function traceOpticalCone(
  optical: Chart,
  event: number[],
  options: TraceOpticalConeOptions,
): OpticalConeRay[] {
  const { rays = 200, steps = 700, dt = 0.04, lapseSq, stop, christoffelStep } = options;
  if (optical.dim !== 2) {
    throw new Error(`traceOpticalCone: needs a 2D optical chart, got dim ${optical.dim}.`);
  }

  const deriv = geodesicDeriv(optical, christoffelStep);
  const g0 = optical.computeMetric(event).data;
  const out: OpticalConeRay[] = new Array(rays);

  for (let i = 0; i < rays; i++) {
    const ang = (2 * Math.PI * i) / rays;
    const cx = Math.cos(ang);
    const sy = Math.sin(ang);
    const norm = g0[0] * cx * cx + (g0[1] + g0[2]) * cx * sy + g0[3] * sy * sy;
    const speed = 1 / Math.sqrt(norm);
    let state = [event[0], event[1], cx * speed, sy * speed];

    const x = [event[0]];
    const y = [event[1]];
    const sigma = [0];
    const t = [0];
    let sig = 0;

    for (let k = 1; k <= steps; k++) {
      const traj = integrate({ deriv, initial: state, dt, steps: 1 });
      state = traj.states[traj.states.length - 1];
      const xx = state[0];
      const yy = state[1];
      if (!Number.isFinite(xx) || !Number.isFinite(yy) || stop?.([xx, yy])) break;
      const N = Math.sqrt(Math.max(lapseSq([xx, yy]), 0));
      sig += N * dt; // dσ = N · ds_optical
      x.push(xx);
      y.push(yy);
      sigma.push(sig);
      t.push(k * dt);
    }
    out[i] = { x, y, sigma, t };
  }

  return out;
}

export type TraceOpticalRayOptions = Omit<TraceOpticalConeOptions, 'rays'>;

/**
 * Trace a single optical-metric light ray in a given spatial direction,
 * recording its spatial path plus the σ (spatial proper length) and t
 * (coordinate time) clocks — the per-ray primitive behind `traceOpticalCone`.
 *
 * Use it to draw individual geodesics: lift `(x, t·scale, y)` for the spacetime
 * curve, or `(x, 0, y)` for its projection onto the spatial plane.
 */
export function traceOpticalRay(
  optical: Chart,
  event: number[],
  direction: number[],
  options: TraceOpticalRayOptions,
): OpticalConeRay {
  const { steps = 700, dt = 0.04, lapseSq, stop, christoffelStep } = options;
  if (optical.dim !== 2) {
    throw new Error(`traceOpticalRay: needs a 2D optical chart, got dim ${optical.dim}.`);
  }
  const deriv = geodesicDeriv(optical, christoffelStep);
  const g = optical.computeMetric(event).data;

  const dlen = Math.hypot(direction[0], direction[1]);
  const ux = direction[0] / dlen;
  const uy = direction[1] / dlen;
  const norm = g[0] * ux * ux + (g[1] + g[2]) * ux * uy + g[3] * uy * uy;
  const speed = 1 / Math.sqrt(norm);
  let state = [event[0], event[1], ux * speed, uy * speed];

  const x = [event[0]];
  const y = [event[1]];
  const sigma = [0];
  const t = [0];
  let sig = 0;

  for (let k = 1; k <= steps; k++) {
    const traj = integrate({ deriv, initial: state, dt, steps: 1 });
    state = traj.states[traj.states.length - 1];
    const xx = state[0];
    const yy = state[1];
    if (!Number.isFinite(xx) || !Number.isFinite(yy) || stop?.([xx, yy])) break;
    const N = Math.sqrt(Math.max(lapseSq([xx, yy]), 0));
    sig += N * dt;
    x.push(xx);
    y.push(yy);
    sigma.push(sig);
    t.push(k * dt);
  }
  return { x, y, sigma, t };
}

export interface OpticalConeBuildOptions {
  /** Spatial reach to draw out to (in proper length σ). */
  size: number;
  /** Lift blend: 0 = conformal (height = σ, flat top), 1 = actual metric (height = t). */
  blend: number;
  /** Radial samples per ray. Default 240. */
  samples?: number;
  /** Vertical scale. Default 1. */
  timeScale?: number;
}

/**
 * Resample traced cone rays at a common set of spatial-reach values and lift
 * them into a swept cone, blending the two clocks:
 *
 *   height(σ) = ((1 − blend)·σ + blend·t(σ)) · timeScale.
 *
 * Truncating every ray at the same σ (not the same t) is what makes the actual
 * (`blend = 1`) cone bulge upward near the hole while staying ~45° far away.
 * Returns `NullRay[]` for `lightConeGeometry`.
 */
export function opticalConeRays(rays: OpticalConeRay[], options: OpticalConeBuildOptions): NullRay[] {
  const { size, blend, samples = 240, timeScale = 1 } = options;
  const out: NullRay[] = new Array(rays.length);

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    const K = ray.sigma.length - 1;
    const sigMax = ray.sigma[K];

    const points: Vec3Tuple[] = new Array(samples + 1);
    const coords: number[][] = new Array(samples + 1);

    for (let j = 0; j <= samples; j++) {
      const sj = (size * j) / samples;
      let xx: number, yy: number, tt: number, sg: number;
      if (sj >= sigMax) {
        // Beyond this ray's spatial reach (it plunged / left frame): clamp to its end.
        xx = ray.x[K]; yy = ray.y[K]; tt = ray.t[K]; sg = sigMax;
      } else {
        // Binary search for the bracket sigma[a] ≤ sj < sigma[a+1].
        let lo = 0, hi = K;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (ray.sigma[mid] <= sj) lo = mid; else hi = mid;
        }
        const f = (sj - ray.sigma[lo]) / (ray.sigma[hi] - ray.sigma[lo]);
        xx = ray.x[lo] + f * (ray.x[hi] - ray.x[lo]);
        yy = ray.y[lo] + f * (ray.y[hi] - ray.y[lo]);
        tt = ray.t[lo] + f * (ray.t[hi] - ray.t[lo]);
        sg = sj;
      }
      const h = ((1 - blend) * sg + blend * tt) * timeScale;
      points[j] = [xx, h, yy];
      coords[j] = [xx, yy];
    }
    out[i] = { points, coords, stopped: false };
  }

  return out;
}
