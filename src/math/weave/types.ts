import type { Vector3 } from 'three';
import type { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { Strand } from './traceStrands';

// ── Options for built-in designs ─────────────────────────────────────

/** Options for the weave design */
export interface WeaveOptions {
  /** Normal displacement amplitude (default: 0.05) */
  amplitude?: number;
  /** Number of sample points per face segment (default: 8) */
  samplesPerSegment?: number;
}

/** Options for the loop (knit-stitch) design */
export interface LoopOptions {
  /** Normal displacement amplitude for interlocking (default: 0.15) */
  amplitude?: number;
  /** Number of sample points per loop (default: 32) */
  samplesPerLoop?: number;
  /** How far into the face above the loop reaches (default: 1.5) */
  loopHeight?: number;
}

/** Options for the omega (horseshoe arch) design */
export interface OmegaOptions {
  /** Normal displacement amplitude (default: 0.088) */
  amplitude?: number;
  /** Number of sample points per arch (default: 32) */
  samplesPerLoop?: number;
  /** How far the arch extends into the adjacent face (default: 1.8) */
  archHeight?: number;
}

// ── Pipeline types ───────────────────────────────────────────────────

/** Reusable result of mesh topology analysis (stages 1-4 of the pipeline) */
export interface MeshAnalysis {
  /** The half-edge mesh built from the parsed input */
  mesh: HalfEdgeMesh;
  /** Vertex positions from the original ParsedMesh */
  positions: Vector3[];
  /** Edge family classification (0 or 1), indexed by half-edge index */
  edgeFamilies: number[];
  /** Face 2-coloring (0 or 1), indexed by face index */
  faceColors: number[];
  /** Traced strands for each requested family */
  strands: Strand[];
}

/**
 * A pluggable strand design: the strategy for converting traced strands
 * into 3D polyline curves.
 *
 * Implementations receive one complete strand at a time and produce
 * a polyline (Vector3[]) for it. The pipeline calls this for each strand
 * and assembles the results into a WeaveResult.
 */
export interface StrandDesign<Opts = Record<string, unknown>> {
  /** Human-readable name for this design */
  readonly name: string;

  /** Which edge families this design traces (default: [0, 1]) */
  readonly families?: (0 | 1)[];

  /**
   * Generate the 3D polyline for a single strand.
   *
   * @param strand - The traced strand (segments, family, closed)
   * @param analysis - The mesh analysis (mesh, positions, faceColors, etc.)
   * @param options - Design-specific parameters
   * @returns Array of Vector3 points forming the strand polyline
   */
  generateStrandCurve(
    strand: Strand,
    analysis: MeshAnalysis,
    options: Opts,
  ): Vector3[];
}

// ── Output ───────────────────────────────────────────────────────────

/** Output of buildWeave / buildLoops / generateStrands */
export interface WeaveResult {
  /** Polyline points for each strand */
  strands: Vector3[][];
  /** Which family (0 or 1) each strand belongs to */
  strandFamilies: (0 | 1)[];
  /** Whether each strand is a closed loop */
  strandClosed: boolean[];
  /** Per-point radius scale (sqrt of face area) for each strand, if computed */
  strandRadii?: number[][];
}
