import type { Vector3 } from 'three';

/** Options for buildWeave */
export interface WeaveOptions {
  /** Normal displacement amplitude (default: 0.05) */
  amplitude?: number;
  /** Number of sample points per face segment (default: 8) */
  samplesPerSegment?: number;
}

/** Output of buildWeave */
export interface WeaveResult {
  /** Polyline points for each strand */
  strands: Vector3[][];
  /** Which family (0 or 1) each strand belongs to */
  strandFamilies: (0 | 1)[];
  /** Whether each strand is a closed loop */
  strandClosed: boolean[];
}
