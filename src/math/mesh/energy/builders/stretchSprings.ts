/**
 * stretchSprings — one spring per unique edge of the mesh.
 *
 * Walks `mesh.uniqueEdges()` and creates a `Spring` whose rest length is
 * the embedding's current edge length. The per-spring stiffness is
 * `density · rest` so the global elastic response is roughly invariant
 * under mesh refinement (a finer subdivision creates more, weaker springs
 * along the same arc; the bulk modulus stays put).
 */

import type { Embedding } from '../../Embedding';
import type { Spring } from '../types';

/**
 * Build stretch springs for every unique edge of `emb.mesh`.
 *
 * @param emb       the embedding (rest lengths come from current positions)
 * @param density   stiffness density — multiplied by each edge's rest length
 *                  to give the absolute spring constant
 */
export function stretchSprings(emb: Embedding, density: number): Spring[] {
  const springs: Spring[] = [];
  for (const edge of emb.mesh.uniqueEdges()) {
    const i = edge.origin.index;
    const j = edge.next.origin.index;
    const rest = emb.distance(i, j);
    springs.push({ i, j, k: density * rest, rest });
  }
  return springs;
}
