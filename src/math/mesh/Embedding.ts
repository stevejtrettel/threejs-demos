/**
 * Embedding — vertex positions in R³ for a `HalfEdgeMesh`.
 *
 * The mutable state that mesh evolvers act on. Topology lives in `mesh`;
 * positions live in a flat `Float32Array` of stride 3, chosen for direct
 * compatibility with `THREE.BufferAttribute` and for cache-friendly
 * gradient-update loops.
 *
 * Per-frame convention is **manual sync, no Params cascade**: evolvers
 * mutate `positions` in place and downstream views (e.g. `MeshView`) hold
 * the same buffer and call their own `sync()` from the animate loop. The
 * `positions` reference is `readonly` so views can keep it stably; element
 * writes go through `positions[k]` directly or via the bulk helpers below.
 *
 * R³-only for now. When we later need S³ / hyperbolic / etc., we plug an
 * `AmbientSpace` back in (the interface exists at `@/math/spaces`); for
 * now keeping the surface area minimal.
 */

import type * as THREE from 'three';
import { HalfEdgeMesh } from './HalfEdgeMesh';
import type { ParsedMesh, GroupedMesh } from './parseOBJ';

/** A point in R³ as a literal triple. */
export type Triple = readonly [number, number, number];

export interface EmbeddingOptions {
  /** Wrap an existing position buffer. Length must be `3 * mesh.vertices.length`. */
  positions?: Float32Array;
  /** Seed positions from `[x, y, z]` triples, one per vertex. Mutually exclusive with `positions`. */
  initial?: readonly Triple[];
}

export class Embedding {
  readonly mesh: HalfEdgeMesh;
  readonly N: number;
  /** Stride 3, length `3 * N`. Reference is fixed; elements are freely mutable. */
  readonly positions: Float32Array;

  constructor(mesh: HalfEdgeMesh, options: EmbeddingOptions = {}) {
    this.mesh = mesh;
    this.N = mesh.vertices.length;

    const expectedLen = 3 * this.N;

    if (options.positions) {
      if (options.initial) {
        throw new Error('Embedding: pass either `positions` or `initial`, not both.');
      }
      if (options.positions.length !== expectedLen) {
        throw new Error(
          `Embedding: positions length ${options.positions.length} does not match expected ${expectedLen}.`,
        );
      }
      this.positions = options.positions;
    } else {
      this.positions = new Float32Array(expectedLen);
      if (options.initial) {
        this.copyFromTriples(options.initial);
      }
    }
  }

  // ── Read accessors ────────────────────────────────────────────

  /**
   * Position of vertex `i`. Allocates a length-3 `Float32Array` if no
   * `out` is supplied; pass a reusable scratch buffer in hot loops.
   */
  position(i: number, out?: Float32Array): Float32Array {
    const a = 3 * i;
    const result = out ?? new Float32Array(3);
    result[0] = this.positions[a];
    result[1] = this.positions[a + 1];
    result[2] = this.positions[a + 2];
    return result;
  }

  /** Euclidean distance between vertices `i` and `j`. */
  distance(i: number, j: number): number {
    const a = 3 * i, b = 3 * j;
    const dx = this.positions[a]     - this.positions[b];
    const dy = this.positions[a + 1] - this.positions[b + 1];
    const dz = this.positions[a + 2] - this.positions[b + 2];
    return Math.hypot(dx, dy, dz);
  }

  /**
   * Vector from `i` to `j`: `pos[j] − pos[i]`. Matches the legacy
   * `Embedding.difference` convention so ported energy code reads the
   * same way.
   */
  difference(i: number, j: number, out?: Float32Array): Float32Array {
    const a = 3 * i, b = 3 * j;
    const result = out ?? new Float32Array(3);
    result[0] = this.positions[b]     - this.positions[a];
    result[1] = this.positions[b + 1] - this.positions[a + 1];
    result[2] = this.positions[b + 2] - this.positions[a + 2];
    return result;
  }

  // ── Bulk write ────────────────────────────────────────────────

  /**
   * `positions[k] += scale · vec[k]` for all k. The standard gradient-
   * step primitive: `emb.addScaledVector(grad, -dt)` for descent.
   */
  addScaledVector(vec: Float32Array, scale: number): void {
    const pos = this.positions;
    for (let k = 0; k < pos.length; k++) {
      pos[k] += scale * vec[k];
    }
  }

  /**
   * Element-wise copy from `[x, y, z]` triples into the existing buffer.
   * Preserves the buffer reference so views holding it stay valid.
   */
  copyFromTriples(triples: readonly Triple[]): void {
    if (triples.length !== this.N) {
      throw new Error(
        `Embedding.copyFromTriples: got ${triples.length} triples, expected ${this.N}.`,
      );
    }
    const pos = this.positions;
    for (let i = 0; i < this.N; i++) {
      const t = triples[i];
      const a = 3 * i;
      pos[a]     = t[0];
      pos[a + 1] = t[1];
      pos[a + 2] = t[2];
    }
  }

  // ── Static helpers ────────────────────────────────────────────

  /**
   * Build an `Embedding` from a parsed OBJ. Constructs the half-edge
   * topology via `HalfEdgeMesh.fromSoup` and seeds positions from the
   * parsed `Vector3` vertices.
   */
  static fromOBJ(parsed: ParsedMesh, options: EmbeddingOptions = {}): Embedding {
    const mesh = HalfEdgeMesh.fromSoup(parsed.vertices.length, parsed.faces);
    if (options.positions || options.initial) {
      return new Embedding(mesh, options);
    }
    return new Embedding(mesh, { initial: vector3sToTriples(parsed.vertices) });
  }

  /**
   * Build an `Embedding` from a grouped OBJ — uses the vertex array and
   * the per-face index lists, ignoring the group / material metadata.
   * Use `OBJStructure` or a per-group `MeshView` if you want that
   * metadata for rendering.
   */
  static fromGroupedOBJ(grouped: GroupedMesh, options: EmbeddingOptions = {}): Embedding {
    const faceIndices = grouped.faces.map((f) => f.indices);
    const mesh = HalfEdgeMesh.fromSoup(grouped.vertices.length, faceIndices);
    if (options.positions || options.initial) {
      return new Embedding(mesh, options);
    }
    return new Embedding(mesh, { initial: vector3sToTriples(grouped.vertices) });
  }
}

function vector3sToTriples(vs: readonly THREE.Vector3[]): Triple[] {
  return vs.map((v): Triple => [v.x, v.y, v.z]);
}
