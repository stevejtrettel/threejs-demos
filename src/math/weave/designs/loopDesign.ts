/**
 * Loop Design — Knit-stitch interlocking loop pattern
 *
 * Each face contributes a single link: a continuous path that enters from
 * the left, runs rightward (entry strand), loops up and over (through the
 * face above), descends crossing over the entry strand, then exits rightward
 * (return strand).
 *
 *              D (top, in face above)
 *             / \
 *            E   C
 *           / ✕   \        ← crossing: E→F in front, A→B behind
 *  A ------B       \
 *        F----------G
 *
 * Only traces family [0].
 */

import { Vector3 } from 'three';
import type { HalfEdge } from '../../mesh/types';
import type { StrandDesign, LoopOptions, MeshAnalysis } from '../types';
import type { Strand, StrandSegment } from '../traceStrands';
import { edgeMidpoint, faceCenter, faceNormal, sampleCatmullRom } from '../helpers';
import type { HalfEdgeMesh } from '../../mesh/HalfEdgeMesh';

const DEFAULT_AMPLITUDE = 0.15;
const DEFAULT_SAMPLES_PER_LOOP = 32;
const DEFAULT_LOOP_HEIGHT = 1.5;

// ── Waypoint computation ──────────────────────────────────────────────

/**
 * Compute the 7 displaced waypoints (A–G) for a single face's loop.
 * Returns the final 3D positions with normal displacement already applied.
 */
function computeLoopWaypoints(
  mesh: HalfEdgeMesh,
  seg: StrandSegment,
  positions: Vector3[],
  loopHeight: number,
  amplitude: number,
  sign: number,
): Vector3[] {
  const entry = edgeMidpoint(seg.entryEdge, positions);
  const exit = edgeMidpoint(seg.exitEdge, positions);
  const center = faceCenter(mesh, seg.face, positions);
  const normal = faceNormal(mesh, seg.face, positions);

  const topVEdge: HalfEdge = seg.entryEdge.next;
  const topMid = edgeMidpoint(topVEdge, positions);

  // Local frame
  const horizontal = new Vector3().subVectors(exit, entry);
  const hLen = horizontal.length();
  const hNorm = new Vector3().copy(horizontal).normalize();
  const vertical = new Vector3().subVectors(topMid, center);
  const vNorm = new Vector3().copy(vertical).normalize();
  const delta = vertical.length() * 0.2;

  // Face above (via top V-edge twin)
  const faceAbove = topVEdge.twin?.face ?? null;

  let aboveCenterPos: Vector3;
  let apex: Vector3;
  let apexNormal: Vector3;

  if (faceAbove) {
    aboveCenterPos = faceCenter(mesh, faceAbove, positions);
    apexNormal = faceNormal(mesh, faceAbove, positions);
    apex = new Vector3().lerpVectors(topMid, aboveCenterPos, loopHeight);
  } else {
    aboveCenterPos = new Vector3().copy(topMid).addScaledVector(vertical, 0.6);
    apexNormal = normal;
    apex = new Vector3().copy(topMid).addScaledVector(vertical, 1.0);
  }

  // 7 waypoints (undisplaced)
  const waypoints = [
    entry,                                                                          // A
    new Vector3().copy(center).addScaledVector(hNorm, hLen * 0.15).addScaledVector(vNorm, delta),   // B
    new Vector3().copy(aboveCenterPos).addScaledVector(hNorm, hLen * 0.25),         // C
    apex,                                                                           // D
    new Vector3().copy(aboveCenterPos).addScaledVector(hNorm, hLen * -0.25),        // E
    new Vector3().copy(center).addScaledVector(hNorm, hLen * -0.1).addScaledVector(vNorm, -delta),  // F
    exit,                                                                           // G
  ];

  // Normal displacement: ascending behind, descending in front, zero at apex.
  // Scale amplitude relative to face edge length so it stays proportional.
  const localAmplitude = amplitude * hLen;
  const displacements = [0, -sign, -sign, 0, sign, +sign, 0];
  const normals = [normal, normal, normal, apexNormal, normal, normal, normal];

  // Apply displacement to get final positions
  return waypoints.map((p, i) => {
    const pt = p.clone();
    pt.addScaledVector(normals[i], displacements[i] * localAmplitude);
    return pt;
  });
}

// ── Design ────────────────────────────────────────────────────────────

export const loopDesign: StrandDesign<LoopOptions> = {
  name: 'loop',
  families: [0],

  generateStrandCurve(
    strand: Strand,
    analysis: MeshAnalysis,
    options: LoopOptions,
  ): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerLoop = options.samplesPerLoop ?? DEFAULT_SAMPLES_PER_LOOP;
    const loopHeight = options.loopHeight ?? DEFAULT_LOOP_HEIGHT;
    const { mesh, positions, faceColors } = analysis;

    const points: Vector3[] = [];

    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];
      const sign = faceColors[seg.face.index] === 0 ? 1 : -1;

      const wp = computeLoopWaypoints(mesh, seg, positions, loopHeight, amplitude, sign);
      const loopPoints = sampleCatmullRom(wp, samplesPerLoop, i === 0);
      points.push(...loopPoints);
    }

    return points;
  },
};
