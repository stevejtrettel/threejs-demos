/**
 * Torus descriptor + `defineTorus` builder.
 *
 * A `Torus` bundles one 8-vertex triangulation with everything derivable from
 * it (edges, oriented vertex links, dual adjacency, degree sequence, the
 * unfolding attachment tree) plus the small amount of hand-authored data that
 * is genuinely a choice (the developing order and the two homology generators).
 *
 * This replaces the old global singleton in `topology.ts`: instead of one
 * module-level `TRIANGLES`, every torus is a value you pass around. The seven
 * combinatorial types live in `tori.ts` (`TORUS_8V`); each `src/tori/torusN.ts`
 * pairs one of them with its authored develop order + generators.
 *
 * Pure data/combinatorics — no three.js, no DOM, no metric (3D coords).
 *
 * NB: only Rich's torus (#7) is degree-6-regular; the other six have degree
 * 5/7 vertices, so NOTHING here may assume degree 6.
 */

export type Tri = readonly [number, number, number];
export type Edge = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const VERTEX_COUNT = 8;
const F = 16; // faces
const E = 24; // edges

/** Triangle `t` is glued onto `parent` across global edge (u, v). */
export type Attach = {
  readonly parent: number; // -1 for the root
  readonly u: number;
  readonly v: number;
};

/** A pair of triangles sharing exactly one vertex (for the embedding check). */
export type SharedVertexPair = {
  readonly a: number;                        // triangle index
  readonly b: number;                        // triangle index
  readonly shared: number;                   // the shared vertex
  readonly aOpp: readonly [number, number];  // a's two other vertices
  readonly bOpp: readonly [number, number];  // b's two other vertices
};

/** Cell-pair tables for the repulsion/barrier energies (non-adjacent pairs). */
export type CellPairs = {
  readonly vertexVertex: readonly [number, number][]; // two vertex indices
  readonly vertexEdge: readonly [number, number][];   // [vertex, edge index]
  readonly vertexFace: readonly [number, number][];   // [vertex, face index]
  readonly edgeEdge: readonly [number, number][];     // two edge indices
  readonly edgeFace: readonly [number, number][];     // [edge index, face index]
  readonly faceFace: readonly [number, number][];     // = disjointTrianglePairs
};

/** Hand-authored part of a torus — the genuine choices. */
export type TorusSpec = {
  readonly id: number;
  readonly name: string;
  readonly triangles: readonly Tri[];
  /** Unfolding order: a permutation of 0..15, root first. Must be a valid dual
   *  spanning tree (each non-root triangle edge-adjacent to an earlier one). */
  readonly developOrder: readonly number[];
  /** Two oriented vertex edge-loops generating H₁(T²); e.g. [[0,3,6,0],[0,2,1,0]]. */
  readonly generatorLoops: readonly (readonly number[])[];
  /** A reference 3D embedding, if one exists (only #7 today). */
  readonly referenceCoords?: readonly Vec3[];
  /** Symmetry vertex pairing of the reference embedding (#7 Z/2). */
  readonly symmetryPairing?: readonly Edge[];
  /** Period basis of the regular triangular-lattice layout — only valid for the
   *  degree-6-regular torus (#7); enables the equilateral pretty-renderer. */
  readonly lattice?: { readonly periodBasis: readonly [number, number][] };
};

/** Fully derived torus: the spec plus every combinatorial table. */
export type Torus = {
  readonly id: number;
  readonly name: string;
  readonly vertexCount: number;
  readonly triangles: readonly Tri[];
  readonly edges: readonly Edge[];
  /** vertexLinks[i]: neighbors of i in CCW cyclic order (length = degree(i)). */
  readonly vertexLinks: readonly (readonly number[])[];
  /** Sorted ascending — a cheap combinatorial fingerprint. */
  readonly degreeSequence: readonly number[];
  /** edgeKey(u,v) → the two triangles sharing that edge, ascending. */
  readonly edgeToTris: ReadonlyMap<number, readonly [number, number]>;
  readonly developOrder: readonly number[];
  readonly attach: readonly Attach[];
  readonly generatorLoops: readonly (readonly number[])[];
  /** The C(16,2) triangle pairs sharing 0 vertices (full tri–tri embedding test). */
  readonly disjointTrianglePairs: readonly [number, number][];
  /** Triangle pairs sharing exactly 1 vertex (reduce to 2 segment–tri tests). */
  readonly sharedVertexTrianglePairs: readonly SharedVertexPair[];
  /** Non-adjacent cell pairs of all six type combinations (repulsion energies). */
  readonly cellPairs: CellPairs;
  readonly referenceCoords?: readonly Vec3[];
  readonly symmetryPairing?: readonly Edge[];
  readonly lattice?: { readonly periodBasis: readonly [number, number][] };
};

/** Symmetric key for an undirected edge {u,v}. */
export function edgeKey(u: number, v: number): number {
  return u < v ? u * VERTEX_COUNT + v : v * VERTEX_COUNT + u;
}

// ---------------------------------------------------------------------------
// Derivations (lifted from topology.ts / develop.ts, made degree-generic)
// ---------------------------------------------------------------------------

function deriveEdges(triangles: readonly Tri[]): Edge[] {
  const seen = new Set<number>();
  const out: Edge[] = [];
  for (const [a, b, c] of triangles) {
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      const k = edgeKey(p, q);
      if (!seen.has(k)) {
        seen.add(k);
        out.push([Math.min(p, q), Math.max(p, q)]);
      }
    }
  }
  if (out.length !== E) throw new Error(`expected ${E} edges, got ${out.length}`);
  return out;
}

/**
 * Oriented cyclic vertex links. Triangle (a,b,c) contributes the directed link
 * edges b→c at a, c→a at b, a→b at c; walking those closes each 1-ring into a
 * single cycle of length = degree(i). Works for any degree (NO degree-6
 * assumption).
 */
function deriveVertexLinks(triangles: readonly Tri[]): number[][] {
  const next: Map<number, number>[] = Array.from(
    { length: VERTEX_COUNT },
    () => new Map<number, number>(),
  );
  for (const [a, b, c] of triangles) {
    next[a].set(b, c);
    next[b].set(c, a);
    next[c].set(a, b);
  }
  const links: number[][] = [];
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const m = next[i];
    const deg = m.size;
    if (deg < 3) throw new Error(`vertex ${i} has degree ${deg}, expected ≥3`);
    const start = m.keys().next().value as number;
    const cycle: number[] = [start];
    let cur = start;
    for (let step = 0; step < deg - 1; step++) {
      const nxt = m.get(cur);
      if (nxt === undefined) throw new Error(`broken link at vertex ${i}`);
      cycle.push(nxt);
      cur = nxt;
    }
    if (m.get(cur) !== start) throw new Error(`link at vertex ${i} does not close into a single cycle`);
    links.push(cycle);
  }
  return links;
}

function deriveEdgeToTris(triangles: readonly Tri[]): Map<number, readonly [number, number]> {
  const m = new Map<number, number[]>();
  for (let t = 0; t < triangles.length; t++) {
    const tri = triangles[t];
    for (let s = 0; s < 3; s++) {
      const k = edgeKey(tri[s], tri[(s + 1) % 3]);
      const arr = m.get(k);
      if (arr) arr.push(t);
      else m.set(k, [t]);
    }
  }
  const out = new Map<number, readonly [number, number]>();
  for (const [k, arr] of m) {
    if (arr.length !== 2) throw new Error(`edge ${k} shared by ${arr.length} triangles, expected 2`);
    out.set(k, arr[0] < arr[1] ? [arr[0], arr[1]] : [arr[1], arr[0]]);
  }
  return out;
}

/**
 * Attachment tree from the develop order alone: each non-root triangle glues
 * onto its EARLIEST-already-placed edge-adjacent neighbor. (The old code used
 * the abstract hexagonal domain to disambiguate; that only exists for the
 * degree-6 torus, so we drop it. Any valid spanning tree yields the same cut
 * edges / holonomy / τ — only the picture's exact shape changes.)
 */
function deriveAttach(
  triangles: readonly Tri[],
  developOrder: readonly number[],
  edgeToTris: Map<number, readonly [number, number]>,
): Attach[] {
  const placedAt = new Array<number>(triangles.length).fill(-1);
  const out = new Array<Attach>(triangles.length);
  const root = developOrder[0];
  out[root] = { parent: -1, u: -1, v: -1 };
  placedAt[root] = 0;
  for (let i = 1; i < developOrder.length; i++) {
    const t = developOrder[i];
    const tri = triangles[t];
    let parent = -1, best = Infinity, su = -1, sv = -1;
    for (let s = 0; s < 3; s++) {
      const u = tri[s], v = tri[(s + 1) % 3];
      const [tA, tB] = edgeToTris.get(edgeKey(u, v))!;
      const nbr = tA === t ? tB : tA;
      if (placedAt[nbr] >= 0 && placedAt[nbr] < best) {
        best = placedAt[nbr];
        parent = nbr;
        su = u;
        sv = v;
      }
    }
    if (parent < 0) throw new Error(`developOrder: triangle ${t} has no already-placed edge-neighbor (not a spanning tree)`);
    out[t] = { parent, u: su, v: sv };
    placedAt[t] = i;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Triangle-pair classification (for the embedding check) and cell-pair tables
// (for the repulsion/barrier energies). Counts vary across the 7 tori — only
// vertex-vertex / vertex-edge / vertex-face / edge-face / edgeShared are
// topology-invariant — so we compute, never assert magic numbers.
// ---------------------------------------------------------------------------

function classifyTrianglePairs(triangles: readonly Tri[]): {
  disjoint: [number, number][];
  sharedVertex: SharedVertexPair[];
} {
  const disjoint: [number, number][] = [];
  const sharedVertex: SharedVertexPair[] = [];
  const n = triangles.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const t1 = triangles[i], t2 = triangles[j];
      const shared: number[] = [];
      for (const v of t1) if (v === t2[0] || v === t2[1] || v === t2[2]) shared.push(v);
      if (shared.length === 0) {
        disjoint.push([i, j]);
      } else if (shared.length === 1) {
        const sv = shared[0];
        const aOpp = t1.filter((v) => v !== sv);
        const bOpp = t2.filter((v) => v !== sv);
        sharedVertex.push({ a: i, b: j, shared: sv, aOpp: [aOpp[0], aOpp[1]], bOpp: [bOpp[0], bOpp[1]] });
      }
      // shared.length === 2 (edge-shared): generically no interior intersection — skipped.
    }
  }
  return { disjoint, sharedVertex };
}

function deriveCellPairs(
  triangles: readonly Tri[],
  edges: readonly Edge[],
  disjointTrianglePairs: readonly [number, number][],
): CellPairs {
  const vertexVertex: [number, number][] = [];
  for (let i = 0; i < VERTEX_COUNT; i++) for (let j = i + 1; j < VERTEX_COUNT; j++) vertexVertex.push([i, j]);

  const vertexEdge: [number, number][] = [];
  for (let v = 0; v < VERTEX_COUNT; v++) for (let e = 0; e < edges.length; e++) {
    const [a, b] = edges[e];
    if (v !== a && v !== b) vertexEdge.push([v, e]);
  }

  const vertexFace: [number, number][] = [];
  for (let v = 0; v < VERTEX_COUNT; v++) for (let f = 0; f < triangles.length; f++) {
    const [a, b, c] = triangles[f];
    if (v !== a && v !== b && v !== c) vertexFace.push([v, f]);
  }

  const edgeEdge: [number, number][] = [];
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const [u1, v1] = edges[i], [u2, v2] = edges[j];
    if (u1 !== u2 && u1 !== v2 && v1 !== u2 && v1 !== v2) edgeEdge.push([i, j]);
  }

  const faceEdgeKeys = triangles.map(([a, b, c]) => new Set([edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]));
  const edgeFace: [number, number][] = [];
  for (let e = 0; e < edges.length; e++) {
    const k = edgeKey(edges[e][0], edges[e][1]);
    for (let f = 0; f < triangles.length; f++) if (!faceEdgeKeys[f].has(k)) edgeFace.push([e, f]);
  }

  return { vertexVertex, vertexEdge, vertexFace, edgeEdge, edgeFace, faceFace: disjointTrianglePairs.map((p) => p) };
}

// ---------------------------------------------------------------------------
// Auto-derivation helpers (valid defaults to hand-override per torus)
// ---------------------------------------------------------------------------

/**
 * A valid develop order: BFS spanning tree of the dual graph rooted at triangle
 * `root`. Every non-root triangle appears after an edge-adjacent neighbor, so
 * `deriveAttach` always resolves. Hand-authored orders give nicer nets; this is
 * the fallback / starting point.
 */
export function autoDevelopOrder(triangles: readonly Tri[], root = 0): number[] {
  const edgeToTris = deriveEdgeToTris(triangles);
  const order: number[] = [root];
  const seen = new Set<number>([root]);
  for (let head = 0; head < order.length; head++) {
    const t = order[head];
    const tri = triangles[t];
    for (let s = 0; s < 3; s++) {
      const [a, b] = [tri[s], tri[(s + 1) % 3]];
      const [tA, tB] = edgeToTris.get(edgeKey(a, b))!;
      const nbr = tA === t ? tB : tA;
      if (!seen.has(nbr)) { seen.add(nbr); order.push(nbr); }
    }
  }
  return order;
}

/**
 * Two oriented vertex edge-loops forming a basis of H₁(T²;ℤ), via the
 * tree–cotree (Eppstein) decomposition: a primal spanning tree T, a dual
 * spanning tree of the edges NOT in T, leaving exactly 2g = 2 edges. Each
 * leftover edge closed by its primal-tree path is a homology generator. Returns
 * each loop as a closed vertex walk [u, …, v, u].
 */
export function homologyGenerators(triangles: readonly Tri[]): number[][] {
  const edges = deriveEdges(triangles);
  const edgeToTris = deriveEdgeToTris(triangles);

  // primal spanning tree (BFS over vertices)
  const adj: number[][] = Array.from({ length: VERTEX_COUNT }, () => []);
  for (const [u, v] of edges) { adj[u].push(v); adj[v].push(u); }
  const parent = new Array<number>(VERTEX_COUNT).fill(-1);
  const inPrimalTree = new Set<number>();
  const vSeen = new Set<number>([0]);
  const vq = [0];
  for (let h = 0; h < vq.length; h++) {
    const u = vq[h];
    for (const v of adj[u]) if (!vSeen.has(v)) { vSeen.add(v); parent[v] = u; inPrimalTree.add(edgeKey(u, v)); vq.push(v); }
  }

  // dual spanning tree over edges NOT in the primal tree (BFS over triangles)
  const inDualTree = new Set<number>();
  const tSeen = new Set<number>([0]);
  const tq = [0];
  for (let h = 0; h < tq.length; h++) {
    const t = tq[h];
    const tri = triangles[t];
    for (let s = 0; s < 3; s++) {
      const k = edgeKey(tri[s], tri[(s + 1) % 3]);
      if (inPrimalTree.has(k)) continue; // dual tree may not cross the primal tree
      const [tA, tB] = edgeToTris.get(k)!;
      const nbr = tA === t ? tB : tA;
      if (!tSeen.has(nbr)) { tSeen.add(nbr); inDualTree.add(k); tq.push(nbr); }
    }
  }

  // leftover edges = generators (exactly 2 for a torus)
  const treePath = (u: number, v: number): number[] => {
    const up = (x: number) => { const p: number[] = [x]; while (parent[p[p.length - 1]] !== -1) p.push(parent[p[p.length - 1]]); return p; };
    const pu = up(u), pv = up(v);
    const setv = new Map(pv.map((x, i) => [x, i] as const));
    let lca = -1, iu = -1;
    for (let i = 0; i < pu.length; i++) if (setv.has(pu[i])) { lca = pu[i]; iu = i; break; }
    const left = pu.slice(0, iu + 1);          // u → … → lca
    const right = pv.slice(0, setv.get(lca)!).reverse(); // lca → … → v
    return [...left, ...right];                // u … lca … v
  };

  const gens: number[][] = [];
  for (const [u, v] of edges) {
    const k = edgeKey(u, v);
    if (inPrimalTree.has(k) || inDualTree.has(k)) continue;
    const path = treePath(v, u);               // v → … → u in the tree
    gens.push([...path, v]);                    // close with edge u→v: v…u,v
  }
  if (gens.length !== 2) throw new Error(`tree–cotree gave ${gens.length} generators, expected 2`);
  return gens;
}

// ---------------------------------------------------------------------------
// Validation guards on the hand-authored data
// ---------------------------------------------------------------------------

function checkDevelopOrder(developOrder: readonly number[], name: string): void {
  if (developOrder.length !== F) throw new Error(`[${name}] developOrder must have ${F} entries, got ${developOrder.length}`);
  const seen = new Set(developOrder);
  if (seen.size !== F) throw new Error(`[${name}] developOrder has duplicates`);
  for (const t of developOrder) if (t < 0 || t >= F) throw new Error(`[${name}] developOrder entry ${t} out of range`);
}

function checkGeneratorLoops(
  loops: readonly (readonly number[])[],
  edgeToTris: Map<number, readonly [number, number]>,
  name: string,
): void {
  if (loops.length !== 2) throw new Error(`[${name}] expected 2 generator loops, got ${loops.length}`);
  for (const loop of loops) {
    if (loop.length < 2 || loop[0] !== loop[loop.length - 1]) {
      throw new Error(`[${name}] generator loop [${loop}] is not closed (first must equal last)`);
    }
    for (let k = 0; k + 1 < loop.length; k++) {
      if (!edgeToTris.has(edgeKey(loop[k], loop[k + 1]))) {
        throw new Error(`[${name}] generator loop step ${loop[k]}→${loop[k + 1]} is not an edge`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function defineTorus(spec: TorusSpec): Torus {
  const { triangles, developOrder, generatorLoops, name } = spec;
  if (triangles.length !== F) throw new Error(`[${name}] expected ${F} triangles, got ${triangles.length}`);

  const edges = deriveEdges(triangles);
  const vertexLinks = deriveVertexLinks(triangles);
  const edgeToTris = deriveEdgeToTris(triangles);
  const degreeSequence = vertexLinks.map((l) => l.length).slice().sort((a, b) => a - b);

  checkDevelopOrder(developOrder, name);
  const attach = deriveAttach(triangles, developOrder, edgeToTris);
  checkGeneratorLoops(generatorLoops, edgeToTris, name);

  const { disjoint, sharedVertex } = classifyTrianglePairs(triangles);
  const cellPairs = deriveCellPairs(triangles, edges, disjoint);

  return {
    id: spec.id,
    name,
    vertexCount: VERTEX_COUNT,
    triangles,
    edges,
    vertexLinks,
    degreeSequence,
    edgeToTris,
    developOrder,
    attach,
    generatorLoops,
    disjointTrianglePairs: disjoint,
    sharedVertexTrianglePairs: sharedVertex,
    cellPairs,
    referenceCoords: spec.referenceCoords,
    symmetryPairing: spec.symmetryPairing,
    lattice: spec.lattice,
  };
}
