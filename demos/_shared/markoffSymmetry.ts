// Symmetry of the Markoff chart: copies of the special tori, and a fundamental
// domain for the SL(2,ℤ) (mapping-class-group) action — shared by the demos.

import type { Vec2 } from '@/math/geometry';
import type { TraceTriple } from './markoff';
import { project, liftToTriple } from './markoffChart';

export const HEX_SEED: TraceTriple = { x: 3, y: 3, z: 3 };
export const SQUARE_SEED: TraceTriple = { x: 2 * Math.SQRT2, y: 2 * Math.SQRT2, z: 4 };

/**
 * A structure is "Markoff-reduced" when no Vieta move shortens a generator,
 * i.e. each trace is at most half the product of the other two. The reduced
 * region is six mirror-copies of one fundamental domain.
 */
export function isReduced(t: TraceTriple): boolean {
  const e = 1e-9;
  return 2 * t.x <= t.y * t.z + e && 2 * t.y <= t.x * t.z + e && 2 * t.z <= t.x * t.y + e;
}

/**
 * One SL(2,ℤ) fundamental domain in the (a, b) chart: a single 60° mirror-sector
 * of the reduced region. This is the modular triangle drawn in this chart —
 * hexagonal point (order 3) at the origin corner, square torus (order 2) on an
 * edge, cusp (trace → 2) running to infinity along the 90° ray.
 */
export function inFundamentalDomain(a: number, b: number, rWin: number): boolean {
  if (a * a + b * b > rWin * rWin) return false;
  const ang = Math.atan2(b, a);
  if (ang < Math.PI / 6 - 1e-9 || ang > Math.PI / 2 + 1e-9) return false; // sector [30°, 90°]
  const t = liftToTriple(a, b);
  return t ? isReduced(t) : false;
}

/**
 * Distinct projected points of the orbit of `seed` under the three Vieta
 * involutions composed with coordinate permutations, kept inside the window.
 * With `HEX_SEED`/`SQUARE_SEED` this yields the hexagonal / square torus copies.
 */
export function markoffOrbit(seed: TraceTriple, rWin: number): Vec2[] {
  const perms = (t: TraceTriple): TraceTriple[] => [
    { x: t.x, y: t.y, z: t.z }, { x: t.x, y: t.z, z: t.y }, { x: t.y, y: t.x, z: t.z },
    { x: t.y, y: t.z, z: t.x }, { x: t.z, y: t.x, z: t.y }, { x: t.z, y: t.y, z: t.x },
  ];
  const key = (t: TraceTriple) => [t.x, t.y, t.z].map((v) => v.toFixed(3)).join(',');
  const seen = new Set<string>();
  const ptSeen = new Set<string>();
  const out: Vec2[] = [];
  const queue: TraceTriple[] = [seed];
  while (queue.length) {
    const t = queue.shift()!;
    if (seen.has(key(t))) continue;
    seen.add(key(t));
    if (Math.max(t.x, t.y, t.z) > 30) continue; // bound the search
    const [a, b] = project(t);
    if (a * a + b * b <= rWin * rWin + 1e-9) {
      const pk = a.toFixed(2) + ',' + b.toFixed(2);
      if (!ptSeen.has(pk)) { ptSeen.add(pk); out.push([a, b]); }
    }
    for (const m of [
      { x: t.y * t.z - t.x, y: t.y, z: t.z },
      { x: t.x, y: t.x * t.z - t.y, z: t.z },
      { x: t.x, y: t.y, z: t.x * t.y - t.z },
    ]) {
      for (const p of perms(m)) queue.push(p);
    }
  }
  return out;
}
