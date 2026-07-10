import type { Vec2 } from './types';

/**
 * Convex hull of a set of planar points (Andrew's monotone chain).
 *
 * Returns the hull vertices in counter-clockwise order, with collinear
 * points dropped. `O(n log n)`: one sort plus a linear sweep. Degenerate
 * inputs (fewer than three distinct extreme points) are returned as-is,
 * sorted.
 *
 * The input is treated as read-only; a sorted copy is made internally.
 *
 * @example
 *   convexHull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
 *   // → [[0, 0], [1, 0], [1, 1], [0, 1]]  (interior point dropped)
 */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  // > 0 ⇒ counter-clockwise turn at the middle vertex.
  const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Drop each chain's last point — it's the first point of the other chain.
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
