import type { Vec2 } from './types';

/**
 * A scalar field sampled on a regular grid, row-major: the value at column `i`,
 * row `j` is `values[j * nx + i]`, sitting at world point
 * `(xMin + i·dx, yMin + j·dy)`. A `null` (or `NaN`) entry marks a missing
 * sample; any cell touching one is skipped, so contours respect holes.
 */
export interface ScalarGrid {
  nx: number;
  ny: number;
  values: ReadonlyArray<number | null>;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** A contour line piece, `[start, end]`. */
export type Segment = [Vec2, Vec2];

/**
 * Iso-contour of a scalar grid at `level`, as a set of line segments
 * (marching squares with linear edge interpolation). Returns the unordered
 * segments where the field crosses `level`; saddle cells emit two segments.
 *
 * Pass a single level; call once per level for a contour plot.
 *
 * @example
 *   const segs = marchingSquares(grid, 0.95);
 *   for (const [[x0, y0], [x1, y1]] of segs) drawLine(x0, y0, x1, y1);
 */
export function marchingSquares(grid: ScalarGrid, level: number): Segment[] {
  const { nx, ny, values, xMin, xMax, yMin, yMax } = grid;
  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);
  const val = (i: number, j: number): number => {
    const v = values[j * nx + i];
    return v == null ? NaN : v;
  };

  const segs: Segment[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = val(i, j), v10 = val(i + 1, j), v11 = val(i + 1, j + 1), v01 = val(i, j + 1);
      if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v11) && Number.isFinite(v01))) {
        continue;
      }

      let mask = 0;
      if (v00 >= level) mask |= 1; // bottom-left
      if (v10 >= level) mask |= 2; // bottom-right
      if (v11 >= level) mask |= 4; // top-right
      if (v01 >= level) mask |= 8; // top-left
      if (mask === 0 || mask === 15) continue;

      const x0 = xMin + i * dx, x1 = x0 + dx, y0 = yMin + j * dy, y1 = y0 + dy;
      const t = (a: number, b: number) => (level - a) / (b - a);
      const eBottom = (): Vec2 => [x0 + dx * t(v00, v10), y0]; // bl–br
      const eRight = (): Vec2 => [x1, y0 + dy * t(v10, v11)];  // br–tr
      const eTop = (): Vec2 => [x0 + dx * t(v01, v11), y1];    // tl–tr
      const eLeft = (): Vec2 => [x0, y0 + dy * t(v00, v01)];   // bl–tl
      const push = (a: Vec2, b: Vec2) => segs.push([a, b]);

      switch (mask) {
        case 1: case 14: push(eLeft(), eBottom()); break;
        case 2: case 13: push(eBottom(), eRight()); break;
        case 3: case 12: push(eLeft(), eRight()); break;
        case 4: case 11: push(eRight(), eTop()); break;
        case 6: case 9: push(eBottom(), eTop()); break;
        case 7: case 8: push(eLeft(), eTop()); break;
        case 5: push(eLeft(), eTop()); push(eBottom(), eRight()); break;  // saddle
        case 10: push(eLeft(), eBottom()); push(eTop(), eRight()); break; // saddle
      }
    }
  }
  return segs;
}
