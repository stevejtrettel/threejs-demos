/**
 * traceStrands — Stage 4: Strand Tracing
 *
 * Traces continuous strands through the mesh. Each face has two segments
 * (one per edge family), connecting midpoints of same-family edges.
 * Segments connect across faces via twin edges to form long continuous strands.
 */

import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Face, HalfEdge } from '../mesh/types';

/** A segment of a strand crossing one face */
export interface StrandSegment {
  face: Face;
  entryEdge: HalfEdge;
  exitEdge: HalfEdge;
}

/** A complete traced strand */
export interface Strand {
  segments: StrandSegment[];
  family: 0 | 1;
  closed: boolean;
}

/**
 * Collect the half-edges of a face into an array.
 */
function faceEdgeArray(mesh: HalfEdgeMesh, face: Face): HalfEdge[] {
  const edges: HalfEdge[] = [];
  for (const he of mesh.faceEdges(face)) edges.push(he);
  return edges;
}

/**
 * Find the two half-edges of a given family on a quad face.
 * Returns [edgeA, edgeB] where edgeB = edgeA.next.next (opposite edge).
 */
function familyEdges(
  mesh: HalfEdgeMesh,
  face: Face,
  edgeFamilies: number[],
  family: number
): [HalfEdge, HalfEdge] {
  const edges = faceEdgeArray(mesh, face);
  const matches: HalfEdge[] = [];
  for (const e of edges) {
    if (edgeFamilies[e.index] === family) matches.push(e);
  }
  return [matches[0], matches[1]];
}

/**
 * Trace in one direction from a face, exiting through exitEdge.
 * Does NOT include the starting face in the result.
 */
function traceDirection(
  startFace: Face,
  exitEdge: HalfEdge,
): StrandSegment[] {
  const result: StrandSegment[] = [];
  let currentExit = exitEdge;

  while (true) {
    const twin = currentExit.twin;
    if (!twin) break; // boundary

    const nextFace = twin.face;
    if (!nextFace || nextFace === startFace) break; // loop closed or shouldn't happen

    // Check if we've looped back to a face already in result
    if (result.some(s => s.face === nextFace)) break;

    // In the next face, we enter through `twin`.
    // Exit through the opposite edge (same family, other side of quad).
    const entryEdge = twin;
    const exitEdge = twin.next.next; // opposite edge on quad

    result.push({ face: nextFace, entryEdge, exitEdge });
    currentExit = exitEdge;
  }

  return result;
}

/**
 * Trace all strands through a quad mesh.
 *
 * @param mesh - A quad half-edge mesh
 * @param edgeFamilies - Edge family classification from classifyEdges()
 * @returns Array of Strand objects
 */
export function traceStrands(
  mesh: HalfEdgeMesh,
  edgeFamilies: number[]
): Strand[] {
  const strands: Strand[] = [];

  // Track visited face+family slots
  const visited = new Set<string>();

  for (const face of mesh.faces) {
    for (const family of [0, 1] as const) {
      const key = `${face.index}-${family}`;
      if (visited.has(key)) continue;

      // Find the two same-family edges on this face
      const [edgeA, edgeB] = familyEdges(mesh, face, edgeFamilies, family);

      // Trace forward (exit through edgeA)
      const forward = traceDirection(face, edgeA);

      // Trace backward (exit through edgeB)
      const backward = traceDirection(face, edgeB);

      // Build the start face's segment
      // Convention: if we traced backward exiting through edgeB,
      // then the start face's entry is edgeB side, exit is edgeA side.
      const startSegment: StrandSegment = {
        face,
        entryEdge: edgeB,
        exitEdge: edgeA,
      };

      // Combine: reverse backward, then start, then forward
      // Backward segments need their entry/exit swapped since we reverse direction
      const backwardReversed = backward.reverse().map(s => ({
        face: s.face,
        entryEdge: s.exitEdge,
        exitEdge: s.entryEdge,
      }));

      const segments = [...backwardReversed, startSegment, ...forward];

      // Check if strand is closed: does the last exit twin back to the first entry?
      const lastExit = segments[segments.length - 1].exitEdge;
      const firstEntry = segments[0].entryEdge;
      const closed = lastExit.twin !== null &&
        lastExit.twin.face === firstEntry.face &&
        segments.length > 1;

      // Mark all face+family slots as visited
      for (const seg of segments) {
        visited.add(`${seg.face.index}-${family}`);
      }

      strands.push({ segments, family, closed });
    }
  }

  return strands;
}
