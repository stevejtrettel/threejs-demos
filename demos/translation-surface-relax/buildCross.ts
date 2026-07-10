/**
 * The unfolding of the L-room billiard, as a planar cross/plus polyomino.
 *
 * Reflecting the L across its long bottom (y=0) and left (x=0) sides gives the
 * Klein-four unfolding: 4 copies tiling a plus shape (12 unit squares) — a
 * central 4×2 bar with a 2×1 arm up and down — whose outer boundary is glued by
 * translation. The 4 convex corners meet flatly (2π) at the centre; the 4 reflex
 * corners land on the boundary and weld into the single 6π cone point. χ = −2.
 *
 * Coordinates: the cross sits in [0,4]² (grid units ×N). Same `LSurface` shape
 * as buildLSurface, so the whole relax → refine → flow pipeline is reused.
 */

import type { LSurface } from './buildLSurface';

// The 12 unit squares (lower-left corner, in [0,4)² grid cells).
const SQUARES: [number, number][] = [];
for (let cx = 0; cx < 4; cx++) for (let cy = 1; cy <= 2; cy++) SQUARES.push([cx, cy]); // central bar
SQUARES.push([1, 3], [2, 3]);   // up arm
SQUARES.push([1, 0], [2, 0]);   // down arm

// 4-colour copy label by quadrant about the centre (2,2).
const copyOf = (cx: number, cy: number): number => (cx < 2 ? 0 : 1) + (cy < 2 ? 0 : 2);

export function buildCross(N: number): LSurface {
  const W = 4 * N + 1;
  const key = (gx: number, gy: number): number => gy * W + gx;

  // Register every grid vertex of every square by GLOBAL coord — squares that
  // share an edge in the polyomino automatically share vertices (interior
  // welds are free); only the outer boundary needs explicit gluing.
  const idOf = new Map<number, number>();
  const reg = (gx: number, gy: number): number => {
    const k = key(gx, gy);
    let v = idOf.get(k);
    if (v === undefined) { v = idOf.size; idOf.set(k, v); }
    return v;
  };
  for (const [cx, cy] of SQUARES) for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) reg(cx * N + a, cy * N + b);
  const V0 = idOf.size;
  const G = (gx: number, gy: number): number => idOf.get(key(gx, gy))!;

  const parent = new Int32Array(V0);
  for (let i = 0; i < V0; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const uni = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  // Boundary gluings (translations):
  for (let j = N; j <= 3 * N; j++) uni(G(4 * N, j), G(0, j));       // central bar  right ↔ left   (4,0)
  for (let j = 3 * N; j <= 4 * N; j++) uni(G(3 * N, j), G(N, j));   // up arm        right ↔ left   (2,0)
  for (let j = 0; j <= N; j++) uni(G(3 * N, j), G(N, j));           // down arm      right ↔ left   (2,0)
  for (let i = 0; i <= N; i++) uni(G(i, 3 * N), G(i, N));           // central top ↔ bottom (left)  (0,2)
  for (let i = 3 * N; i <= 4 * N; i++) uni(G(i, 3 * N), G(i, N));   // central top ↔ bottom (right) (0,2)
  for (let i = N; i <= 3 * N; i++) uni(G(i, 4 * N), G(i, 0));       // up-arm top ↔ down-arm bottom (0,4)

  // Compact welded indices.
  const compact = new Map<number, number>();
  const weldId = new Int32Array(V0);
  for (let r = 0; r < V0; r++) {
    const f = find(r);
    let c = compact.get(f);
    if (c === undefined) { c = compact.size; compact.set(f, c); }
    weldId[r] = c;
  }
  const weldedCount = compact.size;

  const faces: number[][] = [];
  for (const [cx, cy] of SQUARES) for (let b = 0; b < N; b++) for (let a = 0; a < N; a++)
    faces.push([
      weldId[G(cx * N + a, cy * N + b)], weldId[G(cx * N + a + 1, cy * N + b)],
      weldId[G(cx * N + a + 1, cy * N + b + 1)], weldId[G(cx * N + a, cy * N + b + 1)],
    ]);

  // Cone vertex = highest welded valence.
  const val = new Int32Array(weldedCount);
  const seen = new Set<number>();
  for (const f of faces) for (let k = 0; k < 4; k++) {
    const a = f[k], b = f[(k + 1) % 4];
    const kk = a < b ? a * 1e7 + b : b * 1e7 + a;
    if (!seen.has(kk)) { seen.add(kk); val[a]++; val[b]++; }
  }
  let coneVertex = 0;
  for (let v = 1; v < weldedCount; v++) if (val[v] > val[coneVertex]) coneVertex = v;

  // Render mesh: per-square grids (duplicate boundary verts), global (u,v).
  const uv: number[] = [];
  const weldOf: number[] = [];
  const square: number[] = [];
  const indices: number[] = [];
  let base = 0;
  for (const [cx, cy] of SQUARES) {
    const cp = copyOf(cx, cy);
    for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
      uv.push(cx + a / N, cy + b / N);
      weldOf.push(weldId[G(cx * N + a, cy * N + b)]);
      square.push(cp);
    }
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      const v0 = base + b * (N + 1) + a;
      const v1 = base + b * (N + 1) + a + 1;
      const v2 = base + (b + 1) * (N + 1) + a + 1;
      const v3 = base + (b + 1) * (N + 1) + a;
      indices.push(v0, v1, v2, v0, v2, v3);
    }
    base += (N + 1) * (N + 1);
  }

  return {
    N, weldedCount, faces, coneVertex,
    render: { count: weldOf.length, uv: new Float32Array(uv), weldOf: new Int32Array(weldOf), indices, square: new Uint8Array(square) },
  };
}
