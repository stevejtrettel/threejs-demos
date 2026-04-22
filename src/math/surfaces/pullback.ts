import type { Surface, SurfaceDomain, FirstFundamentalForm } from './types';
import { MetricSurface } from './MetricSurface';

/**
 * Options for `pullbackMetric`
 */
export interface PullbackMetricOptions {
  /**
   * Analytic Jacobian [∂f/∂u, ∂f/∂v] at (u, v), each returned as an n-vector.
   * If omitted, partials are computed by central finite differences on `f`.
   */
  jacobian?: (u: number, v: number) => [number[], number[]];
  /** Finite-difference step for the numerical Jacobian. Default 1e-4. */
  h?: number;
  /** Optional visualization-only embedding; forwarded to the resulting `MetricSurface`. */
  display?: Surface;
}

/**
 * Build a `MetricSurface` whose metric is the Euclidean pullback of an
 * embedding `f: R² → R^n` (any n ≥ 2):
 *
 *     g_ij(u, v) = ∂f/∂x^i · ∂f/∂x^j    (Euclidean dot product in R^n)
 *
 * Works for surfaces naturally living in R³, R⁴, or R^n generally, as long
 * as the ambient metric is flat Euclidean.
 *
 * **Not** for non-Euclidean ambients (hyperbolic, spherical, Minkowski, etc.).
 * For those, compute the metric by hand and pass it directly to `MetricSurface`.
 */
export function pullbackMetric(
  f: (u: number, v: number) => number[],
  domain: SurfaceDomain,
  opts: PullbackMetricOptions = {},
): MetricSurface {
  const h = opts.h ?? 1e-4;

  const jacobian = opts.jacobian ?? ((u: number, v: number): [number[], number[]] => {
    const fpu = f(u + h, v);
    const fmu = f(u - h, v);
    const fpv = f(u, v + h);
    const fmv = f(u, v - h);
    const n = fpu.length;
    const du = new Array<number>(n);
    const dv = new Array<number>(n);
    const inv2h = 1 / (2 * h);
    for (let i = 0; i < n; i++) {
      du[i] = (fpu[i] - fmu[i]) * inv2h;
      dv[i] = (fpv[i] - fmv[i]) * inv2h;
    }
    return [du, dv];
  });

  const metric = (u: number, v: number): FirstFundamentalForm => {
    const [du, dv] = jacobian(u, v);
    let E = 0, F = 0, G = 0;
    const n = du.length;
    for (let i = 0; i < n; i++) {
      E += du[i] * du[i];
      F += du[i] * dv[i];
      G += dv[i] * dv[i];
    }
    return { E, F, G };
  };

  return new MetricSurface({ domain, metric, display: opts.display });
}
