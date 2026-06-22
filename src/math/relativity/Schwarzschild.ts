/**
 * Schwarzschild spacetime, restricted to the equatorial plane.
 *
 * The equatorial plane `θ = π/2` of Schwarzschild is totally geodesic (a
 * reflection-symmetry fixed set), so in-plane geodesics stay in-plane and the
 * planar `(t, r, φ)` slice is an exact 2+1 spacetime in its own right:
 *
 *   ds² = −(1 − 2M/r) dt² + (1 − 2M/r)⁻¹ dr² + r² dφ².
 *
 * We carry the spatial slice in **Cartesian** coordinates `(x, y)` rather than
 * `(r, φ)`: no coordinate singularity on the axis, no angle wrap, and light
 * rays that come in from infinity, bend, and fly back out are drawn without
 * special-casing `φ`. Writing `r = √(x²+y²)` and `A = (1 − 2M/r)⁻¹`, the
 * spatial metric is
 *
 *   h = A·(x dx + y dy)²/r²  +  (x dy − y dx)²/r²,
 *
 * i.e. radial part stretched by `A`, angular part flat. The lapse is
 * `N² = 1 − 2M/r`.
 *
 * Charts:
 *   • `'standard'` — the Lorentzian chart `[t, x, y]`. Light cones drawn here
 *     freeze at the horizon (`N → 0`), the standard-coordinate picture.
 *   • `'optical'`  — the Fermat metric `h/N²`; geodesics are spatial light
 *     paths spiralling the photon sphere at `r = 3M`. Pairs with the funnel
 *     embedding in `funnel.ts`.
 *
 * Standard coordinates are singular at the horizon `r = 2M`; that is exactly
 * the freezing we want today. Horizon-penetrating charts (Eddington–
 * Finkelstein) are a later addition and slot in as another `chart(...)` case.
 */

import { Params } from '@/Params';
import { Matrix } from '@/math/linear-algebra';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Chart, Spacetime, Vec3Tuple } from './types';
import { spacetimeChart, opticalChart, type StaticData } from './staticSpacetime';

export interface SchwarzschildOptions {
  /** Mass M (geometric units, G = c = 1). Default 1. */
  mass?: number;
  /** Half-extent of the drawn spatial region. Default 30. */
  extent?: number;
  /** Vertical scale for the time axis in the spacetime chart. Default 1. */
  timeScale?: number;
}

export class Schwarzschild implements Spacetime {
  readonly name = 'Schwarzschild';
  readonly params = new Params(this);

  /** Mass M. Reactive: charts read it live, so changing it updates dependents. */
  declare mass: number;

  private readonly extent: number;
  private readonly timeScale: number;

  constructor(options: SchwarzschildOptions = {}) {
    this.extent = options.extent ?? 30;
    this.timeScale = options.timeScale ?? 1;
    this.params.define('mass', options.mass ?? 1, { triggers: 'rebuild' });
  }

  /** Event-horizon radius `r = 2M`. */
  horizonRadius(): number {
    return 2 * this.mass;
  }

  /** Photon-sphere radius `r = 3M` — the unstable circular null orbit. */
  photonSphereRadius(): number {
    return 3 * this.mass;
  }

  /** Static data (lapse² + spatial metric) bound to the current mass. */
  staticData(): StaticData {
    const self = this;
    const L = this.extent;
    return {
      spaceDim: 2,

      lapseSq(x: number[]): number {
        const r = Math.hypot(x[0], x[1]);
        return 1 - 2 * self.mass / r;
      },

      spatialMetric(x: number[]): Matrix {
        const [X, Y] = x;
        const r2 = X * X + Y * Y;
        const r = Math.sqrt(r2);
        const A = 1 / (1 - 2 * self.mass / r);
        // h_ij = A·(radial projector) + (angular projector)
        //      = A·(x_i x_j / r²) + (δ_ij − x_i x_j / r²)
        const m = new Matrix(2, 2);
        m.data[0] = A * (X * X) / r2 + (Y * Y) / r2; // h_xx
        m.data[1] = (A - 1) * (X * Y) / r2;          // h_xy
        m.data[2] = m.data[1];                        // h_yx
        m.data[3] = A * (Y * Y) / r2 + (X * X) / r2; // h_yy
        return m;
      },

      embedSpace(x: number[]): Vec3Tuple {
        return [x[0], 0, x[1]];
      },

      spaceBounds(): ManifoldDomain {
        return { min: [-L, -L], max: [L, L] };
      },
    };
  }

  chartNames(): string[] {
    return ['standard', 'optical', 'eddingtonFinkelstein'];
  }

  chart(name: string): Chart {
    switch (name) {
      case 'standard':
        return spacetimeChart(this.staticData(), { name: 'standard', timeScale: this.timeScale });
      case 'optical':
        return opticalChart(this.staticData(), { name: 'optical' });
      case 'eddingtonFinkelstein':
        return this.efChart();
      default:
        throw new Error(`Schwarzschild: unknown chart "${name}". Available: ${this.chartNames().join(', ')}.`);
    }
  }

  /**
   * Ingoing Eddington–Finkelstein chart `[t̃, x, y]`, with EF time `t̃ = t + 2M·ln|r/2M − 1|`
   * (advanced time `v = t̃ + r`). The metric is **regular at the horizon**, so null
   * geodesics cross `r = 2M` smoothly and light cones tip *through* it:
   *
   *   ds² = −(1−2M/r) dt̃² + (4M/r) dt̃ dr + (1+2M/r) dr² + r² dφ².
   *
   * In Cartesian spatial coordinates (`r = √(x²+y²)`, radial stretch `A = 1+2M/r`):
   *   g_tt = −(1−2M/r),   g_tx = 2M x/r²,   g_ty = 2M y/r²,
   *   g_xx = A x²/r² + y²/r²,   g_yy = A y²/r² + x²/r²,   g_xy = (A−1) xy/r².
   *
   * Because `g_t̃t̃` flips sign inside the horizon, future-pointing is set by the
   * advanced time increasing (`v̇ = ṫ̃ + ṙ > 0`), not by `ṫ̃ > 0`.
   *
   * No optical chart derives from this one (the `dt̃ dr` cross term makes its
   * optical geometry Randers-type) — use `'standard'`/`'optical'` for that.
   */
  efChart(): Chart {
    const self = this;
    const L = this.extent;
    const ts = this.timeScale;
    return {
      name: 'eddingtonFinkelstein',
      signature: 'lorentzian',
      timeIndex: 0,
      dim: 3,

      getDomainBounds(): ManifoldDomain {
        return { min: [-1000, -L, -L], max: [1000, L, L] };
      },

      computeMetric(p: number[]): Matrix {
        const X = p[1], Y = p[2];
        const r2 = X * X + Y * Y;
        const r = Math.sqrt(r2);
        const M = self.mass;
        const f = 1 - 2 * M / r;
        const A = 1 + 2 * M / r;
        const g = new Matrix(3, 3);
        const d = g.data;
        d[0] = -f;                          // g_tt
        d[1] = d[3] = 2 * M * X / r2;       // g_tx
        d[2] = d[6] = 2 * M * Y / r2;       // g_ty
        d[4] = A * X * X / r2 + Y * Y / r2; // g_xx
        d[8] = A * Y * Y / r2 + X * X / r2; // g_yy
        d[5] = d[7] = (A - 1) * X * Y / r2; // g_xy
        return g;
      },

      futurePointing(coords: number[], vel: number[]): boolean {
        const X = coords[1], Y = coords[2];
        const r = Math.hypot(X, Y);
        const vr = (X * vel[1] + Y * vel[2]) / r; // radial component
        return vel[0] + vr > 1e-9;               // v̇ = ṫ̃ + ṙ
      },

      embed(c: number[]): Vec3Tuple {
        return [c[1], c[0] * ts, c[2]];
      },
    };
  }
}
