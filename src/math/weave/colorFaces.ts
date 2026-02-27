/**
 * colorFaces — Stage 3: Face 2-Coloring (Checkerboard)
 *
 * Assigns each face a color (0 or 1) such that adjacent faces
 * (sharing an edge) have opposite colors. Uses BFS on the dual graph.
 */

import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Face } from '../mesh/types';

/**
 * 2-color the faces of a mesh.
 *
 * @param mesh - A half-edge mesh
 * @returns Array of face colors (0 or 1), indexed by face index
 * @throws If the dual graph is not 2-colorable (odd cycle)
 */
export function colorFaces(mesh: HalfEdgeMesh): number[] {
  const color = new Int8Array(mesh.faces.length).fill(-1);
  const queue: Face[] = [];

  // Seed face 0 with color 0
  color[mesh.faces[0].index] = 0;
  queue.push(mesh.faces[0]);

  // Index-based BFS to avoid O(n) shift
  let head = 0;
  while (head < queue.length) {
    const face = queue[head++]!;
    const myColor = color[face.index];
    const neighborColor = 1 - myColor;

    for (const neighbor of mesh.faceNeighbors(face)) {
      if (color[neighbor.index] === -1) {
        color[neighbor.index] = neighborColor;
        queue.push(neighbor);
      } else if (color[neighbor.index] === myColor) {
        throw new Error(
          `Mesh is not 2-colorable: faces ${face.index} and ${neighbor.index} ` +
          `are adjacent but both have color ${myColor}`
        );
      }
    }
  }

  return color as unknown as number[];
}
