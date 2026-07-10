import { generateCurves, type TraceTriple } from "./curves.ts";
import { tripleFromTraces } from "./chart.ts";

export type Vec2 = readonly [number, number];

// The boundary samples of the stable-norm sphere: for each simple curve of
// slope (p, q) and length ℓ, the point (p, q)/ℓ on the unit sphere in its
// direction, plus its antipode (central symmetry). Curves whose length is not
// a finite positive number — degenerate structures near the boundary of
// Teichmüller space — are dropped.
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

// Andrew's monotone-chain convex hull, counter-clockwise, collinear points
// dropped. O(n log n).
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Signed-area (shoelace) magnitude of a simple polygon given in order.
export function polygonArea(polygon: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i]!;
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// The inner-approximation polygon to the stable-norm unit ball.
export function normBallHull(triple: TraceTriple, radius: number): Vec2[] {
  return convexHull(normBallSamples(triple, radius));
}

// The functional we want to graph: the area ("volume") of the inner estimate of
// the stable-norm unit ball for the structure `triple`, sampled out to `radius`.
// The estimate increases monotonically toward the true volume as radius grows.
export function normBallArea(triple: TraceTriple, radius: number): number {
  const hull = normBallHull(triple, radius);
  return hull.length < 3 ? 0 : polygonArea(hull);
}

// Convenience for sweeping a grid over the (x, y) chart of Teichmüller space:
// returns the volume at the structure with traces (x, y, z(x,y)), or null when
// (x, y) is outside Teichmüller space.
export function normBallAreaAt(x: number, y: number, radius: number): number | null {
  const triple = tripleFromTraces(x, y);
  return triple ? normBallArea(triple, radius) : null;
}
