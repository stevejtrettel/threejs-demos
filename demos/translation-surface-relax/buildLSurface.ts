/**
 * The L translation surface (H(2)) as a welded, closed genus-2 mesh.
 *
 * Three unit squares A=[0,1]², B=[1,2]×[0,1], C=[0,1]×[1,2], each subdivided
 * N×N, with the four translation gluings + the two interior seams welded by
 * union-find. All corners collapse into one valence-12 cone vertex; χ = −2.
 *
 * Returns both the WELDED topology (for relaxation) and an UNWELDED render
 * mesh (three square grids, duplicate seam vertices) carrying per-vertex flat
 * (u,v) coordinates for the shader. Each render vertex stores `weldOf`, the
 * welded vertex whose 3D position it copies — so the render mesh tracks the
 * relaxing embedding while still showing the flat translation structure.
 */

const A = 0, B = 1, C = 2;

export interface LSurface {
  N: number;
  weldedCount: number;
  faces: number[][];          // welded quad faces (compact indices)
  coneVertex: number;         // the welded valence-12 cone vertex
  render: {
    count: number;
    uv: Float32Array;         // 2 per render vertex, flat (u,v) in [0,2]
    weldOf: Int32Array;       // render vertex → welded index
    indices: number[];        // triangles into render vertices
    square: Uint8Array;       // 0=A,1=B,2=C per render vertex
  };
}

export function buildLSurface(N: number): LSurface {
  const M = (N + 1) * (N + 1);
  const total = 3 * M;
  const parent = new Int32Array(total);
  for (let i = 0; i < total; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const raw = (s: number, i: number, j: number): number => s * M + j * (N + 1) + i;

  for (let k = 0; k <= N; k++) {
    union(raw(A, N, k), raw(B, 0, k));   // interior A.right = B.left
    union(raw(A, k, N), raw(C, k, 0));   // interior A.top   = C.bottom
    union(raw(A, k, 0), raw(C, k, N));   // g1 A.bottom = C.top   (0,2)
    union(raw(B, k, 0), raw(B, k, N));   // g2 B.bottom = B.top   (0,1)
    union(raw(A, 0, k), raw(B, N, k));   // g3 A.left   = B.right (2,0)
    union(raw(C, 0, k), raw(C, N, k));   // g4 C.left   = C.right (1,0)
  }

  // Compact welded indices.
  const compact = new Map<number, number>();
  const weldId = new Int32Array(total);
  for (let r = 0; r < total; r++) {
    const f = find(r);
    let c = compact.get(f);
    if (c === undefined) { c = compact.size; compact.set(f, c); }
    weldId[r] = c;
  }
  const weldedCount = compact.size;

  // Welded faces (quads).
  const faces: number[][] = [];
  for (const s of [A, B, C])
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++)
      faces.push([
        weldId[raw(s, i, j)], weldId[raw(s, i + 1, j)],
        weldId[raw(s, i + 1, j + 1)], weldId[raw(s, i, j + 1)],
      ]);

  // Cone vertex = highest welded valence.
  const val = new Int32Array(weldedCount);
  const seen = new Set<number>();
  for (const f of faces) for (let k = 0; k < 4; k++) {
    const a = f[k], b = f[(k + 1) % 4];
    const key = a < b ? a * 1e6 + b : b * 1e6 + a;
    if (!seen.has(key)) { seen.add(key); val[a]++; val[b]++; }
  }
  let coneVertex = 0;
  for (let v = 1; v < weldedCount; v++) if (val[v] > val[coneVertex]) coneVertex = v;

  // Unwelded render mesh: each square its own grid, per-vertex flat (u,v).
  const squareUV = (s: number, i: number, j: number): [number, number] => {
    const fu = i / N, fv = j / N;
    if (s === A) return [fu, fv];
    if (s === B) return [1 + fu, fv];
    return [fu, 1 + fv];                       // C
  };
  const uv: number[] = [];
  const weldOf: number[] = [];
  const square: number[] = [];
  const indices: number[] = [];
  let base = 0;
  for (const s of [A, B, C]) {
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const [u, v] = squareUV(s, i, j);
      uv.push(u, v);
      weldOf.push(weldId[raw(s, i, j)]);
      square.push(s);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v0 = base + j * (N + 1) + i;
      const v1 = base + j * (N + 1) + i + 1;
      const v2 = base + (j + 1) * (N + 1) + i + 1;
      const v3 = base + (j + 1) * (N + 1) + i;
      indices.push(v0, v1, v2, v0, v2, v3);
    }
    base += (N + 1) * (N + 1);
  }

  return {
    N, weldedCount, faces, coneVertex,
    render: { count: weldOf.length, uv: new Float32Array(uv), weldOf: new Int32Array(weldOf), indices, square: new Uint8Array(square) },
  };
}
