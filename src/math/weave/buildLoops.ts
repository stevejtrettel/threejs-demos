/**
 * buildLoops — Convenience wrapper for the loop (knit-stitch) design
 *
 * Builds an interlocking knit-stitch loop pattern from a quad mesh.
 * For advanced use (reusing analysis, custom designs), call
 * analyzeMesh() + generateStrands() directly.
 */

import type { ParsedMesh } from '../mesh/parseOBJ';
import type { LoopOptions, WeaveResult } from './types';
import { analyzeMesh } from './analyzeMesh';
import { generateStrands } from './generateStrands';
import { loopDesign } from './designs/loopDesign';

export function buildLoops(
  parsedMesh: ParsedMesh,
  options?: LoopOptions,
): WeaveResult {
  const analysis = analyzeMesh(parsedMesh, loopDesign.families);
  return generateStrands(analysis, loopDesign, options ?? {});
}
