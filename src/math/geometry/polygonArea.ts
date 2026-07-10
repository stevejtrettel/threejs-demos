import type { Vec2 } from './types';

/**
 * Area of a simple polygon given by its vertices in order (the shoelace
 * formula). Sign-agnostic: the magnitude is returned, so the winding
 * direction doesn't matter. A polygon with fewer than three vertices has
 * zero area.
 *
 * @example
 *   polygonArea([[0, 0], [2, 0], [2, 3], [0, 3]]);  // → 6
 */
export function polygonArea(polygon: readonly Vec2[]): number {
  if (polygon.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i]!;
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
