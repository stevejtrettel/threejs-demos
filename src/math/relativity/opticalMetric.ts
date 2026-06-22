/**
 * Optical (Fermat) metric of a static spacetime chart.
 *
 * For a static, block-diagonal Lorentzian metric `ds² = −N²dt² + h_ij dx^i dx^j`
 * the null geodesics, projected to space, are exactly the geodesics of the
 * Riemannian **optical metric**
 *
 *   h^{opt}_ij = h_ij / N².
 *
 * This is the optical-metric theorem (equivalently Fermat's principle for
 * static spacetimes). This module derives that chart from *any* such
 * spacetime chart, so a spacetime only has to supply its Lorentzian chart and
 * gets the optical one for free — and the derivation can be checked against a
 * spacetime's hand-written optical chart.
 *
 * **Requires a static, block-diagonal chart** (`g_{t,i} = 0`). Stationary
 * charts with a `dt dx` cross term (e.g. ingoing Eddington–Finkelstein) have a
 * Randers-type optical geometry with a magnetic one-form, which this simple
 * `h/N²` form does not capture; deriving the optical chart from those is out of
 * scope. We assert block-diagonality so misuse fails loudly.
 */

import { Matrix } from '@/math/linear-algebra';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Chart, Vec3Tuple } from './types';

const CROSS_TERM_TOL = 1e-9;

/**
 * Derive the optical chart `h/N²` from a static block-diagonal Lorentzian
 * chart. The resulting chart is Riemannian, of dimension `chart.dim − 1`, with
 * the time coordinate dropped; spatial coordinates keep their order.
 *
 * The plot map evaluates the parent chart's `embed` at the `t = 0` slice, so
 * optical-chart points land in the spatial plane of the spacetime diagram.
 */
export function opticalMetric(chart: Chart, sampleAt?: number[]): Chart {
  const tIdx = chart.timeIndex;
  if (tIdx === null) {
    throw new Error('opticalMetric: chart is already spatial (timeIndex is null).');
  }
  const n = chart.dim;
  const sdim = n - 1;

  // Map spatial-coordinate index → full-chart-coordinate index (skip time).
  const spatialIdx: number[] = [];
  for (let a = 0; a < n; a++) if (a !== tIdx) spatialIdx.push(a);

  // Validate block-diagonality once, at a representative point.
  {
    const probe = sampleAt ?? fullCoordsAtOrigin(chart, tIdx);
    const g = chart.computeMetric(probe).data;
    for (const a of spatialIdx) {
      if (Math.abs(g[tIdx * n + a]) > CROSS_TERM_TOL) {
        throw new Error(
          `opticalMetric: chart "${chart.name}" has a time–space cross term ` +
          `g_{t,${a}} ≠ 0; its optical geometry is Randers-type and not h/N².`,
        );
      }
    }
  }

  const full = new Array(n).fill(0);

  return {
    name: `${chart.name}-optical`,
    signature: 'riemannian',
    timeIndex: null,
    dim: sdim,

    getDomainBounds(): ManifoldDomain {
      const b = chart.getDomainBounds();
      return {
        min: spatialIdx.map((a) => b.min[a]),
        max: spatialIdx.map((a) => b.max[a]),
      };
    },

    computeMetric(x: number[]): Matrix {
      for (let s = 0; s < sdim; s++) full[spatialIdx[s]] = x[s];
      const g = chart.computeMetric(full).data;
      const N2 = -g[tIdx * n + tIdx];

      const hopt = new Matrix(sdim, sdim);
      for (let a = 0; a < sdim; a++) {
        for (let b = 0; b < sdim; b++) {
          hopt.data[a * sdim + b] = g[spatialIdx[a] * n + spatialIdx[b]] / N2;
        }
      }
      return hopt;
    },

    embed(x: number[]): Vec3Tuple {
      for (let s = 0; s < sdim; s++) full[spatialIdx[s]] = x[s];
      full[tIdx] = 0;
      return chart.embed(full);
    },
  };
}

/** Full-chart coordinates at the spatial origin, `t = 1` (avoids r = 0 axes). */
function fullCoordsAtOrigin(chart: Chart, tIdx: number): number[] {
  const p = new Array(chart.dim).fill(1);
  p[tIdx] = 1;
  return p;
}
