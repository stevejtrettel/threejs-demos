/**
 * Stable-norm ball volume over a large patch of moduli space — the SL(2,ℤ) tiling.
 *
 * Same graph as `markoff-volume`, drawn over a much wider window of the symmetric
 * (a, b) chart. V is mapping-class-group invariant, so the landscape is periodic:
 * the hexagonal-torus wells and square-torus passes repeat across the plane, and
 * the level-set contours tile it. (Computed directly at every point — over this
 * window that is indistinguishable from folding to the fundamental domain.)
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { buildGeometry } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { marchingSquares, type ScalarGrid } from '@/math/geometry';
import { applyStage } from '../_shared/theme';
import { markoffOrbit, HEX_SEED } from '../_shared/markoffSymmetry';
import volumeData from './volumeData';

const { n: N, rWin: RW, values: VALUES } = volumeData;

let VMIN = Infinity, VMAX = -Infinity;
for (const v of VALUES) { if (v == null) continue; if (v < VMIN) VMIN = v; if (v > VMAX) VMAX = v; }

// The cell structure (wells at 0.892, passes just above) lives in a thin low band
// while the cusps run to ~2.2. So cap the top and gamma-warp into s ∈ [0, 1],
// which expands that low band. Height and colour both use s; contour levels are
// even in s (hence denser in V near the wells, where the tiling lives).
const VHI = Math.min(VMAX, 1.25);   // clamp the divergent cusps to a plateau
const GAMMA = 0.5;
const HEIGHT = 4;
const s = (v: number) => Math.pow(Math.max(0, Math.min(1, (v - VMIN) / (VHI - VMIN))), GAMMA);
const yOf = (v: number) => s(v) * HEIGHT;

// --- Bilinear sampling of the grid ------------------------------------------

function gridValue(a: number, b: number): number {
  if (a * a + b * b > RW * RW) return NaN;
  const fi = ((a + RW) / (2 * RW)) * (N - 1);
  const fj = ((b + RW) / (2 * RW)) * (N - 1);
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  if (i0 < 0 || j0 < 0 || i0 >= N - 1 || j0 >= N - 1) return NaN;
  const tx = fi - i0, ty = fj - j0;
  const at = (i: number, j: number) => { const v = VALUES[j * N + i]; return v == null ? NaN : v; };
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) return NaN;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

// --- Colour ramp -------------------------------------------------------------

const C_LOW = new THREE.Color('#2f6f8f');
const C_MID = new THREE.Color('#d9a93e');
const C_HIGH = new THREE.Color('#cb4f4a');
function ramp(v: number): THREE.Color {
  const t = s(v);
  const c = new THREE.Color();
  return t < 0.5 ? c.copy(C_LOW).lerp(C_MID, t / 0.5) : c.copy(C_MID).lerp(C_HIGH, (t - 0.5) / 0.5);
}

// --- Surface -----------------------------------------------------------------

const domain: SurfaceDomain = { uMin: -RW, uMax: RW, vMin: -RW, vMax: RW };
const surface: Surface = {
  evaluate(a, b) {
    const v = gridValue(a, b);
    return Number.isFinite(v) ? new THREE.Vector3(a, yOf(v), b) : new THREE.Vector3(NaN, NaN, NaN);
  },
  getDomain: () => domain,
};
const geo = buildGeometry(surface, { uSegments: 480, vSegments: 480 });
{
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = gridValue(pos.getX(i), pos.getZ(i));
    const c = ramp(Number.isFinite(v) ? v : VMIN);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// --- Scene -------------------------------------------------------------------

const app = new App({ antialias: true });
applyStage(app);
app.camera.position.set(24, 17, 27);
app.controls.target.set(0, 1, 0);

app.scene.add(new THREE.Mesh(
  geo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide }),
));

// Level-set contours lifted onto the surface — they tile with the symmetry.
const grid: ScalarGrid = { nx: N, ny: N, values: VALUES, xMin: -RW, xMax: RW, yMin: -RW, yMax: RW };
const LEVELS = 24;
const pts: number[] = [];
for (let k = 1; k <= LEVELS; k++) {
  const u = k / (LEVELS + 1);                              // even in warped height
  const level = VMIN + (VHI - VMIN) * Math.pow(u, 1 / GAMMA);
  const y = u * HEIGHT + 0.006;
  for (const [[ax, ay], [bx, by]] of marchingSquares(grid, level)) {
    pts.push(ax, y, ay, bx, y, by);
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
app.scene.add(new THREE.LineSegments(
  lineGeo,
  new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.45 }),
));

// A marker at each copy of the modular (hexagonal) torus — the wells of the
// landscape. Red, matching the `markoff-volume` demo.
const dotGeo = new THREE.SphereGeometry(0.1, 18, 18);
const dotMat = new THREE.MeshStandardMaterial({ color: 0xcb4f4a, roughness: 0.4, metalness: 0.0 });
for (const [a, b] of markoffOrbit(HEX_SEED, RW)) {
  const v = gridValue(a, b);
  if (!Number.isFinite(v)) continue;
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.set(a, yOf(v) + 0.05, b);
  app.scene.add(dot);
}

app.start();
