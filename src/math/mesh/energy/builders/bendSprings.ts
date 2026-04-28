/**
 * bendSprings — across-the-fold springs for each interior shared edge.
 *
 * For every half-edge `e` whose `next` has a twin (interior shared edge),
 * connects `e.origin` to the vertex reached by `twin.next.next`. The
 * resulting spring runs across the shared edge and resists bending of
 * the surface there. Unlike a true hinge energy, this is just
 * `SpringEnergy`'s gradient — already correct.
 *
 * Behaviour by face type:
 *
 * - **Triangles**: each interior shared edge has two incident half-edges
 *   that both navigate to the *same* opposite-vertex pair. We deduplicate
 *   below (`if (i >= j) continue`) so each pair appears once, matching
 *   the convention used by `stretchSprings`.
 *
 * - **Quads**: each interior shared edge has two incident half-edges
 *   that navigate to *different* vertex pairs — one per side of the bend
 *   axis. Both pairs survive the dedup independently, so each shared
 *   edge contributes two distinct bend springs. Each spring runs roughly
 *   perpendicular to the shared edge and resists bending across it.
 *
 * - **Mixed meshes / higher-side faces**: the navigation `twin.next.next`
 *   reaches *one* vertex of the neighbor face — for n-gons (n > 4) this
 *   is asymmetric in a way that doesn't generalise cleanly. Stick to
 *   triangle and quad meshes here, or write a custom builder.
 */

import type { Embedding } from '../../Embedding';
import type { Spring } from '../types';

export function bendSprings(emb: Embedding, density: number): Spring[] {
  const springs: Spring[] = [];

  for (const e of emb.mesh.halfEdges) {
    const eNext = e.next;
    const twin = eNext.twin;
    if (twin === null) continue;

    const i = e.origin.index;
    const j = twin.next.next.origin.index;
    if (i >= j) continue;   // dedup: each unordered pair appears once

    const rest = emb.distance(i, j);
    springs.push({ i, j, k: density * rest, rest });
  }

  return springs;
}
