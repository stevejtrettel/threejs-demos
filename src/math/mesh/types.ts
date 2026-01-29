/**
 * Half-Edge Mesh Types
 *
 * Pure combinatorial topology — no positions, no geometry.
 * A half-edge mesh represents a 2-manifold (possibly with boundary)
 * via three cell types: vertices, half-edges, and faces.
 *
 * Each directed edge has a twin (opposite direction) and a next
 * (next edge around the face). Each vertex stores one outgoing
 * edge for O(1) fan traversal.
 */

/**
 * A vertex in the mesh.
 *
 * Knows its index and one outgoing half-edge (for traversal).
 */
export interface Vertex {
  readonly index: number;
  /** One outgoing half-edge. Null only for isolated vertices. */
  halfEdge: HalfEdge | null;
}

/**
 * A directed half-edge.
 *
 * The fundamental connectivity element. Each undirected edge
 * is represented by a pair of twin half-edges (or one half-edge
 * with twin=null on the boundary).
 */
export interface HalfEdge {
  readonly index: number;
  /** Vertex this edge points away from */
  origin: Vertex;
  /** Opposite half-edge (null on boundary) */
  twin: HalfEdge | null;
  /** Next half-edge around the face (CCW) */
  next: HalfEdge;
  /** The face this half-edge borders (null for boundary edges) */
  face: Face | null;
}

/**
 * A face in the mesh.
 *
 * Knows its index and one half-edge on its boundary.
 * All edges of the face are reachable by following `next`.
 */
export interface Face {
  readonly index: number;
  /** One half-edge on this face's boundary */
  halfEdge: HalfEdge;
}
