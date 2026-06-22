/**
 * exportQuadOBJ.ts
 *
 * Export a parametric `Surface` as a genuine quad-mesh OBJ file.
 *
 * Three's `OBJExporter` triangulates everything; this writer emits real
 * quad faces (`f a b c d`), which is what you want for clean subdivision /
 * editing downstream (Blender, etc.).
 *
 * The surface is sampled on a regular grid in its parameter domain. When a
 * direction is marked `closed` (e.g. both directions of a torus), the seam
 * row/column is NOT duplicated and faces wrap around mod N, so the result is
 * a watertight closed mesh with no doubled vertices along the seam.
 */

import type { Surface } from '../surfaces/types';
import { saveAs } from 'file-saver';

export interface QuadOBJOptions {
  /** Number of quads along the u direction (default: 100) */
  uSegments?: number;
  /** Number of quads along the v direction (default: 100) */
  vSegments?: number;
  /** u domain wraps (no duplicated seam, faces wrap mod N). Default: true */
  closedU?: boolean;
  /** v domain wraps (no duplicated seam, faces wrap mod N). Default: true */
  closedV?: boolean;
  /** Object name written into the `o` directive (default: 'mesh') */
  name?: string;
}

/**
 * Build quad-mesh OBJ text from a parametric surface.
 *
 * @returns OBJ file contents as a string.
 */
export function exportQuadOBJ(surface: Surface, options: QuadOBJOptions = {}): string {
  const {
    uSegments = 100,
    vSegments = 100,
    closedU = true,
    closedV = true,
    name = 'mesh',
  } = options;

  const domain = surface.getDomain();

  // Number of distinct sample points in each direction. For a closed
  // direction the last sample coincides with the first, so we drop it.
  const nu = closedU ? uSegments : uSegments + 1;
  const nv = closedV ? vSegments : vSegments + 1;

  // Number of quad rings in each direction. A closed direction has `nu`
  // points and `uSegments` (= nu) faces because the last wraps to the first;
  // an open direction has `nu = uSegments + 1` points and `uSegments` faces.
  // Either way the count is `uSegments` / `vSegments`.
  const facesU = uSegments;
  const facesV = vSegments;

  const lines: string[] = [];
  lines.push(`# Quad mesh exported from a parametric Surface`);
  lines.push(`# grid: ${nu} x ${nv} vertices, ${facesU * facesV} quads`);
  lines.push(`o ${name}`);

  // --- Vertices: row-major, j (v) outer, i (u) inner ---
  for (let j = 0; j < nv; j++) {
    const v = domain.vMin + (domain.vMax - domain.vMin) * (j / vSegments);
    for (let i = 0; i < nu; i++) {
      const u = domain.uMin + (domain.uMax - domain.uMin) * (i / uSegments);
      const p = surface.evaluate(u, v);
      lines.push(`v ${p.x} ${p.y} ${p.z}`);
    }
  }

  // --- Quad faces (1-indexed, wrapping mod nu/nv when closed) ---
  // Vertex at grid (i, j) -> index j * nu + i (0-based).
  const idx = (i: number, j: number) => j * nu + i + 1; // +1 -> OBJ 1-based

  for (let j = 0; j < facesV; j++) {
    const j1 = (j + 1) % nv;
    for (let i = 0; i < facesU; i++) {
      const i1 = (i + 1) % nu;
      const a = idx(i, j);
      const b = idx(i1, j);
      const c = idx(i1, j1);
      const d = idx(i, j1);
      lines.push(`f ${a} ${b} ${c} ${d}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Build the quad-mesh OBJ and trigger a browser download.
 */
export function downloadQuadOBJ(
  surface: Surface,
  filename = 'mesh.obj',
  options: QuadOBJOptions = {},
): void {
  const text = exportQuadOBJ(surface, { name: filename.replace(/\.obj$/, ''), ...options });
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
}
