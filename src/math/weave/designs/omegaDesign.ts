/**
 * Omega Design — Horseshoe arch interlocking pattern
 *
 * Each face contributes a single omega shape: a continuous path that
 * enters from one side, arches through the adjacent face, and exits from
 * the opposite side. Unlike the loop design, there is no self-crossing.
 *
 *         D (apex, +lNorm, in adjacent face)
 *        / \
 *       C   E           ← top arch (above surface)
 *        \ /
 *       B   F           ← neck (at surface)
 *        / \
 *      A'   G'          ← bottom half-arches (-lNorm, below surface)
 *      /     \
 *     A       G          ← entry/exit (boundary, zero)
 *
 * Top arch (C,D,E) extends into the adjacent face (+lNorm direction).
 * Bottom half-arches (A',G') dip toward the opposite side (-lNorm).
 * When segments stitch at a boundary, two bottom half-arches form a
 * complete bottom loop — symmetric with the top arch.
 *
 * Only traces family [0].
 */

import { Vector3 } from 'three';
import type { HalfEdgeMesh } from '../../mesh/HalfEdgeMesh';
import type { HalfEdge } from '../../mesh/types';
import type { StrandDesign, OmegaOptions, MeshAnalysis } from '../types';
import type { Strand, StrandSegment } from '../traceStrands';
import { edgeMidpoint, faceCenter, faceNormal, sampleCatmullRom } from '../helpers';

const DEFAULT_AMPLITUDE = 0.088;
const DEFAULT_SAMPLES_PER_LOOP = 32;
const DEFAULT_ARCH_HEIGHT = 1.8;

// ── Waypoint computation ──────────────────────────────────────────────

function computeOmegaWaypoints(
  mesh: HalfEdgeMesh,
  seg: StrandSegment,
  positions: Vector3[],
  archHeight: number,
  amplitude: number,
  sign: number,
): Vector3[] {
  const entry = edgeMidpoint(seg.entryEdge, positions);
  const exit = edgeMidpoint(seg.exitEdge, positions);
  const center = faceCenter(mesh, seg.face, positions);
  const normal = faceNormal(mesh, seg.face, positions);

  // Perpendicular edge (where the arch extends through)
  const sideEdge: HalfEdge = seg.entryEdge.next;
  const sideMid = edgeMidpoint(sideEdge, positions);

  // Local frame
  const horizontal = new Vector3().subVectors(exit, entry);
  const hLen = horizontal.length();
  const hNorm = new Vector3().copy(horizontal).normalize();
  const lateral = new Vector3().subVectors(sideMid, center);
  const lNorm = new Vector3().copy(lateral).normalize();
  const latLen = lateral.length();

  // Adjacent face (where the top arch extends into)
  const faceAdjacent = sideEdge.twin?.face ?? null;

  let adjacentCenter: Vector3;
  let apex: Vector3;
  let apexNormal: Vector3;

  if (faceAdjacent) {
    adjacentCenter = faceCenter(mesh, faceAdjacent, positions);
    apexNormal = faceNormal(mesh, faceAdjacent, positions);
    apex = new Vector3().lerpVectors(sideMid, adjacentCenter, archHeight);
  } else {
    adjacentCenter = new Vector3().copy(sideMid).addScaledVector(lateral, 0.6);
    apexNormal = normal;
    apex = new Vector3().copy(sideMid).addScaledVector(lateral, 1.0);
  }

  // 9 waypoints: bottom half-arch → neck → top arch → neck → bottom half-arch
  //
  // The top arch (C,D,E) extends into the adjacent face in the +lNorm direction.
  // The bottom half-arches (A',G') dip into the -lNorm side of the current face.
  // When two segments stitch together at the boundary (G→A), their bottom
  // half-arches form a complete bottom loop — symmetric with the top.
  // B and F form the neck connecting top and bottom loops.
  const waypoints = [
    new Vector3().copy(entry).addScaledVector(lNorm, -latLen * 0.6),                         // A:  entry (deepest, bottom of loop)
    new Vector3().lerpVectors(entry, center, 0.4).addScaledVector(lNorm, -latLen * 0.6),   // A': between neck and bottom
    new Vector3().copy(center).addScaledVector(hNorm, -hLen * 0.08),                        // B:  left neck
    new Vector3().copy(adjacentCenter).addScaledVector(hNorm, -hLen * 0.42),                // C:  top arch left
    apex,                                                                                   // D:  apex
    new Vector3().copy(adjacentCenter).addScaledVector(hNorm, hLen * 0.42),                 // E:  top arch right
    new Vector3().copy(center).addScaledVector(hNorm, hLen * 0.08),                         // F:  right neck
    new Vector3().lerpVectors(exit, center, 0.4).addScaledVector(lNorm, -latLen * 0.6),    // G': between neck and bottom
    new Vector3().copy(exit).addScaledVector(lNorm, -latLen * 0.6),                          // G:  exit (deepest, bottom of loop)
  ];

  // Normal displacement for linking:
  // Simple symmetric profile: below → below → below → above → above → above → below → below → below
  // All boundary/bottom/neck points are below; the top arch rises above.
  // This avoids height bumps at segment junctions (A/G match neighboring G/A).
  const localAmplitude = amplitude * hLen;
  const displacements = [-sign, -sign * 0.7, +sign, -sign * 0.5, -sign * 1.5, -sign * 0.5, +sign, -sign * 0.7, -sign];
  const normals = [normal, normal, normal, normal, apexNormal, normal, normal, normal, normal];

  return waypoints.map((p, i) => {
    const pt = p.clone();
    pt.addScaledVector(normals[i], displacements[i] * localAmplitude);
    return pt;
  });
}

// ── Design ────────────────────────────────────────────────────────────

export const omegaDesign: StrandDesign<OmegaOptions> = {
  name: 'omega',
  families: [0],

  generateStrandCurve(
    strand: Strand,
    analysis: MeshAnalysis,
    options: OmegaOptions,
  ): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerLoop = options.samplesPerLoop ?? DEFAULT_SAMPLES_PER_LOOP;
    const archHeight = options.archHeight ?? DEFAULT_ARCH_HEIGHT;
    const { mesh, positions } = analysis;

    const points: Vector3[] = [];

    for (let i = 0; i < strand.segments.length; i++) {
      const seg = strand.segments[i];
      const sign = 1; // all arches same direction for now; add faceColor alternation for interlocking later

      const wp = computeOmegaWaypoints(mesh, seg, positions, archHeight, amplitude, sign);
      const loopPoints = sampleCatmullRom(wp, samplesPerLoop, i === 0);
      points.push(...loopPoints);
    }

    return points;
  },
};
