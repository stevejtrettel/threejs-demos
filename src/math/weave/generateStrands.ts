/**
 * generateStrands — Generic strand curve generation
 *
 * Takes a MeshAnalysis and a pluggable StrandDesign, and produces
 * a WeaveResult by calling the design's generateStrandCurve for each strand.
 */

import type { Vector3 } from 'three';
import type { MeshAnalysis, StrandDesign, WeaveResult } from './types';
import { faceArea } from './helpers';

/**
 * Generate strand curves from a mesh analysis using a pluggable design.
 *
 * @param analysis - The mesh analysis from analyzeMesh()
 * @param design - A StrandDesign implementation
 * @param options - Design-specific options
 * @returns WeaveResult with strand polylines and metadata
 */
export function generateStrands<Opts>(
  analysis: MeshAnalysis,
  design: StrandDesign<Opts>,
  options: Opts,
): WeaveResult {
  const strands: Vector3[][] = [];
  const strandFamilies: (0 | 1)[] = [];
  const strandClosed: boolean[] = [];
  const strandRadii: number[][] = [];

  for (const strand of analysis.strands) {
    const points = design.generateStrandCurve(strand, analysis, options);
    strands.push(points);
    strandFamilies.push(strand.family);
    strandClosed.push(strand.closed);

    // Compute per-point radius from face areas.
    // Distribute segment areas evenly across the strand's points.
    // NOTE: assumes designs produce roughly uniform point counts per segment.
    // A custom design with variable-length segments will get approximate radii.
    const numSegments = strand.segments.length;
    const segAreas = strand.segments.map(
      (seg) => Math.sqrt(faceArea(analysis.mesh, seg.face, analysis.positions)),
    );

    const radii: number[] = [];
    const pointsPerSeg = points.length / numSegments;

    for (let s = 0; s < numSegments; s++) {
      const count = s === numSegments - 1
        ? points.length - radii.length
        : Math.round(pointsPerSeg);
      for (let j = 0; j < count; j++) radii.push(segAreas[s]);
    }

    strandRadii.push(radii);
  }

  return { strands, strandFamilies, strandClosed, strandRadii };
}
