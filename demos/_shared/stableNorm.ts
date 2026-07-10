// The stable-norm unit ball of a once-punctured-torus structure, and its area.
//
// For each simple curve of slope (p, q) and hyperbolic length ℓ, the point
// ±(p, q)/ℓ lies on the boundary of the stable-norm unit ball (the longer the
// curve, the closer its direction sits to the origin). The convex hull of these
// samples is an inner-approximating polygon; its area is the functional
//
//     V(structure) = area of conv{ ±(p, q)/ℓ : simple curves out to radius R }.
//
// V increases monotonically toward the true ball volume as R → ∞. Uses the
// general planar-geometry tools from src/math/geometry.

import { convexHull, polygonArea, type Vec2 } from '@/math/geometry';
import { generateCurves, tripleFromTraces, type TraceTriple } from './markoff';

/**
 * Boundary samples ±(p, q)/ℓ of the stable-norm sphere, out to slope radius R.
 * Curves whose length is not finite and positive — degenerate structures near
 * the boundary of Teichmüller space — are dropped.
 */
export function normBallSamples(triple: TraceTriple, radius: number): Vec2[] {
  const out: Vec2[] = [];
  for (const c of generateCurves(triple, radius)) {
    if (!Number.isFinite(c.length) || c.length <= 0) continue;
    const px = c.slope.p / c.length;
    const py = c.slope.q / c.length;
    out.push([px, py], [-px, -py]);
  }
  return out;
}

/** The inner-approximation polygon to the stable-norm unit ball. */
export function normBallHull(triple: TraceTriple, radius: number): Vec2[] {
  return convexHull(normBallSamples(triple, radius));
}

/** The volume functional: area of the inner-estimate ball for `triple`. */
export function normBallArea(triple: TraceTriple, radius: number): number {
  return polygonArea(normBallHull(triple, radius));
}

/**
 * Volume at the structure with traces (x, y, z(x, y)) on the Markoff cubic, or
 * null when (x, y) is outside Teichmüller space. Convenient for sweeping the
 * (x, y) chart.
 */
export function normBallAreaAt(x: number, y: number, radius: number): number | null {
  const triple = tripleFromTraces(x, y);
  return triple ? normBallArea(triple, radius) : null;
}
