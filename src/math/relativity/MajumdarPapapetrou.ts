/**
 * Majumdar–Papapetrou: a static cluster of extremal charged black holes.
 *
 * The MP solution of the Einstein–Maxwell equations describes any number of
 * extremal Reissner–Nordström black holes held in static equilibrium —
 * electrostatic repulsion exactly balancing gravity. With the holes placed in
 * a plane and rays launched in that plane (a totally geodesic slice), the
 * planar 2+1 spacetime is
 *
 *   ds² = −U⁻² dt² + U² (dx² + dy²),   U(x) = 1 + Σᵢ mᵢ / |x − xᵢ|,
 *
 * the potential `U` being a sum of point sources at the hole locations.
 *
 * Charts:
 *   • `'spacetime'` — Lorentzian `[t, x, y]`; light cones refocus and wrap
 *     around the holes.
 *   • `'optical'`   — the Fermat metric `h/N² = U⁴·δ`, conformally flat. This
 *     is the `U⁴ g_euc` the legacy code integrated; its geodesics are the
 *     bending light rays. (Derivable generically via `opticalMetric`, but we
 *     provide it directly here.)
 *
 * Holes are mutable (drag / restyle); mutating them bumps a reactive epoch so
 * dependents rebuild.
 */

import { Params } from '@/Params';
import { Matrix } from '@/math/linear-algebra';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Chart, Spacetime, Vec3Tuple } from './types';
import { spacetimeChart, opticalChart, type StaticData } from './staticSpacetime';

/** A single extremal black hole: a point source of the MP potential. */
export interface Hole {
  mass: number;
  x: number;
  y: number;
}

export interface MajumdarPapapetrouOptions {
  /** The black holes. Default: two unit-mass holes at (±2, 0). */
  holes?: Hole[];
  /** Half-extent of the drawn spatial region. Default 12. */
  extent?: number;
  /** Vertical scale for the time axis in the spacetime chart. Default 1. */
  timeScale?: number;
}

export class MajumdarPapapetrou implements Spacetime {
  readonly name = 'MajumdarPapapetrou';
  readonly params = new Params(this);

  readonly holes: Hole[];
  private readonly extent: number;
  private readonly timeScale: number;

  /** Reactive epoch — bumped on any hole edit so dependents rebuild. */
  declare epoch: number;

  constructor(options: MajumdarPapapetrouOptions = {}) {
    this.holes = options.holes ?? [
      { mass: 1, x: -2, y: 0 },
      { mass: 1, x: 2, y: 0 },
    ];
    this.extent = options.extent ?? 12;
    this.timeScale = options.timeScale ?? 1;
    this.params.define('epoch', 0, { triggers: 'rebuild' });
  }

  /** Move / restyle a hole and notify dependents. */
  setHole(index: number, patch: Partial<Hole>): void {
    Object.assign(this.holes[index], patch);
    this.epoch = this.epoch + 1;
  }

  /** The MP potential `U(x) = 1 + Σ mᵢ/ρᵢ`. */
  potential(x: number, y: number): number {
    let u = 1;
    for (const h of this.holes) {
      u += h.mass / Math.hypot(x - h.x, y - h.y);
    }
    return u;
  }

  /** Static data (lapse² = U⁻², spatial metric = U²δ) reading holes live. */
  staticData(): StaticData {
    const self = this;
    const L = this.extent;
    return {
      spaceDim: 2,

      lapseSq(x: number[]): number {
        const U = self.potential(x[0], x[1]);
        return 1 / (U * U);
      },

      spatialMetric(x: number[]): Matrix {
        const U = self.potential(x[0], x[1]);
        const U2 = U * U;
        const m = new Matrix(2, 2);
        m.data[0] = U2;
        m.data[3] = U2;
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
    return ['spacetime', 'optical'];
  }

  chart(name: string): Chart {
    const data = this.staticData();
    switch (name) {
      case 'spacetime':
        return spacetimeChart(data, { name: 'spacetime', timeScale: this.timeScale });
      case 'optical':
        return opticalChart(data, { name: 'optical' });
      default:
        throw new Error(`MajumdarPapapetrou: unknown chart "${name}". Available: ${this.chartNames().join(', ')}.`);
    }
  }
}
