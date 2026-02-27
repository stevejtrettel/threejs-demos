/**
 * buildWeave — Convenience wrapper for the weave design
 *
 * Builds a classic over/under woven pattern from a quad mesh.
 * For advanced use (reusing analysis, custom designs), call
 * analyzeMesh() + generateStrands() directly.
 */

import type { ParsedMesh } from '../mesh/parseOBJ';
import type { WeaveOptions, WeaveResult } from './types';
import { analyzeMesh } from './analyzeMesh';
import { generateStrands } from './generateStrands';
import { weaveDesign } from './designs/weaveDesign';

export function buildWeave(
  parsedMesh: ParsedMesh,
  options?: WeaveOptions,
): WeaveResult {
  const analysis = analyzeMesh(parsedMesh, weaveDesign.families);
  return generateStrands(analysis, weaveDesign, options ?? {});
}
