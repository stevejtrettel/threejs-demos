/**
 * SineGordonSurface — a surface of constant Gaussian curvature K = -1 built
 * from a sine-Gordon solution ω(u, v).
 *
 * Given an ω-field on a rectangle [uMin, uMax] × [vMin, vMax], the moving
 * frame is integrated by `buildFrameGrid`, producing X(u, v) and the
 * orthonormal frame (T₁, T₂, N) at every grid node. Geometry queries are
 * bilinearly interpolated from the cached grid. Intrinsic and extrinsic
 * quantities are *exact* — the metric is du² + 2 cos ω du dv + dv², the
 * second fundamental form is 2 sin ω du dv, and K ≡ -1.
 *
 * The surface is reactive: changing `Nu`, `Nv`, or any domain bound, or
 * changing the underlying ω-field, triggers a fresh integrator pass.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type {
  DifferentialSurface,
  SurfaceDomain,
  SurfacePartials,
  SecondFundamentalForm,
} from '@/math/surfaces/types';
import { boundsFromSurfaceDomain } from '@/math/surfaces/types';
import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';
import type { ScalarField2D } from '@/math/functions/ScalarField2D';
import { buildFrameGrid, type FrameGrid } from './frameIntegrator';

export interface SineGordonSurfaceOptions {
  /** ω(u, v) as a ScalarField2D. */
  omega: ScalarField2D;

  /** Integration rectangle. Defaults to omega.domain2D(). */
  uMin?: number;
  uMax?: number;
  vMin?: number;
  vMax?: number;

  /** Grid resolution. Defaults to 128 × 128. */
  Nu?: number;
  Nv?: number;
}

export class SineGordonSurface
  implements DifferentialSurface, Parametric
{
  readonly dim = 2 as const;
  readonly params = new Params(this);

  declare uMin: number;
  declare uMax: number;
  declare vMin: number;
  declare vMax: number;
  declare Nu: number;
  declare Nv: number;

  readonly omega: ScalarField2D;
  private grid!: FrameGrid;

  constructor(options: SineGordonSurfaceOptions) {
    this.omega = options.omega;
    const fallback = this.omega.domain2D();

    this.params
      .define('uMin', options.uMin ?? fallback.uMin, { triggers: 'rebuild' })
      .define('uMax', options.uMax ?? fallback.uMax, { triggers: 'rebuild' })
      .define('vMin', options.vMin ?? fallback.vMin, { triggers: 'rebuild' })
      .define('vMax', options.vMax ?? fallback.vMax, { triggers: 'rebuild' })
      .define('Nu', options.Nu ?? 128, { triggers: 'rebuild' })
      .define('Nv', options.Nv ?? 128, { triggers: 'rebuild' })
      .dependOn(this.omega);

    this.rebuild();
  }

  rebuild(): void {
    this.grid = buildFrameGrid({
      omega: this.omega,
      uMin: this.uMin, uMax: this.uMax,
      vMin: this.vMin, vMax: this.vMax,
      Nu: this.Nu, Nv: this.Nv,
    });
  }

  getDomain(): SurfaceDomain {
    return {
      uMin: this.uMin, uMax: this.uMax,
      vMin: this.vMin, vMax: this.vMax,
    };
  }

  getDomainBounds(): ManifoldDomain {
    return boundsFromSurfaceDomain(this.getDomain());
  }

  // ─── Grid interpolation helpers ─────────────────────────────────────────

  /** Continuous grid coordinates (iFloat, jFloat) for parameter (u, v). */
  private gridCoords(u: number, v: number): { i: number; j: number; a: number; b: number } {
    const g = this.grid;
    const iFloat = (u - g.uMin) / g.du;
    const jFloat = (v - g.vMin) / g.dv;
    const i0 = Math.max(0, Math.min(g.Nu - 2, Math.floor(iFloat)));
    const j0 = Math.max(0, Math.min(g.Nv - 2, Math.floor(jFloat)));
    return {
      i: i0,
      j: j0,
      a: Math.max(0, Math.min(1, iFloat - i0)),
      b: Math.max(0, Math.min(1, jFloat - j0)),
    };
  }

  /** Bilinear interpolation of a Vector3 grid (writes into `out`). */
  private bilerp(
    field: THREE.Vector3[][],
    u: number,
    v: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const { i, j, a, b } = this.gridCoords(u, v);
    const p00 = field[i][j];
    const p10 = field[i + 1][j];
    const p01 = field[i][j + 1];
    const p11 = field[i + 1][j + 1];
    out.set(
      (1 - a) * (1 - b) * p00.x + a * (1 - b) * p10.x + (1 - a) * b * p01.x + a * b * p11.x,
      (1 - a) * (1 - b) * p00.y + a * (1 - b) * p10.y + (1 - a) * b * p01.y + a * b * p11.y,
      (1 - a) * (1 - b) * p00.z + a * (1 - b) * p10.z + (1 - a) * b * p01.z + a * b * p11.z,
    );
    return out;
  }

  // ─── Surface interface ─────────────────────────────────────────────────

  evaluate(u: number, v: number): THREE.Vector3 {
    return this.bilerp(this.grid.positions, u, v, new THREE.Vector3());
  }

  computeNormal(u: number, v: number): THREE.Vector3 {
    return this.bilerp(this.grid.N, u, v, new THREE.Vector3()).normalize();
  }

  /**
   * Partials from the stored frame: X_u = T₁, X_v = cos ω · T₁ + sin ω · T₂.
   * The T₁, T₂ at off-grid points are bilinearly interpolated then
   * renormalized — exact at grid nodes, near-exact for fine grids.
   */
  computePartials(u: number, v: number): SurfacePartials {
    const T1 = this.bilerp(this.grid.T1, u, v, new THREE.Vector3()).normalize();
    const T2 = this.bilerp(this.grid.T2, u, v, new THREE.Vector3()).normalize();
    const w = this.omega.evaluateAt(u, v);
    const c = Math.cos(w);
    const s = Math.sin(w);
    const dv = new THREE.Vector3(
      c * T1.x + s * T2.x,
      c * T1.y + s * T2.y,
      c * T1.z + s * T2.z,
    );
    return { du: T1, dv };
  }

  /** Analytic first fundamental form: E = 1, F = cos ω, G = 1. */
  computeMetric(p: number[]): Matrix {
    const F = Math.cos(this.omega.evaluateAt(p[0], p[1]));
    const m = new Matrix(2, 2);
    m.data[0] = 1; m.data[1] = F;
    m.data[2] = F; m.data[3] = 1;
    return m;
  }

  /** Constant by construction. */
  computeGaussianCurvature(_u: number, _v: number): number {
    return -1;
  }

  /** Analytic second fundamental form: L = 0, M = sin ω, N = 0. */
  computeSecondFundamentalForm(u: number, v: number): SecondFundamentalForm {
    return { L: 0, M: Math.sin(this.omega.evaluateAt(u, v)), N: 0 };
  }

  /**
   * Mean curvature H = (EN − 2FM + GL) / (2(EG − F²))
   *               = (-2 cos ω · sin ω) / (2 sin² ω)
   *               = -cot ω.
   */
  computeMeanCurvature(u: number, v: number): number {
    const w = this.omega.evaluateAt(u, v);
    return -Math.cos(w) / Math.sin(w);
  }
}
