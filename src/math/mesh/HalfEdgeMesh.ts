/**
 * Half-Edge Mesh
 *
 * A combinatorial 2-manifold (possibly with boundary) built from
 * vertices, directed half-edges, and faces.
 *
 * Construct from a polygon soup via `HalfEdgeMesh.fromSoup()`.
 * Traverse with the iterator methods on the instance.
 */

import type { Vertex, HalfEdge, Face } from './types';

export class HalfEdgeMesh {
  readonly vertices: Vertex[];
  readonly halfEdges: HalfEdge[];
  readonly faces: Face[];

  constructor(vertices: Vertex[], halfEdges: HalfEdge[], faces: Face[]) {
    this.vertices = vertices;
    this.halfEdges = halfEdges;
    this.faces = faces;
  }

  // ── Construction ─────────────────────────────────────────────

  /**
   * Build a half-edge mesh from a polygon soup.
   *
   * @param vertexCount - Number of vertices
   * @param faceIndices - Each element is an array of vertex indices
   *                      forming one face (CCW winding)
   */
  static fromSoup(vertexCount: number, faceIndices: number[][]): HalfEdgeMesh {
    // Create vertices
    const vertices: Vertex[] = [];
    for (let i = 0; i < vertexCount; i++) {
      vertices.push({ index: i, halfEdge: null });
    }

    const halfEdges: HalfEdge[] = [];
    const faces: Face[] = [];

    // Map from "originIdx-destIdx" to half-edge, for twin matching
    const edgeMap = new Map<string, HalfEdge>();

    for (let fi = 0; fi < faceIndices.length; fi++) {
      const indices = faceIndices[fi];
      const n = indices.length;

      const face: Face = {
        index: fi,
        halfEdge: null!,
      };

      // Create half-edges for this face
      const faceEdges: HalfEdge[] = [];
      for (let j = 0; j < n; j++) {
        const he: HalfEdge = {
          index: halfEdges.length + j,
          origin: vertices[indices[j]],
          twin: null,
          next: null!,
          face,
        };
        faceEdges.push(he);
      }

      // Wire up next pointers (circular)
      for (let j = 0; j < n; j++) {
        (faceEdges[j] as { next: HalfEdge }).next = faceEdges[(j + 1) % n];
      }

      // Set face's half-edge
      (face as { halfEdge: HalfEdge }).halfEdge = faceEdges[0];

      // Set vertex outgoing edges (first one wins)
      for (let j = 0; j < n; j++) {
        const v = vertices[indices[j]];
        if (v.halfEdge === null) {
          v.halfEdge = faceEdges[j];
        }
      }

      // Register in edge map and match twins
      for (let j = 0; j < n; j++) {
        const he = faceEdges[j];
        const originIdx = indices[j];
        const destIdx = indices[(j + 1) % n];

        const key = `${originIdx}-${destIdx}`;
        const twinKey = `${destIdx}-${originIdx}`;

        const twin = edgeMap.get(twinKey);
        if (twin) {
          (he as { twin: HalfEdge | null }).twin = twin;
          (twin as { twin: HalfEdge | null }).twin = he;
          edgeMap.delete(twinKey);
        } else {
          edgeMap.set(key, he);
        }
      }

      halfEdges.push(...faceEdges);
      faces.push(face);
    }

    // Validate: any key still in edgeMap with a twin key means
    // non-manifold. Remaining unpaired edges are boundary — that's fine.
    // But if the same directed edge appears twice, the mesh is non-manifold.

    return new HalfEdgeMesh(vertices, halfEdges, faces);
  }

  // ── Traversal ────────────────────────────────────────────────

  /**
   * Iterate over the half-edges forming a face's boundary.
   */
  *faceEdges(face: Face): IterableIterator<HalfEdge> {
    const start = face.halfEdge;
    let he = start;
    do {
      yield he;
      he = he.next;
    } while (he !== start);
  }

  /**
   * Iterate over the vertices of a face (in winding order).
   */
  *faceVertices(face: Face): IterableIterator<Vertex> {
    for (const he of this.faceEdges(face)) {
      yield he.origin;
    }
  }

  /**
   * Iterate over the outgoing half-edges from a vertex.
   *
   * Walks the fan by going next then twin.
   * If the vertex is on a boundary, this may not visit all edges —
   * use `vertexEdgesUnordered` for a complete but unordered traversal.
   */
  *vertexOutgoing(vertex: Vertex): IterableIterator<HalfEdge> {
    const start = vertex.halfEdge;
    if (!start) return;

    let he: HalfEdge | null = start;
    do {
      yield he!;
      // Go to previous edge on this face, then cross to twin
      const prev = this.prevEdge(he!);
      he = prev.twin;
    } while (he !== null && he !== start);

    // If we hit a boundary (he === null), we only traversed one direction.
    // Walk the other direction from start.
    if (he === null) {
      he = start.twin;
      while (he !== null) {
        // he is incoming to vertex; its next is outgoing from vertex
        yield he.next;
        he = he.next.twin === null ? null : this.prevEdge(he.next).twin;
      }
    }
  }

  /**
   * Iterate over faces adjacent to a vertex.
   */
  *vertexFaces(vertex: Vertex): IterableIterator<Face> {
    for (const he of this.vertexOutgoing(vertex)) {
      if (he.face) yield he.face;
    }
  }

  /**
   * Iterate over vertices adjacent to a vertex (1-ring neighbors).
   */
  *vertexNeighbors(vertex: Vertex): IterableIterator<Vertex> {
    for (const he of this.vertexOutgoing(vertex)) {
      yield he.next.origin;
    }
  }

  /**
   * Iterate over faces neighboring a face (sharing an edge).
   */
  *faceNeighbors(face: Face): IterableIterator<Face> {
    for (const he of this.faceEdges(face)) {
      if (he.twin && he.twin.face) {
        yield he.twin.face;
      }
    }
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Number of sides on a face */
  faceSides(face: Face): number {
    let count = 0;
    for (const _ of this.faceEdges(face)) count++;
    return count;
  }

  /** Valence (degree) of a vertex */
  vertexValence(vertex: Vertex): number {
    let count = 0;
    for (const _ of this.vertexOutgoing(vertex)) count++;
    return count;
  }

  /** Whether a vertex is on the boundary */
  isVertexBoundary(vertex: Vertex): boolean {
    for (const he of this.vertexOutgoing(vertex)) {
      if (he.twin === null) return true;
    }
    return false;
  }

  /** Whether the mesh has no boundary */
  isClosed(): boolean {
    return this.halfEdges.every((he) => he.twin !== null);
  }

  /** All boundary half-edges (those with no twin) */
  boundaryEdges(): HalfEdge[] {
    return this.halfEdges.filter((he) => he.twin === null);
  }

  /**
   * One half-edge per undirected edge.
   * For interior edges, picks the one with lower index.
   * For boundary edges, picks the only one.
   */
  uniqueEdges(): HalfEdge[] {
    const edges: HalfEdge[] = [];
    for (const he of this.halfEdges) {
      if (he.twin === null || he.index < he.twin.index) {
        edges.push(he);
      }
    }
    return edges;
  }

  /** Euler characteristic: V - E + F */
  eulerCharacteristic(): number {
    return this.vertices.length - this.uniqueEdges().length + this.faces.length;
  }

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Get the previous half-edge around a face.
   * (Walks next until we loop back — O(face size), typically O(3).)
   */
  private prevEdge(he: HalfEdge): HalfEdge {
    let prev = he;
    while (prev.next !== he) {
      prev = prev.next;
    }
    return prev;
  }
}
