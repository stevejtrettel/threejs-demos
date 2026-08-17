/**
 * Chain unordered line segments into polylines.
 *
 * `marchingSquares` returns its contour as a bag of segments in no particular
 * order, because it visits cells in scan order and each cell knows nothing
 * about its neighbours. That is fine for drawing individual line pieces, but
 * anything that wants a *curve* — a tube, an arclength parameterization, a
 * smoothing pass — needs the pieces threaded together first. This is that pass.
 *
 * Endpoints are matched by snapping to a tolerance grid, checking the
 * neighbouring buckets too so a pair straddling a bucket boundary still meets.
 * Adjacent marching-squares cells compute their shared crossing from the same
 * two grid values by the same expression, so in practice the endpoints agree
 * bit for bit and the tolerance is only insurance.
 *
 * Open chains are emitted first (walked from their loose ends, so each comes
 * out in one piece rather than two), then closed loops from whatever edges
 * remain. A closed loop repeats its first point at the end.
 */

import type { Vec2 } from './types';
import type { Segment } from './marchingSquares';

export interface ChainSegmentsOptions {
  /**
   * Distance below which two endpoints count as the same point
   * (default: 1e-9).
   */
  tolerance?: number;
}

/**
 * Thread segments into polylines.
 *
 * @example
 *   const segments = marchingSquares(grid, 0);
 *   for (const polyline of chainSegments(segments)) drawTube(polyline);
 */
export function chainSegments(
  segments: readonly Segment[],
  options: ChainSegmentsOptions = {},
): Vec2[][] {
  const { tolerance = 1e-9 } = options;

  const coords: Vec2[] = [];
  const lookup = new Map<string, number>();

  /** Node id for a point, matching any existing node within `tolerance`. */
  const nodeAt = (p: Vec2): number => {
    const gx = Math.round(p[0] / tolerance);
    const gy = Math.round(p[1] / tolerance);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const hit = lookup.get(`${gx + dx},${gy + dy}`);
        if (hit !== undefined) return hit;
      }
    }
    const id = coords.length;
    coords.push(p);
    lookup.set(`${gx},${gy}`, id);
    return id;
  };

  const edges: [number, number][] = [];
  const incident: number[][] = [];

  for (const [a, b] of segments) {
    const ia = nodeAt(a);
    const ib = nodeAt(b);
    if (ia === ib) continue; // degenerate segment

    const edge = edges.length;
    edges.push([ia, ib]);
    (incident[ia] ??= []).push(edge);
    (incident[ib] ??= []).push(edge);
  }

  const used = new Array<boolean>(edges.length).fill(false);

  /** Walk as far as unused edges allow, returning the node ids visited. */
  const walk = (start: number): number[] => {
    const chain = [start];
    let current = start;

    for (;;) {
      const next = (incident[current] ?? []).find((e) => !used[e]);
      if (next === undefined) break;
      used[next] = true;
      const [a, b] = edges[next];
      current = a === current ? b : a;
      chain.push(current);
    }

    return chain;
  };

  const polylines: Vec2[][] = [];
  const emit = (chain: number[]): void => {
    if (chain.length >= 2) polylines.push(chain.map((id) => coords[id]));
  };

  // Loose ends first, so an open contour is emitted as one polyline rather
  // than as two halves meeting at whichever interior node we happened to start
  // from.
  for (let node = 0; node < coords.length; node++) {
    if ((incident[node] ?? []).length !== 1) continue;
    if (used[incident[node][0]]) continue;
    emit(walk(node));
  }

  // Whatever is left is closed loops (or the interiors of contours that met
  // themselves), each walked from an arbitrary node on it.
  for (let edge = 0; edge < edges.length; edge++) {
    if (used[edge]) continue;
    emit(walk(edges[edge][0]));
  }

  return polylines;
}
