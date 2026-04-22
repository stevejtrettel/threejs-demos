/**
 * HopfTorus.ts
 *
 * Pure math class for the Hopf fibration torus.
 *
 * Given a closed curve on S², produces a torus in R³ via:
 *   S² curve  →  Hopf lift to S³  →  stereographic projection to R³
 *
 * The curve alone determines everything about the torus:
 * - The flat metric (fundamental domain shape)
 * - The lattice (derived from fiber period + arc length + holonomy)
 * - The isometric embedding into R³
 *
 * Implements the Surface interface so it can be passed directly to SurfaceMesh.
 * Also provides an isometric embedding from the flat fundamental domain,
 * with methods for lifting curves and points.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable } from '@/types';
import type { Surface, SurfaceDomain } from '../surfaces/types';
import { Lattice2D } from '../lattices/Lattice2D';
import { NumericalCurve } from '../curves/NumericalCurve';
import { toSpherical, fromSphericalCoords, toroidalCoords, stereoProj } from './hopfUtils';

// ── Types ────────────────────────────────────────────────

export interface HopfTorusOptions {
  /** Closed curve on S², t ∈ [0, 2π] → unit Vector3 */
  curve: (t: number) => THREE.Vector3;
  /** Number of samples for precomputation tables (default: 4096) */
  resolution?: number;
}

// ── Helper: spherical coordinate conversion ──────────────

/**
 * Convert a spherical-coordinate curve to a Cartesian S² curve.
 *
 * @example
 *   const curve = fromSpherical(t => ({ theta: t, phi: Math.PI / 3 }));
 *   const hopf = new HopfTorus({ curve });
 */
export function fromSpherical(
  fn: (t: number) => { theta: number; phi: number }
): (t: number) => THREE.Vector3 {
  return (t: number) => fromSphericalCoords(fn(t));
}

/** Linear interpolation into a Float64Array table */
function lerpTable(table: Float64Array, t: number, tMax: number): number {
  const n = table.length - 1;
  const fIdx = (t / tMax) * n;
  const i = Math.max(0, Math.min(n - 1, Math.floor(fIdx)));
  const frac = fIdx - i;
  return table[i] + frac * (table[i + 1] - table[i]);
}

// ── HopfTorus class ──────────────────────────────────────

export class HopfTorus implements Surface, Parametric, Rebuildable {
  readonly params = new Params(this);

  declare curve: (t: number) => THREE.Vector3;
  declare resolution: number;

  // Precomputed tables
  private arcLengthTable!: Float64Array;
  private fudgeTable!: Float64Array;

  // Derived geometry of the fundamental domain
  private totalLength!: number;
  private totalHolonomy!: number;
  private derivedLattice!: Lattice2D;

  /** Height of the fundamental domain (totalLength / 2) */
  get height(): number { return this.totalLength / 2; }

  /** Width of the fundamental domain in the fiber direction (2π) */
  get fiberPeriod(): number { return 2 * Math.PI; }

  /**
   * The edge generator of the fundamental domain parallelogram.
   *
   * The fundamental domain has two generators:
   *   fiber:  (2π, 0)               — horizontal, always the same
   *   edge:   (totalHolonomy, L/2)   — slanted, depends on curve
   *
   * where L is the arc length of the S² curve, and totalHolonomy is the
   * accumulated fiber rotation (∫ sin²(φ/2)·dθ) over the full curve.
   */
  get edgeGenerator(): THREE.Vector2 {
    return new THREE.Vector2(this.totalHolonomy, this.totalLength / 2);
  }

  /**
   * The lattice derived from the S² curve.
   *
   * ω₁ = 2π (fiber period, as complex number [2π, 0])
   * ω₂ = totalHolonomy + i·(totalLength/2)
   */
  get lattice(): Lattice2D { return this.derivedLattice; }

  constructor(options: HopfTorusOptions) {
    this.params
      .define('curve', options.curve, { triggers: 'rebuild' })
      .define('resolution', options.resolution ?? 4096, { triggers: 'rebuild' });

    this.rebuild();
  }

  // ── Surface interface ────────────────────────────────

  /**
   * Direct Hopf parameterization (no isometry correction).
   * (u, v) ∈ [0, 1]² → R³
   */
  evaluate(u: number, v: number): THREE.Vector3 {
    const T = 2 * Math.PI * v;
    const S = 2 * Math.PI * u;
    const { theta, phi } = toSpherical(this.curve(T));
    const p4 = toroidalCoords(theta + S, S, phi / 2);
    return stereoProj(p4);
  }

  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  }

  // ── Sub-surface ──────────────────────────────────────

  /**
   * Create a Surface from a parameterization of the fundamental domain,
   * lifted to the torus via isometricImage.
   *
   * @param parameterization Maps (u, v) ∈ [0,1]² to points in the fundamental domain
   * @returns A Surface that can be passed to SurfaceMesh
   *
   * @example
   *   // Render just the left half of the fundamental domain
   *   const half = hopf.subSurface((u, v) =>
   *     new THREE.Vector2(Math.PI * u, hopf.height * v)
   *   );
   *   scene.add(new SurfaceMesh(half));
   */
  subSurface(
    parameterization: (u: number, v: number) => THREE.Vector2,
  ): Surface {
    return {
      evaluate: (u: number, v: number): THREE.Vector3 => {
        return this.isometricImage(parameterization(u, v));
      },
      getDomain: (): SurfaceDomain => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
    };
  }

  // ── Isometric embedding ──────────────────────────────

  /**
   * Map a point in the flat fundamental domain to R³ via the
   * arc-length-corrected isometric embedding.
   */
  isometricImage(pt: THREE.Vector2): THREE.Vector3 {
    const reduced = this.toFundamentalDomain(pt);
    const s = reduced.x;
    const v = reduced.y;

    // Find curve parameter at arc length 2v
    const t = this.inverseArc(2 * v);

    // Get sphere angles at this parameter
    const { theta, phi } = toSpherical(this.curve(t));

    // Holonomy correction
    const f = this.fudgeFactor(t);

    // Hopf map with correction
    const p4 = toroidalCoords(theta + s - f, s - f, phi / 2);
    return stereoProj(p4);
  }

  // ── Curve lifting ────────────────────────────────────

  /**
   * Lift a curve from the fundamental domain to the torus.
   */
  liftCurve(
    planeCurve: (t: number) => THREE.Vector2,
    options: { samples?: number; closed?: boolean } = {},
  ): NumericalCurve {
    const samples = options.samples ?? 256;
    const closed = options.closed ?? false;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const planarPt = planeCurve(t);
      points.push(this.isometricImage(planarPt));
    }

    return new NumericalCurve({ points, closed });
  }

  /**
   * Horizontal fiber (circle) at position x ∈ [0, 1].
   */
  fiberAt(x: number): NumericalCurve {
    const gen = this.edgeGenerator;
    const ox = gen.x * x;
    const oy = gen.y * x;
    const TWO_PI = 2 * Math.PI;

    return this.liftCurve(
      (s) => new THREE.Vector2(ox + TWO_PI * s, oy),
      { closed: true },
    );
  }

  /**
   * Vertical edge at position x ∈ [0, 1].
   */
  edgeAt(x: number): NumericalCurve {
    const gen = this.edgeGenerator;
    const ox = 2 * Math.PI * x;
    const oy = 0;

    return this.liftCurve(
      (t) => new THREE.Vector2(ox + gen.x * t, oy + gen.y * t),
      { closed: true },
    );
  }

  /**
   * Opposite vertical edge at position x ∈ [0, 1].
   */
  oppEdgeAt(x: number): NumericalCurve {
    const gen = this.edgeGenerator;
    const ox = 2 * Math.PI * x;
    const oy = 0;

    return this.liftCurve(
      (t) => new THREE.Vector2(ox - gen.x * t, oy + gen.y * t),
      { closed: true },
    );
  }

  // ── Point lifting ────────────────────────────────────

  /**
   * Lift a single point from the fundamental domain to R³.
   */
  liftPoint(pt: THREE.Vector2): THREE.Vector3 {
    return this.isometricImage(pt);
  }

  // ── Gridlines ────────────────────────────────────────

  /**
   * Generate n+1 fibers and n+1 edges, evenly spaced.
   * Returns 2·(n+1) NumericalCurves.
   */
  gridlines(n: number): NumericalCurve[] {
    const curves: NumericalCurve[] = [];
    for (let i = 0; i <= n; i++) {
      curves.push(this.fiberAt(i / n));
      curves.push(this.edgeAt(i / n));
    }
    return curves;
  }

  // ── Stereographic scale ──────────────────────────────

  /**
   * Stereographic distortion factor at a point in R³.
   * Useful for scaling tube radii and sphere sizes.
   */
  stereoScale(pt: THREE.Vector3): number {
    return 1 + pt.lengthSq();
  }

  // ── Rebuild ──────────────────────────────────────────

  rebuild(): void {
    this.buildTables();
  }

  dispose(): void {
    this.params.dispose();
  }

  // ── Private: precomputation ──────────────────────────

  private buildTables(): void {
    const N = this.resolution;
    const TWO_PI = 2 * Math.PI;
    const dt = TWO_PI / N;

    this.arcLengthTable = new Float64Array(N + 1);
    this.fudgeTable = new Float64Array(N + 1);

    let arcSum = 0;
    let fudgeSum = 0;

    this.arcLengthTable[0] = 0;
    this.fudgeTable[0] = 0;

    for (let i = 0; i < N; i++) {
      const t0 = i * dt;
      const t1 = (i + 1) * dt;

      const p0 = this.curve(t0);
      const p1 = this.curve(t1);

      const s0 = toSpherical(p0);
      const s1 = toSpherical(p1);

      // Arc length increment: ds² = sin²(φ)·dθ² + dφ²
      // Wrap dtheta to [-π, π] to handle atan2 discontinuity at ±π
      let dtheta = s1.theta - s0.theta;
      if (dtheta > Math.PI) dtheta -= 2 * Math.PI;
      if (dtheta < -Math.PI) dtheta += 2 * Math.PI;
      const dphi = s1.phi - s0.phi;
      const sinPhi = Math.sin(s0.phi);
      const ds = Math.sqrt(sinPhi * sinPhi * dtheta * dtheta + dphi * dphi);
      arcSum += ds;

      // Fudge factor (holonomy): sin²(φ/2)·dθ
      const sinHalfPhi = Math.sin(s0.phi / 2);
      fudgeSum += sinHalfPhi * sinHalfPhi * dtheta;

      this.arcLengthTable[i + 1] = arcSum;
      this.fudgeTable[i + 1] = fudgeSum;
    }

    this.totalLength = arcSum;
    this.totalHolonomy = fudgeSum;

    // Derive lattice from computed geometry:
    // ω₁ = 2π (fiber direction, purely real)
    // ω₂ = totalHolonomy + i·(totalLength/2) (edge direction)
    this.derivedLattice = new Lattice2D(
      [TWO_PI, 0],
      [this.totalHolonomy, this.totalLength / 2],
    );
  }

  /** Interpolate fudge factor at parameter t ∈ [0, 2π] */
  private fudgeFactor(t: number): number {
    return lerpTable(this.fudgeTable, t, 2 * Math.PI);
  }

  /**
   * Invert arc length: given length L, find parameter t such that arcLength(t) ≈ L.
   * Uses binary search on the precomputed table.
   */
  private inverseArc(L: number): number {
    const table = this.arcLengthTable;
    const N = table.length - 1;
    const TWO_PI = 2 * Math.PI;

    // Clamp
    if (L <= 0) return 0;
    if (L >= this.totalLength) return TWO_PI;

    // Binary search for the interval containing L
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] <= L) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    // Linear interpolation within the interval
    const frac = (L - table[lo]) / (table[hi] - table[lo]);
    return ((lo + frac) / N) * TWO_PI;
  }

  /** Reduce a point into the fundamental domain */
  private toFundamentalDomain(pt: THREE.Vector2): THREE.Vector2 {
    const result = pt.clone();
    const gen = this.edgeGenerator;

    // Reduce along the edge generator: project onto y-component
    const edgeSteps = Math.floor(result.y / gen.y);
    result.x -= edgeSteps * gen.x;
    result.y -= edgeSteps * gen.y;

    // Reduce along the fiber direction (period 2π in x)
    const TWO_PI = 2 * Math.PI;
    result.x = result.x - Math.floor(result.x / TWO_PI) * TWO_PI;

    return result;
  }
}
