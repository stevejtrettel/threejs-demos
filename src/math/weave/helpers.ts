/**
 * Shared geometric utilities for textile patterns on quad meshes.
 */

import { Vector3 } from 'three';
import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Face, HalfEdge } from '../mesh/types';

/**
 * Collect the half-edges of a face into an array.
 */
export function faceEdgeArray(mesh: HalfEdgeMesh, face: Face): HalfEdge[] {
  const edges: HalfEdge[] = [];
  for (const he of mesh.faceEdges(face)) edges.push(he);
  return edges;
}

/**
 * Find the two half-edges of a given family on a quad face.
 * Returns [edgeA, edgeB] where edgeB = edgeA.next.next (opposite edge).
 */
export function familyEdges(
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
 * Compute the midpoint of a half-edge (average of its two endpoint positions).
 */
export function edgeMidpoint(he: HalfEdge, positions: Vector3[]): Vector3 {
  const a = positions[he.origin.index];
  const b = positions[he.next.origin.index];
  return new Vector3().addVectors(a, b).multiplyScalar(0.5);
}

/**
 * Compute face center (average of vertex positions).
 */
export function faceCenter(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const center = new Vector3();
  let count = 0;
  for (const v of mesh.faceVertices(face)) {
    center.add(positions[v.index]);
    count++;
  }
  return center.divideScalar(count);
}

/**
 * Compute face normal from the cross product of diagonals.
 */
export function faceNormal(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);

  const d1 = new Vector3().subVectors(verts[2], verts[0]);
  const d2 = new Vector3().subVectors(verts[3], verts[1]);
  return new Vector3().crossVectors(d1, d2).normalize();
}

/**
 * Compute the area of a quad face (half the cross product of diagonals).
 */
export function faceArea(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): number {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);

  const d1 = new Vector3().subVectors(verts[2], verts[0]);
  const d2 = new Vector3().subVectors(verts[3], verts[1]);
  return new Vector3().crossVectors(d1, d2).length() * 0.5;
}

/**
 * Sample a cubic Hermite curve.
 *
 * @param p0 - Start point
 * @param p1 - End point
 * @param t0 - Tangent at start
 * @param t1 - Tangent at end
 * @param numSamples - Number of intervals (produces numSamples+1 points if includeFirst)
 * @param includeFirst - Whether to include the t=0 point
 */
export function sampleHermite(
  p0: Vector3,
  p1: Vector3,
  t0: Vector3,
  t1: Vector3,
  numSamples: number,
  includeFirst: boolean
): Vector3[] {
  const points: Vector3[] = [];
  const start = includeFirst ? 0 : 1;

  for (let i = start; i <= numSamples; i++) {
    const t = i / numSamples;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    points.push(
      new Vector3()
        .addScaledVector(p0, h00)
        .addScaledVector(t0, h10)
        .addScaledVector(p1, h01)
        .addScaledVector(t1, h11)
    );
  }

  return points;
}

/**
 * Evaluate a uniform Catmull-Rom spline at parameter t ∈ [0,1]
 * given four control points p0..p3. The curve passes through p1 at t=0
 * and p2 at t=1.
 */
export function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const t2 = t * t;
  const t3 = t2 * t;
  return new Vector3(
    0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

/**
 * Sample a smooth Catmull-Rom curve through a sequence of waypoints.
 *
 * Pads endpoints with reflections for natural boundary tangents,
 * then distributes numSamples points evenly across the full curve.
 *
 * @param waypoints - Control points the curve passes through
 * @param numSamples - Number of sample intervals (produces numSamples+1 points if includeFirst)
 * @param includeFirst - Whether to include the t=0 point
 */
export function sampleCatmullRom(
  waypoints: Vector3[],
  numSamples: number,
  includeFirst: boolean,
): Vector3[] {
  const n = waypoints.length;

  // Pad with reflected endpoints for boundary conditions
  const padded = [
    new Vector3().subVectors(waypoints[0], new Vector3().subVectors(waypoints[1], waypoints[0])),
    ...waypoints,
    new Vector3().subVectors(waypoints[n - 1], new Vector3().subVectors(waypoints[n - 2], waypoints[n - 1])),
  ];

  const numSegments = n - 1;
  const points: Vector3[] = [];
  const start = includeFirst ? 0 : 1;

  for (let i = start; i <= numSamples; i++) {
    const t = i / numSamples;
    const segFloat = t * numSegments;
    const segIdx = Math.min(Math.floor(segFloat), numSegments - 1);
    const s = segFloat - segIdx;

    points.push(catmullRom(
      padded[segIdx], padded[segIdx + 1], padded[segIdx + 2], padded[segIdx + 3], s,
    ));
  }

  return points;
}
