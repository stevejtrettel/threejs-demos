// The area-contraction ratio q on the Farey tree of the stable-norm ball.
//
// Refining the inscribed hull inserts, at each Farey mediant m (between Farey
// neighbours L, R), one triangle of area t(m) = area(P_L, P_m, P_R), where
// P = (p,q)/ℓ. Its two children are mL = L+m and mR = m+R, and
//
//     q(m) = ( t(mL) + t(mR) ) / t(m).
//
// If sup q < 1 over the fundamental domain, the bulge tail V − V_R is a
// convergent geometric series (subtree area ≤ t(m)/(1−q)), which is exactly the
// estimate the rigorous-numerics proof rests on. This module measures it.

import { traceToLength, type TraceTriple } from '../_shared/markoff';
import type { Vec2 } from '@/math/geometry';

const pointOf = (p: number, q: number, t: number): Vec2 => {
  const l = traceToLength(t);
  return [p / l, q / l];
};
const triArea = (A: Vec2, B: Vec2, C: Vec2): number =>
  0.5 * Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]));

interface Node { p: number; q: number; t: number; P: Vec2; }

/** One Farey triangle for drawing: vertices a–b–c (b is the mediant) and its q. */
export interface FareyTri { a: Vec2; b: Vec2; c: Vec2; q: number; depth: number; }

function valid(t: number): boolean {
  return Math.abs(t) >= 2 && Number.isFinite(t) && Math.abs(t) < 1e13;
}

// Walk one Farey sector, recording triangles (if `out`) and the running sup of q.
// Branches are pruned once a triangle's area drops below `floor` (it and its
// descendants then contribute negligibly to the bulge).
function walk(
  L: Node, R: Node, oppT: number, depth: number, maxDepth: number,
  floor: number, out: FareyTri[] | null, stat: { max: number }, perDepth: number[] | null,
): void {
  if (depth > maxDepth) return;
  const mp = L.p + R.p, mq = L.q + R.q, mt = L.t * R.t - oppT;
  if (!valid(mt)) return;
  const mP = pointOf(mp, mq, mt);
  const tSelf = triArea(L.P, mP, R.P);
  if (tSelf < floor) return; // negligible area — prune

  const lcT = L.t * mt - R.t, rcT = mt * R.t - L.t;
  let q = NaN;
  if (valid(lcT) && valid(rcT)) {
    const lcP = pointOf(L.p + mp, L.q + mq, lcT);
    const rcP = pointOf(mp + R.p, mq + R.q, rcT);
    q = (triArea(L.P, lcP, mP) + triArea(mP, rcP, R.P)) / tSelf;
    if (q > stat.max) stat.max = q;
    if (perDepth && q > perDepth[depth]) perDepth[depth] = q;
  }
  if (out) out.push({ a: L.P, b: mP, c: R.P, q, depth });

  const M: Node = { p: mp, q: mq, t: mt, P: mP };
  walk(L, M, R.t, depth + 1, maxDepth, floor, out, stat, perDepth);
  walk(M, R, L.t, depth + 1, maxDepth, floor, out, stat, perDepth);
}

// The two Farey sectors covering θ ∈ [0, π); central symmetry covers the rest.
function sectors(triple: TraceTriple): Array<[Node, Node, number]> {
  const { x, y, z } = triple;
  const a: Node = { p: 1, q: 0, t: x, P: pointOf(1, 0, x) };
  const b: Node = { p: 0, q: 1, t: y, P: pointOf(0, 1, y) };
  const aInv: Node = { p: -1, q: 0, t: x, P: pointOf(-1, 0, x) };
  return [
    [a, b, x * y - z], // opposite vertex (−1,1), trace xy − z
    [b, aInv, z],      // opposite vertex (1,1), trace z
  ];
}

function rootFloor(L: Node, R: Node, oppT: number): number {
  const mt = L.t * R.t - oppT;
  if (!valid(mt)) return 1e-12;
  return 1e-6 * triArea(L.P, pointOf(L.p + R.p, L.q + R.q, mt), R.P);
}

/** sup of q over the Farey tree of the ball (the contraction ratio). */
export function supQ(triple: TraceTriple, maxDepth = 16): number {
  const stat = { max: 0 };
  for (const [L, R, o] of sectors(triple)) walk(L, R, o, 0, maxDepth, rootFloor(L, R, o), null, stat, null);
  return stat.max;
}

/** The Farey triangles (for drawing) plus the sup of q over them. */
export function collectTriangles(triple: TraceTriple, maxDepth = 8): { tris: FareyTri[]; maxQ: number } {
  const tris: FareyTri[] = [];
  const stat = { max: 0 };
  for (const [L, R, o] of sectors(triple)) walk(L, R, o, 0, maxDepth, rootFloor(L, R, o), tris, stat, null);
  return { tris, maxQ: stat.max };
}

/** Max q at each Farey depth — to eyeball the asymptotic (renormalization) rate. */
export function qByDepth(triple: TraceTriple, maxDepth = 16): number[] {
  const per = new Array(maxDepth + 1).fill(0);
  const stat = { max: 0 };
  for (const [L, R, o] of sectors(triple)) walk(L, R, o, 0, maxDepth, rootFloor(L, R, o), null, stat, per);
  return per;
}
