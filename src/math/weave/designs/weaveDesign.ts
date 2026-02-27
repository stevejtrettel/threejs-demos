/**
 * Weave Design — Classic over/under textile pattern
 *
 * Each strand segment is a cubic Hermite curve between entry/exit edge
 * midpoints, with sin(πt) normal displacement for over/under crossings.
 * Traces both edge families [0, 1].
 */

import { Vector3 } from 'three';
import type { StrandDesign, WeaveOptions, MeshAnalysis } from '../types';
import type { Strand } from '../traceStrands';
import { edgeMidpoint, faceCenter, faceNormal, sampleHermite } from '../helpers';

const DEFAULT_AMPLITUDE = 0.05;
const DEFAULT_SAMPLES_PER_SEGMENT = 8;

export const weaveDesign: StrandDesign<WeaveOptions> = {
  name: 'weave',
  families: [0, 1],

  generateStrandCurve(
    strand: Strand,
    analysis: MeshAnalysis,
    options: WeaveOptions,
  ): Vector3[] {
    const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
    const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT;
    const { mesh, positions, faceColors } = analysis;

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

      // Sample Hermite curve
      const basePoints = sampleHermite(p0, p1, t0, t1, samplesPerSegment, isFirst);

      // Over/under sign: if faceColor == family, strand is on top (+1)
      const sign = (faceColors[seg.face.index] === strand.family) ? 1 : -1;

      // Add normal displacement with sin(πt) profile
      for (let j = 0; j < basePoints.length; j++) {
        const tParam = isFirst
          ? j / samplesPerSegment
          : (j + 1) / samplesPerSegment;
        const displacement = sign * amplitude * Math.sin(Math.PI * tParam);
        basePoints[j].addScaledVector(normal, displacement);
      }

      points.push(...basePoints);
    }

    return points;
  },
};
