/**
 * buildWeave — Main entry point for weave generation
 *
 * Takes a ParsedMesh (quad faces), builds the half-edge structure internally,
 * classifies edges, colors faces, traces strands, and generates curve geometry
 * with over/under displacement.
 */

import { Vector3 } from 'three';
import { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { ParsedMesh } from '../mesh/parseOBJ';
import type { HalfEdge, Face } from '../mesh/types';
import type { WeaveOptions, WeaveResult } from './types';
import { classifyEdges } from './classifyEdges';
import { colorFaces } from './colorFaces';
import { traceStrands, type Strand } from './traceStrands';

const DEFAULT_AMPLITUDE = 0.05;
const DEFAULT_SAMPLES_PER_SEGMENT = 8;

/**
 * Compute the midpoint of a half-edge (average of its two endpoint positions).
 */
function edgeMidpoint(he: HalfEdge, positions: Vector3[]): Vector3 {
  const a = positions[he.origin.index];
  // The "destination" vertex is he.next.origin
  const b = positions[he.next.origin.index];
  return new Vector3().addVectors(a, b).multiplyScalar(0.5);
}

/**
 * Compute face center (average of vertex positions).
 */
function faceCenter(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
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
function faceNormal(mesh: HalfEdgeMesh, face: Face, positions: Vector3[]): Vector3 {
  const verts: Vector3[] = [];
  for (const v of mesh.faceVertices(face)) verts.push(positions[v.index]);

  const d1 = new Vector3().subVectors(verts[2], verts[0]);
  const d2 = new Vector3().subVectors(verts[3], verts[1]);
  return new Vector3().crossVectors(d1, d2).normalize();
}

/**
 * Sample a cubic Hermite curve with normal displacement.
 *
 * @param p0 - Start point
 * @param p1 - End point
 * @param t0 - Tangent at start
 * @param t1 - Tangent at end
 * @param normal - Face normal for displacement
 * @param sign - +1 (over) or -1 (under)
 * @param amplitude - Displacement magnitude
 * @param numSamples - Number of samples
 * @param includeFirst - Whether to include the t=0 point
 */
function sampleHermiteWithDisplacement(
  p0: Vector3,
  p1: Vector3,
  t0: Vector3,
  t1: Vector3,
  normal: Vector3,
  sign: number,
  amplitude: number,
  numSamples: number,
  includeFirst: boolean
): Vector3[] {
  const points: Vector3[] = [];
  const start = includeFirst ? 0 : 1;

  for (let i = start; i <= numSamples; i++) {
    const t = i / numSamples;
    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    // Base curve point
    const point = new Vector3()
      .addScaledVector(p0, h00)
      .addScaledVector(t0, h10)
      .addScaledVector(p1, h01)
      .addScaledVector(t1, h11);

    // Over/under displacement: sin(π*t) profile
    const displacement = sign * amplitude * Math.sin(Math.PI * t);
    point.addScaledVector(normal, displacement);

    points.push(point);
  }

  return points;
}

/**
 * Generate the 3D polyline for a single strand.
 */
function generateStrandCurve(
  mesh: HalfEdgeMesh,
  strand: Strand,
  positions: Vector3[],
  faceColors: number[],
  amplitude: number,
  samplesPerSegment: number
): Vector3[] {
  const points: Vector3[] = [];

  for (let i = 0; i < strand.segments.length; i++) {
    const seg = strand.segments[i];
    const isFirst = i === 0;

    // Entry and exit midpoints
    const p0 = edgeMidpoint(seg.entryEdge, positions);
    const p1 = edgeMidpoint(seg.exitEdge, positions);

    // Face geometry
    const center = faceCenter(mesh, seg.face, positions);
    const normal = faceNormal(mesh, seg.face, positions);

    // Tangents pointing toward face center
    const dist = p0.distanceTo(p1);
    const tangentScale = 0.5 * dist;
    const t0 = new Vector3().subVectors(center, p0).normalize().multiplyScalar(tangentScale);
    const t1 = new Vector3().subVectors(p1, center).normalize().multiplyScalar(tangentScale);

    // Over/under sign: if faceColor == family, strand is on top (+1)
    const sign = (faceColors[seg.face.index] === strand.family) ? 1 : -1;

    // Sample the Hermite curve with displacement
    const segPoints = sampleHermiteWithDisplacement(
      p0, p1, t0, t1, normal, sign, amplitude,
      samplesPerSegment,
      isFirst // only include first point on first segment to avoid duplicates
    );

    points.push(...segPoints);
  }

  return points;
}

/**
 * Build a woven pattern from a quad mesh.
 *
 * @param parsedMesh - A parsed mesh with quad faces (from parseOBJ)
 * @param options - Weave parameters
 * @returns WeaveResult with strand polylines and metadata
 */
export function buildWeave(
  parsedMesh: ParsedMesh,
  options?: WeaveOptions
): WeaveResult {
  const amplitude = options?.amplitude ?? DEFAULT_AMPLITUDE;
  const samplesPerSegment = options?.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;

  // Stage 1: Build half-edge structure
  const mesh = HalfEdgeMesh.fromSoup(parsedMesh.vertices.length, parsedMesh.faces);

  // Stage 2: Classify edges into U/V families
  const edgeFamilies = classifyEdges(mesh);

  // Stage 3: 2-color faces
  const faceColors = colorFaces(mesh);

  // Stage 4: Trace strands
  const tracedStrands = traceStrands(mesh, edgeFamilies);

  // Stage 5-6: Generate curve geometry
  const strands: Vector3[][] = [];
  const strandFamilies: (0 | 1)[] = [];
  const strandClosed: boolean[] = [];

  for (const strand of tracedStrands) {
    const curve = generateStrandCurve(
      mesh, strand, parsedMesh.vertices,
      faceColors,
      amplitude, samplesPerSegment
    );

    strands.push(curve);
    strandFamilies.push(strand.family);
    strandClosed.push(strand.closed);
  }

  return { strands, strandFamilies, strandClosed };
}
