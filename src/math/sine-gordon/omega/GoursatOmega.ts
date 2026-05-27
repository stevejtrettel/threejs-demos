/**
 * Sine-Gordon solution obtained by solving the Goursat IVP numerically.
 *
 * The user supplies characteristic boundary data:
 *   ω(u, vMin)  via  omegaBottomFn(u),
 *   ω(uMin, v)  via  omegaLeftFn(v),
 * with the consistency requirement omegaBottomFn(uMin) === omegaLeftFn(vMin).
 *
 * `solveGoursat` fills in ω on the interior of the rectangle. The result
 * is bilinearly interpolated for `evaluateAt`; ω_u and ω_v are computed
 * by central differences on the grid (cached on rebuild) and bilinearly
 * interpolated for `partialsAt`.
 *
 * Reactivity. `Nu`, `Nv`, and the rectangle bounds are reactive params;
 * changing any of them triggers a rebuild of the cached grid. The two
 * boundary callbacks are not themselves params — if you want a slider to
 * affect them, capture the slider value in their closure and call
 * `rebuild()` on the field manually.
 *
 * @example Extending the pseudosphere
 *
 *   const omegaP = (u: number, v: number) => 4 * Math.atan(Math.exp(u + v));
 *   let strength = 0;
 *   const ext = new GoursatOmega({
 *     uMin: -3, uMax: -0.1,
 *     vMin: -3, vMax: -0.1,
 *     omegaBottomFn: (u) => omegaP(u, -3) + strength * bump(u),
 *     omegaLeftFn:   (v) => omegaP(-3, v),
 *     Nu: 200, Nv: 200,
 *   });
 *   slider.onChange = (s) => { strength = s; ext.rebuild(); };
 */

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import {
  ScalarField2D,
  type SurfaceDomainLite,
} from '@/math/functions/ScalarField2D';
import { solveGoursat } from '../goursat';

export interface GoursatOmegaOptions {
  /** ω(u, vMin) as a function. */
  omegaBottomFn: (u: number) => number;
  /** ω(uMin, v) as a function. */
  omegaLeftFn: (v: number) => number;

  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;

  /** Grid resolution. Default 200 × 200. */
  Nu?: number;
  Nv?: number;
}

export class GoursatOmega extends ScalarField2D implements Parametric {
  readonly params = new Params(this);

  declare uMin: number;
  declare uMax: number;
  declare vMin: number;
  declare vMax: number;
  declare Nu: number;
  declare Nv: number;

  private omegaBottomFn: (u: number) => number;
  private omegaLeftFn: (v: number) => number;

  // Cached grids (filled in rebuild).
  private grid!: number[][];
  private gridDu!: number[][];
  private gridDv!: number[][];
  private du!: number;
  private dv!: number;

  constructor(options: GoursatOmegaOptions) {
    super();
    this.omegaBottomFn = options.omegaBottomFn;
    this.omegaLeftFn = options.omegaLeftFn;

    this.params
      .define('uMin', options.uMin, { triggers: 'rebuild' })
      .define('uMax', options.uMax, { triggers: 'rebuild' })
      .define('vMin', options.vMin, { triggers: 'rebuild' })
      .define('vMax', options.vMax, { triggers: 'rebuild' })
      .define('Nu', options.Nu ?? 200, { triggers: 'rebuild' })
      .define('Nv', options.Nv ?? 200, { triggers: 'rebuild' });

    this.rebuild();
  }

  /**
   * Replace the boundary callbacks and rebuild. Use this when slider
   * state lives in the demo rather than as a param on this field.
   */
  setBoundary(
    omegaBottomFn: (u: number) => number,
    omegaLeftFn: (v: number) => number,
  ): void {
    this.omegaBottomFn = omegaBottomFn;
    this.omegaLeftFn = omegaLeftFn;
    this.rebuild();
  }

  rebuild(): void {
    const Nu = this.Nu;
    const Nv = this.Nv;
    const du = (this.uMax - this.uMin) / (Nu - 1);
    const dv = (this.vMax - this.vMin) / (Nv - 1);

    const omegaBottom = new Array<number>(Nu);
    for (let i = 0; i < Nu; i++) {
      omegaBottom[i] = this.omegaBottomFn(this.uMin + i * du);
    }
    const omegaLeft = new Array<number>(Nv);
    for (let j = 0; j < Nv; j++) {
      omegaLeft[j] = this.omegaLeftFn(this.vMin + j * dv);
    }
    // Force exact corner consistency to satisfy the solver's check.
    omegaLeft[0] = omegaBottom[0];

    const omega = solveGoursat({ omegaBottom, omegaLeft, du, dv });

    // Central-difference grids of ω_u and ω_v (one-sided at edges).
    const dU: number[][] = new Array(Nu);
    const dV: number[][] = new Array(Nu);
    for (let i = 0; i < Nu; i++) {
      dU[i] = new Array(Nv);
      dV[i] = new Array(Nv);
    }
    for (let i = 0; i < Nu; i++) {
      for (let j = 0; j < Nv; j++) {
        const iLo = Math.max(0, i - 1);
        const iHi = Math.min(Nu - 1, i + 1);
        const jLo = Math.max(0, j - 1);
        const jHi = Math.min(Nv - 1, j + 1);
        dU[i][j] = (omega[iHi][j] - omega[iLo][j]) / ((iHi - iLo) * du);
        dV[i][j] = (omega[i][jHi] - omega[i][jLo]) / ((jHi - jLo) * dv);
      }
    }

    this.grid = omega;
    this.gridDu = dU;
    this.gridDv = dV;
    this.du = du;
    this.dv = dv;
  }

  private gridCoords(
    u: number, v: number,
  ): { i: number; j: number; a: number; b: number } {
    const Nu = this.Nu, Nv = this.Nv;
    const iFloat = (u - this.uMin) / this.du;
    const jFloat = (v - this.vMin) / this.dv;
    const i0 = Math.max(0, Math.min(Nu - 2, Math.floor(iFloat)));
    const j0 = Math.max(0, Math.min(Nv - 2, Math.floor(jFloat)));
    return {
      i: i0,
      j: j0,
      a: Math.max(0, Math.min(1, iFloat - i0)),
      b: Math.max(0, Math.min(1, jFloat - j0)),
    };
  }

  private bilerp(field: number[][], u: number, v: number): number {
    const { i, j, a, b } = this.gridCoords(u, v);
    return (
      (1 - a) * (1 - b) * field[i][j] +
      a * (1 - b) * field[i + 1][j] +
      (1 - a) * b * field[i][j + 1] +
      a * b * field[i + 1][j + 1]
    );
  }

  evaluateAt(u: number, v: number): number {
    return this.bilerp(this.grid, u, v);
  }

  partialsAt(u: number, v: number): [number, number] {
    return [this.bilerp(this.gridDu, u, v), this.bilerp(this.gridDv, u, v)];
  }

  domain2D(): SurfaceDomainLite {
    return {
      uMin: this.uMin, uMax: this.uMax,
      vMin: this.vMin, vMax: this.vMax,
    };
  }
}
