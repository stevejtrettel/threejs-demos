/**
 * extractBoundary.ts - Boundary loop extraction for meshes
 *
 * Extracts boundary edges (edges belonging to exactly one face) and
 * connects them into ordered loops of vertex positions.
 */

import { Vector3 } from 'three';
import type { ParsedMesh, GroupedMesh, GroupedFace } from './parseOBJ';

/**
 * A boundary loop: ordered array of vertex positions tracing one connected boundary
 */
export type BoundaryLoop = Vector3[];

/**
 * Extract boundary edges from faces (edges appearing in exactly one face)
 *
 * @param faces - Array of face index arrays or GroupedFace objects
 * @returns Array of [vertexA, vertexB] pairs representing boundary edges
 *
 * @example
 * const mesh = parseOBJ(objText);
 * const boundaryEdges = extractBoundaryEdges(mesh.faces);
 * console.log(`Found ${boundaryEdges.length} boundary edges`);
 */
export function extractBoundaryEdges(faces: number[][] | GroupedFace[]): [number, number][] {
  // Count how many faces contain each edge
  const edgeCounts = new Map<string, number>();
  const edgeList = new Map<string, [number, number]>();

  for (const face of faces) {
    const indices = Array.isArray(face) ? face : face.indices;
    const n = indices.length;

    for (let i = 0; i < n; i++) {
      const a = indices[i];
      const b = indices[(i + 1) % n];

      // Normalize edge direction for consistent keying
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const key = `${min}-${max}`;

      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      edgeList.set(key, [min, max]);
    }
  }

  // Filter to edges appearing exactly once (boundary edges)
  const boundaryEdges: [number, number][] = [];
  for (const [key, count] of edgeCounts) {
    if (count === 1) {
      boundaryEdges.push(edgeList.get(key)!);
    }
  }

  return boundaryEdges;
}

/**
 * Extract all boundary loops from a mesh
 *
 * A boundary edge is an edge that belongs to exactly one face.
 * This function finds all boundary edges and connects them into
 * ordered loops, returning the vertex positions in traversal order.
 *
 * @param mesh - ParsedMesh or GroupedMesh
 * @returns Array of boundary loops (each loop is an ordered array of Vector3)
 *
 * @example
 * const mesh = parseOBJ(objText);
 * const boundaries = extractBoundary(mesh);
 * console.log(`Found ${boundaries.length} boundary loops`);
 * for (const loop of boundaries) {
 *   console.log(`Loop with ${loop.length} vertices`);
 * }
 */
export function extractBoundary(mesh: ParsedMesh | GroupedMesh): BoundaryLoop[] {
  const faces = 'faces' in mesh ? mesh.faces : [];
  const vertices = mesh.vertices;

  // Get boundary edges
  const boundaryEdges = extractBoundaryEdges(faces);

  if (boundaryEdges.length === 0) {
    return [];
  }

  // Build adjacency map: vertex -> set of connected boundary vertices
  const adjacency = new Map<number, Set<number>>();

  for (const [a, b] of boundaryEdges) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  // Track which edges have been visited
  const visitedEdges = new Set<string>();

  const makeEdgeKey = (a: number, b: number): string => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return `${min}-${max}`;
  };

  const loops: BoundaryLoop[] = [];

  // Process all boundary edges, grouping into loops
  for (const [startA, startB] of boundaryEdges) {
    const startKey = makeEdgeKey(startA, startB);
    if (visitedEdges.has(startKey)) continue;

    // Start a new loop
    const loopIndices: number[] = [startA];
    let current = startA;
    let next = startB;

    while (next !== startA) {
      visitedEdges.add(makeEdgeKey(current, next));
      loopIndices.push(next);

      // Find the next vertex (the other neighbor of 'next' that isn't 'current')
      const neighbors = adjacency.get(next);
      if (!neighbors) break;

      let found = false;
      for (const neighbor of neighbors) {
        if (neighbor !== current) {
          const edgeKey = makeEdgeKey(next, neighbor);
          if (!visitedEdges.has(edgeKey)) {
            current = next;
            next = neighbor;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
    }

    // Mark the closing edge as visited
    if (next === startA && loopIndices.length > 1) {
      visitedEdges.add(makeEdgeKey(current, next));
    }

    // Convert indices to Vector3 positions
    const loop: BoundaryLoop = loopIndices.map(idx => vertices[idx].clone());
    loops.push(loop);
  }

  return loops;
}

/**
 * Extract boundary loops as vertex indices instead of positions
 *
 * @param mesh - ParsedMesh or GroupedMesh
 * @returns Array of boundary loops (each loop is an ordered array of vertex indices)
 *
 * @example
 * const mesh = parseOBJ(objText);
 * const boundaries = extractBoundaryIndices(mesh);
 * for (const loop of boundaries) {
 *   console.log('Boundary vertex indices:', loop);
 * }
 */
export function extractBoundaryIndices(mesh: ParsedMesh | GroupedMesh): number[][] {
  const faces = 'faces' in mesh ? mesh.faces : [];

  // Get boundary edges
  const boundaryEdges = extractBoundaryEdges(faces);

  if (boundaryEdges.length === 0) {
    return [];
  }

  // Build adjacency map: vertex -> set of connected boundary vertices
  const adjacency = new Map<number, Set<number>>();

  for (const [a, b] of boundaryEdges) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  // Track which edges have been visited
  const visitedEdges = new Set<string>();

  const makeEdgeKey = (a: number, b: number): string => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return `${min}-${max}`;
  };

  const loops: number[][] = [];

  // Process all boundary edges, grouping into loops
  for (const [startA, startB] of boundaryEdges) {
    const startKey = makeEdgeKey(startA, startB);
    if (visitedEdges.has(startKey)) continue;

    // Start a new loop
    const loopIndices: number[] = [startA];
    let current = startA;
    let next = startB;

    while (next !== startA) {
      visitedEdges.add(makeEdgeKey(current, next));
      loopIndices.push(next);

      // Find the next vertex (the other neighbor of 'next' that isn't 'current')
      const neighbors = adjacency.get(next);
      if (!neighbors) break;

      let found = false;
      for (const neighbor of neighbors) {
        if (neighbor !== current) {
          const edgeKey = makeEdgeKey(next, neighbor);
          if (!visitedEdges.has(edgeKey)) {
            current = next;
            next = neighbor;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
    }

    // Mark the closing edge as visited
    if (next === startA && loopIndices.length > 1) {
      visitedEdges.add(makeEdgeKey(current, next));
    }

    loops.push(loopIndices);
  }

  return loops;
}
