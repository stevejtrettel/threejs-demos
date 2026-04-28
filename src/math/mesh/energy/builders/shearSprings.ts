/**
 * shearSprings — diagonal springs across each quad face.
 *
 * For every quad `(v0, v1, v2, v3)` (in CCW order), adds two springs:
 * `v0–v2` and `v1–v3`. Together with edge stretch springs these prevent
 * the mesh from collapsing into a sheared rhombus configuration that
 * preserves edge lengths.
 *
 * Only quads are processed — non-quad faces are skipped (use a triangulated
 * mesh + plain `stretchSprings` if you don't have explicit quads).
 *
 * Like `stretchSprings`, the per-spring stiffness is `density · rest` so
 * the global response stays roughly invariant under mesh refinement.
 */

import type { Embedding } from '../../Embedding';
import type { Spring } from '../types';

export function shearSprings(emb: Embedding, density: number): Spring[] {
  const springs: Spring[] = [];
  const verts: number[] = [];

  for (const face of emb.mesh.faces) {
    verts.length = 0;
    for (const v of emb.mesh.faceVertices(face)) verts.push(v.index);
    if (verts.length !== 4) continue;

    const r02 = emb.distance(verts[0], verts[2]);
    springs.push({ i: verts[0], j: verts[2], k: density * r02, rest: r02 });

    const r13 = emb.distance(verts[1], verts[3]);
    springs.push({ i: verts[1], j: verts[3], k: density * r13, rest: r13 });
  }

  return springs;
}
