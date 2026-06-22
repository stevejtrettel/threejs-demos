/**
 * Relativity types: spacetimes and their coordinate charts.
 *
 * The organizing idea of this module is the separation of a **spacetime** (a
 * physical solution — Schwarzschild of mass M, a Majumdar–Papapetrou cluster)
 * from a **chart** (one coordinate presentation of it). The same spacetime
 * exposes several charts, and you draw geodesics / light cones in whichever
 * one you pick.
 *
 * The unifying technical fact: **every chart is a `Manifold`.** A Lorentzian
 * spacetime chart is an (n+1)-D pseudo-Riemannian manifold whose null
 * geodesics are light rays; the *optical* chart of a static spacetime is the
 * n-D Riemannian manifold (the Fermat metric) whose geodesics are the spatial
 * projections of those light rays. Both flow through the single n-D
 * `geodesicDeriv` in `math/geodesics`.
 *
 * Sign convention: **mostly-plus** Lorentzian signature `(−,+,…,+)`. The time
 * coordinate carries the minus sign, so `g_tt < 0` and the squared lapse is
 * `N² = −g_tt > 0`. A velocity `v` is timelike when `g(v,v) < 0`, null when
 * `g(v,v) = 0`, spacelike when `g(v,v) > 0`.
 *
 * No THREE.js here — charts are pure geometry. The `embed` map returns a plain
 * `[x, y, z]` tuple; the rendering layer (`funnel`, `lightcone`, demos) lifts
 * those into `THREE.Vector3`. This keeps the math layer renderer-agnostic.
 */

import type { Manifold } from '@/math/manifolds';

/** Metric signature class. */
export type Signature = 'lorentzian' | 'riemannian';

/** A point mapped to visualization space. */
export type Vec3Tuple = [number, number, number];

/**
 * A coordinate chart on a spacetime — a `Manifold` plus the metadata the
 * relativity layer needs (which coordinate is time, how to draw it).
 */
export interface Chart extends Manifold {
  /** Human-readable chart name, e.g. `'standard'`, `'optical'`. */
  readonly name: string;

  /** Lorentzian (a spacetime chart) or Riemannian (an optical/spatial chart). */
  readonly signature: Signature;

  /**
   * Index of the timelike coordinate, or `null` for a purely spatial
   * (Riemannian) chart. For a static spacetime chart this is the coordinate
   * whose metric component is negative; the remaining coordinates are spatial.
   */
  readonly timeIndex: number | null;

  /**
   * Map chart coordinates to a point in visualization space `[x, y, z]`.
   *
   * Visualization-only: not used by any intrinsic computation. For a
   * spacetime chart this places the spatial coordinates in a plane and time
   * along the vertical axis (a spacetime diagram); for an optical chart it
   * lays the spatial coordinates flat, unless an alternate embedding (the
   * funnel) is substituted by the rendering layer.
   */
  embed(coords: number[]): Vec3Tuple;

  /**
   * Optional time-orientation test: is `velocity` future-pointing at `coords`?
   *
   * Needed for horizon-penetrating charts (e.g. ingoing Eddington–Finkelstein),
   * where `g_tt` changes sign across the horizon, so "positive time component"
   * no longer identifies the future. When present, `nullVelocity` uses it to
   * pick the future root of the null condition; when absent, it falls back to a
   * positive time component (correct for static block-diagonal charts).
   */
  futurePointing?(coords: number[], velocity: number[]): boolean;
}

/**
 * A physical spacetime that can present itself in several coordinate charts.
 */
export interface Spacetime {
  /** Human-readable name, e.g. `'Schwarzschild'`. */
  readonly name: string;

  /** Names of the charts this spacetime can produce. */
  chartNames(): string[];

  /**
   * Build (or fetch) a chart by name. Charts read the spacetime's current
   * parameters live, so they stay consistent when masses / positions change.
   */
  chart(name: string): Chart;
}
