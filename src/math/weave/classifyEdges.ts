/**
 * classifyEdges — Edge Family Classification
 *
 * Classifies every edge of a quad mesh into one of two families (U=0, V=1).
 * On each quad face, opposite edges share a family and adjacent edges differ.
 * Uses BFS flood-fill across twin edges.
 */

import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Face } from '../mesh/types';
import { faceEdgeArray } from './helpers';

/**
 * Classify edges of a quad mesh into two families.
 *
 * @param mesh - A half-edge mesh where every face has exactly 4 sides
 * @returns Array of family values (0 or 1), indexed by half-edge index
 * @throws If any face is not a quad, or if classification is inconsistent
 */
export function classifyEdges(mesh: HalfEdgeMesh): number[] {
  const family = new Int8Array(mesh.halfEdges.length).fill(-1);

  // Validate all faces are quads
  for (const face of mesh.faces) {
    if (mesh.faceSides(face) !== 4) {
      throw new Error(`Face ${face.index} has ${mesh.faceSides(face)} sides, expected 4`);
    }
  }

  // BFS queue of faces to process
  const queue: Face[] = [];
  const visited = new Uint8Array(mesh.faces.length);

  // Seed: label face 0's edges alternating [0, 1, 0, 1]
  const startFace = mesh.faces[0];
  const startEdges = faceEdgeArray(mesh, startFace);
  for (let i = 0; i < 4; i++) {
    family[startEdges[i].index] = i % 2;
    if (startEdges[i].twin) {
      family[startEdges[i].twin!.index] = i % 2;
    }
  }
  visited[startFace.index] = 1;

  // Enqueue neighbors of seed face
  for (const neighbor of mesh.faceNeighbors(startFace)) {
    if (!visited[neighbor.index]) {
      queue.push(neighbor);
    }
  }

  // BFS (index-based to avoid O(n) shift)
  let head = 0;
  while (head < queue.length) {
    const face = queue[head++]!;
    if (visited[face.index]) continue;
    visited[face.index] = 1;

    const edges = faceEdgeArray(mesh, face);

    // Find an edge that's already labeled (shared with a processed neighbor)
    let knownIdx = -1;
    for (let i = 0; i < 4; i++) {
      if (family[edges[i].index] !== -1) {
        knownIdx = i;
        break;
      }
    }

    if (knownIdx === -1) {
      throw new Error(`Face ${face.index} reached by BFS but has no labeled edges`);
    }

    const knownFamily = family[edges[knownIdx].index];

    // Label all 4 edges: opposite gets same family, adjacent gets different
    for (let i = 0; i < 4; i++) {
      const expected = (i % 2 === knownIdx % 2) ? knownFamily : (1 - knownFamily);

      if (family[edges[i].index] !== -1 && family[edges[i].index] !== expected) {
        throw new Error(
          `Inconsistent edge classification at face ${face.index}, edge ${edges[i].index}: ` +
          `expected ${expected}, found ${family[edges[i].index]}`
        );
      }

      family[edges[i].index] = expected;

      // Twin gets the same family
      if (edges[i].twin && family[edges[i].twin!.index] === -1) {
        family[edges[i].twin!.index] = expected;
      }
    }

    // Enqueue unvisited neighbors
    for (const neighbor of mesh.faceNeighbors(face)) {
      if (!visited[neighbor.index]) {
        queue.push(neighbor);
      }
    }
  }

  return family as unknown as number[];
}
