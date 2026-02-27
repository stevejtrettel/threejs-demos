/**
 * traceStrands — Strand Tracing
 *
 * Traces continuous strands through the mesh. Each face has two segments
 * (one per edge family), connecting midpoints of same-family edges.
 * Segments connect across faces via twin edges to form long continuous strands.
 */

import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Face, HalfEdge } from '../mesh/types';
import { familyEdges } from './helpers';

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
 * Trace in one direction from a face, exiting through exitEdge.
 * Does NOT include the starting face in the result.
 *
 * @param startFace - The face we're tracing from (used to detect closure)
 * @param exitEdge - The edge to exit through
 * @param visitedFaces - Set of face indices already in the current strand (for O(1) cycle check)
 */
function traceDirection(
  startFace: Face,
  exitEdge: HalfEdge,
  visitedFaces: Set<number>,
): StrandSegment[] {
  const result: StrandSegment[] = [];
  let currentExit = exitEdge;

  while (true) {
    const twin = currentExit.twin;
    if (!twin) break; // boundary

    const nextFace = twin.face;
    if (!nextFace || nextFace === startFace) break; // loop closed or shouldn't happen

    // Check if we've looped back to a face already in result
    if (visitedFaces.has(nextFace.index)) break;

    // In the next face, we enter through `twin`.
    // Exit through the opposite edge (same family, other side of quad).
    const entryEdge = twin;
    const exitEdge = twin.next.next; // opposite edge on quad

    result.push({ face: nextFace, entryEdge, exitEdge });
    visitedFaces.add(nextFace.index);
    currentExit = exitEdge;
  }

  return result;
}

/**
 * Trace all strands through a quad mesh.
 *
 * @param mesh - A quad half-edge mesh
 * @param edgeFamilies - Edge family classification from classifyEdges()
 * @param families - Which families to trace (default: both [0, 1])
 * @returns Array of Strand objects
 */
export function traceStrands(
  mesh: HalfEdgeMesh,
  edgeFamilies: number[],
  families: (0 | 1)[] = [0, 1]
): Strand[] {
  const strands: Strand[] = [];

  // Track visited face+family slots: index = face.index * 2 + family
  const visited = new Uint8Array(mesh.faces.length * 2);

  for (const face of mesh.faces) {
    for (const family of families) {
      const slot = face.index * 2 + family;
      if (visited[slot]) continue;

      // Find the two same-family edges on this face
      const [edgeA, edgeB] = familyEdges(mesh, face, edgeFamilies, family);

      // Track faces in the current strand for O(1) cycle detection
      const strandFaces = new Set<number>([face.index]);

      // Trace forward (exit through edgeA)
      const forward = traceDirection(face, edgeA, strandFaces);

      // Trace backward (exit through edgeB)
      const backward = traceDirection(face, edgeB, strandFaces);

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
        visited[seg.face.index * 2 + family] = 1;
      }

      strands.push({ segments, family, closed });
    }
  }

  return strands;
}
