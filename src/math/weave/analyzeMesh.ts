/**
 * analyzeMesh — Shared topology analysis pipeline
 *
 * Runs stages 1-4 of the textile pattern pipeline:
 *   1. Build half-edge structure from polygon soup
 *   2. Classify edges into U/V families
 *   3. 2-color faces (checkerboard)
 *   4. Trace strands
 *
 * The result is reusable: generate multiple designs from the same
 * analysis without recomputing topology.
 */

import { HalfEdgeMesh } from '../mesh/HalfEdgeMesh';
import type { ParsedMesh } from '../mesh/parseOBJ';
import type { MeshAnalysis } from './types';
import { classifyEdges } from './classifyEdges';
import { colorFaces } from './colorFaces';
import { traceStrands } from './traceStrands';

/**
 * Analyze a quad mesh for textile pattern generation.
 *
 * @param parsedMesh - A parsed mesh with quad faces
 * @param families - Which edge families to trace (default: [0, 1])
 * @returns MeshAnalysis object for use with StrandDesign implementations
 */
export function analyzeMesh(
  parsedMesh: ParsedMesh,
  families: (0 | 1)[] = [0, 1],
): MeshAnalysis {
  const mesh = HalfEdgeMesh.fromSoup(parsedMesh.vertices.length, parsedMesh.faces);
  const edgeFamilies = classifyEdges(mesh);
  const faceColors = colorFaces(mesh);
  const strands = traceStrands(mesh, edgeFamilies, families);

  return { mesh, positions: parsedMesh.vertices, edgeFamilies, faceColors, strands };
}
