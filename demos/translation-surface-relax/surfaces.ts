/**
 * Registry of translation surfaces for the embedding/smoothing pipeline.
 * Add a surface here and it shows up in the relax + refine dropdowns; its
 * configs are keyed by name so multiple surfaces coexist.
 */

import { buildLSurface, type LSurface } from './buildLSurface';
import { buildCross } from './buildCross';

export interface SurfaceDef {
  label: string;
  build: (N: number) => LSurface;
  coarseN: number;   // per-square subdivision for the relax (embedding) stage
  fineN: number;     // per-square subdivision for the refine (smoothing) stage
}

export const SURFACES: Record<string, SurfaceDef> = {
  L: { label: 'L — 3-square translation surface', build: buildLSurface, coarseN: 10, fineN: 100 },
  // The cross has 12 squares, so a coarser per-square grid gives comparable
  // total resolution (and a much smaller eigensolve).
  cross: { label: 'cross — L-room billiard unfolding', build: buildCross, coarseN: 3, fineN: 40 },
};

/** Selected surface from `?surface=`, defaulting to L. */
export function currentSurface(): string {
  const p = new URLSearchParams(location.search).get('surface');
  return p && SURFACES[p] ? p : 'L';
}

/** Canonical config path (in the relax demo folder) for a stage + surface. */
export function configPath(stage: 'relaxed' | 'fine', surface: string): string {
  return `demos/translation-surface-relax/${stage}-config-${surface}.json`;
}

/** A dropdown that reloads with the chosen surface. */
export function surfaceDropdown(): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.style.cssText = 'font:12px ui-monospace,monospace; padding:4px 6px; border-radius:6px;';
  for (const [name, def] of Object.entries(SURFACES)) {
    const o = document.createElement('option');
    o.value = name; o.textContent = def.label;
    sel.appendChild(o);
  }
  sel.value = currentSurface();
  sel.addEventListener('change', () => {
    const u = new URL(location.href);
    u.searchParams.set('surface', sel.value);
    location.href = u.toString();
  });
  return sel;
}
