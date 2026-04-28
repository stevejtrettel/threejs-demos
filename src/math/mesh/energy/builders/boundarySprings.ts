/**
 * boundarySprings — skip-one springs around the boundary loop.
 *
 * For each boundary half-edge `e = u → v`, walks the boundary loop to
 * find the next boundary half-edge `e' = v → w`, then attaches a spring
 * from `u` to `e'.next.origin` — the vertex two-steps-ahead on the
 * interior of the boundary loop. The effect is to stiffen the boundary
 * against bending at each corner.
 *
 * As with `bendSprings`, each pair appears twice (once from each direction
 * around the corner), so the effective stiffness is `2 · density · rest`.
 * Pass `density / 2` if you want the unit response.
 */

import type { Embedding } from '../../Embedding';
import type { Spring } from '../types';

export function boundarySprings(emb: Embedding, density: number): Spring[] {
  const springs: Spring[] = [];
  const mesh = emb.mesh;

  for (const e of mesh.boundaryEdges()) {
    const next = mesh.nextBoundaryEdge(e);
    const i = e.origin.index;
    const j = next.next.origin.index;
    const rest = emb.distance(i, j);
    springs.push({ i, j, k: density * rest, rest });
  }

  return springs;
}
