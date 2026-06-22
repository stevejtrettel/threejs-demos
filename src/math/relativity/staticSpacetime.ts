/**
 * Static spacetimes from a lapse + spatial metric.
 *
 * A **static** spacetime in adapted coordinates has the block-diagonal form
 *
 *   ds² = −N²(x) dt² + h_ij(x) dx^i dx^j,
 *
 * with the lapse `N` and the spatial metric `h` independent of `t` and no
 * `dt dx` cross terms. Both Schwarzschild (in standard coordinates) and the
 * Majumdar–Papapetrou cluster are of this form, so they share one builder.
 *
 * From a `StaticData` (space dimension, lapse², spatial metric, plot map) this
 * module produces two charts:
 *
 *   • `spacetimeChart` — the (n+1)-D Lorentzian chart `[t, x¹…xⁿ]`. Null
 *     geodesics are light rays; sweeping a ring of null directions gives the
 *     light cone of an event.
 *
 *   • `opticalChart` — the n-D Riemannian **Fermat metric** `h_ij / N²`. Its
 *     geodesics are exactly the spatial projections of the null geodesics
 *     above (Fermat's principle / the optical-metric theorem for static
 *     spacetimes). The horizon `N → 0` pushes to infinite optical distance,
 *     which is why light "freezes" there.
 *
 * Christoffel symbols are left to the numerical `christoffelFromMetric` (no
 * analytic `computeChristoffel` is attached). That is accurate to O(h²) and
 * plenty fast for the demos; attach an analytic override later if a hot path
 * needs it.
 */

import { Matrix } from '@/math/linear-algebra';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Chart, Vec3Tuple } from './types';

/**
 * The minimal data defining a static spacetime: how to compute the lapse and
 * spatial metric at a spatial point, plus how to draw spatial points.
 */
export interface StaticData {
  /** Spatial dimension (2 for our planar demos). */
  spaceDim: number;

  /** Squared lapse `N²(x) = −g_tt > 0`. */
  lapseSq(x: number[]): number;

  /** Spatial metric `h_ij(x)` as a `spaceDim × spaceDim` matrix. */
  spatialMetric(x: number[]): Matrix;

  /** Map a spatial point to visualization space `[X, Y, Z]` (flat: Y = 0). */
  embedSpace(x: number[]): Vec3Tuple;

  /** Bounds on the spatial coordinates. */
  spaceBounds(): ManifoldDomain;
}

export interface SpacetimeChartOptions {
  /** Chart name. Default `'spacetime'`. */
  name?: string;
  /** Vertical scale applied to the time coordinate when plotting. Default 1. */
  timeScale?: number;
  /** Half-extent of the time axis for domain bounds. Default 1000. */
  timeBound?: number;
}

/**
 * Build the Lorentzian spacetime chart `[t, x¹…xⁿ]` with `ds² = −N²dt² + h`.
 *
 * Coordinate order is **time first** (`timeIndex = 0`), then the spatial
 * coordinates in `StaticData` order. The plot map lays space flat in the
 * X–Z plane and sends time up the Y axis — a spacetime diagram.
 */
export function spacetimeChart(data: StaticData, options: SpacetimeChartOptions = {}): Chart {
  const { name = 'spacetime', timeScale = 1, timeBound = 1000 } = options;
  const sdim = data.spaceDim;
  const dim = sdim + 1;

  const xbuf = new Array(sdim);

  return {
    name,
    signature: 'lorentzian',
    timeIndex: 0,
    dim,

    getDomainBounds(): ManifoldDomain {
      const sb = data.spaceBounds();
      return {
        min: [-timeBound, ...sb.min],
        max: [timeBound, ...sb.max],
      };
    },

    computeMetric(p: number[]): Matrix {
      for (let i = 0; i < sdim; i++) xbuf[i] = p[i + 1];
      const N2 = data.lapseSq(xbuf);
      const h = data.spatialMetric(xbuf).data;

      const g = new Matrix(dim, dim);
      g.data[0] = -N2; // g_tt
      for (let i = 0; i < sdim; i++) {
        for (let j = 0; j < sdim; j++) {
          g.data[(i + 1) * dim + (j + 1)] = h[i * sdim + j];
        }
      }
      return g;
    },

    embed(coords: number[]): Vec3Tuple {
      for (let i = 0; i < sdim; i++) xbuf[i] = coords[i + 1];
      const [X, Y, Z] = data.embedSpace(xbuf);
      return [X, Y + coords[0] * timeScale, Z];
    },
  };
}

export interface OpticalChartOptions {
  /** Chart name. Default `'optical'`. */
  name?: string;
  /** Override the spatial plot map (e.g. lift onto the embedded funnel). */
  embed?: (x: number[]) => Vec3Tuple;
}

/**
 * Build the optical (Fermat) chart `h_ij / N²` — an n-D Riemannian manifold
 * whose geodesics are the spatial light-ray paths.
 *
 * For a 2D spatial slice this is a `dim = 2` `Manifold`, so it plugs straight
 * into the existing 2D `GeodesicIntegrator` and `MetricSurface`.
 */
export function opticalChart(data: StaticData, options: OpticalChartOptions = {}): Chart {
  const { name = 'optical' } = options;
  const sdim = data.spaceDim;

  return {
    name,
    signature: 'riemannian',
    timeIndex: null,
    dim: sdim,

    getDomainBounds(): ManifoldDomain {
      return data.spaceBounds();
    },

    computeMetric(x: number[]): Matrix {
      const N2 = data.lapseSq(x);
      const h = data.spatialMetric(x);
      return h.scale(1 / N2);
    },

    embed: options.embed
      ? (x: number[]) => options.embed!(x)
      : (x: number[]) => data.embedSpace(x),
  };
}
