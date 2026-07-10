/**
 * The stable-norm volume graphed over the cusp strip, far up the cusp.
 *
 * Domain: the strip a ∈ [0, A_CUT] (A_CUT = the square torus, a ≈ 0.83 — so the
 * strip just contains the fundamental domain) and b ∈ [0, B_MAX = 100], i.e. way
 * up the cusp. Height/colour = the inner-hull LOWER bound V_R(a,b). Three lower
 * bounds R ∈ {2, 4, 8} are precomputed; toggle between them. The graph climbs
 * monotonically out the cusp and never turns back — even the crude R=2 bound — so
 * V → ∞ up the cusp, which is what excludes the minimum from there.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { buildGeometry } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { marchingSquares, type ScalarGrid } from '@/math/geometry';
import { applyStage } from '../_shared/theme';
import { liftToTriple } from '../_shared/markoffChart';
import { inFundamentalDomain } from '../_shared/markoffSymmetry';
import { normBallArea } from '../_shared/stableNorm';

const A_CUT = 0.829;          // square-torus a-coordinate (strip ⊇ fundamental domain)
const B_MAX = 100;            // far up the cusp
const NA = 32, NB = 520;      // grid (a narrow, b long)
const RSET = [2, 4, 8];

// World layout: b → x (long, horizontal), V → y (up), a → z (depth).
const XS = 0.3;               // b ∈ [0,100] → x ∈ [0,30]
const ZS = 3.2;              // a ∈ [0,0.829] → z ∈ [0,~2.65]

// --- Precompute V_R(a,b) grids ----------------------------------------------

const grids = RSET.map(() => new Float64Array(NB * NA));
let VMIN = Infinity, VMAX = -Infinity;
for (let bi = 0; bi < NB; bi++) {
  const b = (B_MAX * bi) / (NB - 1);
  for (let ai = 0; ai < NA; ai++) {
    const a = (A_CUT * ai) / (NA - 1);
    const t = liftToTriple(a, b);
    for (let r = 0; r < RSET.length; r++) {
      const v = t ? normBallArea(t, RSET[r]) : NaN;
      grids[r][bi * NA + ai] = v;
      if (Number.isFinite(v)) { if (v < VMIN) VMIN = v; if (v > VMAX) VMAX = v; }
    }
  }
}
const HEIGHT = 9;
const yOf = (v: number) => ((v - VMIN) / (VMAX - VMIN)) * HEIGHT;

function gridVal(g: Float64Array, a: number, b: number): number {
  const fi = (a / A_CUT) * (NA - 1), fj = (b / B_MAX) * (NB - 1);
  const i0 = Math.min(NA - 2, Math.max(0, Math.floor(fi))), j0 = Math.min(NB - 2, Math.max(0, Math.floor(fj)));
  const tx = fi - i0, ty = fj - j0;
  const at = (i: number, j: number) => g[j * NA + i];
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) return NaN;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

// --- Colour ramp -------------------------------------------------------------

const C_LOW = new THREE.Color('#2f6f8f'), C_MID = new THREE.Color('#d9a93e'), C_HIGH = new THREE.Color('#cb4f4a');
const FD_R = 150;                        // disk cutoff for the FD test (beyond b=B_MAX)
function ramp(v: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (v - VMIN) / (VMAX - VMIN)));
  const c = new THREE.Color();
  return t < 0.5 ? c.copy(C_LOW).lerp(C_MID, t / 0.5) : c.copy(C_MID).lerp(C_HIGH, (t - 0.5) / 0.5);
}

// --- Fundamental-domain outer boundary a_max(b) (bisection, R-independent) ----

const NBND = 700;
const bndA: number[] = [];
for (let k = 0; k < NBND; k++) {
  const b = (B_MAX * k) / (NBND - 1);
  if (!inFundamentalDomain(0.0005, b, FD_R)) { bndA.push(0); continue; } // FD degenerate (b≈0)
  let lo = 0, hi = A_CUT;
  if (inFundamentalDomain(hi, b, FD_R)) { bndA.push(hi); continue; }
  for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (inFundamentalDomain(mid, b, FD_R)) lo = mid; else hi = mid; }
  bndA.push(lo);
}

// --- Build one R's surface + contours as a group ----------------------------

const domain: SurfaceDomain = { uMin: 0, uMax: A_CUT, vMin: 0, vMax: B_MAX };
function buildGroup(g: Float64Array): THREE.Group {
  const surface: Surface = {
    evaluate(a, b) {
      const v = gridVal(g, a, b);
      return Number.isFinite(v) ? new THREE.Vector3(b * XS, yOf(v), a * ZS) : new THREE.Vector3(NaN, NaN, NaN);
    },
    getDomain: () => domain,
  };
  const geo = buildGeometry(surface, { uSegments: NA - 1, vSegments: NB - 1 });
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = gridVal(g, pos.getZ(i) / ZS, pos.getX(i) / XS); // recover (a,b) from world
    const c = ramp(Number.isFinite(v) ? v : VMIN);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, side: THREE.DoubleSide })));

  // level-set contours (constant V), lifted onto the surface
  const grid: ScalarGrid = { nx: NA, ny: NB, values: Array.from(g), xMin: 0, xMax: A_CUT, yMin: 0, yMax: B_MAX };
  const pts: number[] = [];
  const LEVELS = 16;
  for (let k = 1; k <= LEVELS; k++) {
    const level = VMIN + ((VMAX - VMIN) * k) / (LEVELS + 1);
    const y = yOf(level) + 0.01;
    for (const [[ax, ay], [bx, by]] of marchingSquares(grid, level)) {
      // marchingSquares returns (x=a, y=b); map to world
      pts.push(ay * XS, y, ax * ZS, by * XS, y, bx * ZS);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.4 })));

  // FD boundary curve a = a_max(b), as a black tube riding on this R's surface
  const bp: THREE.Vector3[] = [];
  for (let k = 0; k < NBND; k++) {
    const b = (B_MAX * k) / (NBND - 1), a = bndA[k];
    const v = gridVal(g, a, b);
    if (Number.isFinite(v)) bp.push(new THREE.Vector3(b * XS, yOf(v) + 0.03, a * ZS));
  }
  if (bp.length >= 2) {
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), bp.length, 0.055, 10, false);
    group.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, metalness: 0 })));
  }
  return group;
}

// --- Scene -------------------------------------------------------------------

const app = new App({ antialias: true });
applyStage(app);
app.camera.position.set(15, 11, 26);
app.controls.target.set(B_MAX * XS * 0.5, HEIGHT * 0.45, A_CUT * ZS * 0.5);

const groups = grids.map(buildGroup);
groups.forEach((gr) => app.scene.add(gr));
let current = RSET.length - 1; // start at R=8
function show(idx: number): void { current = idx; groups.forEach((gr, i) => (gr.visible = i === idx)); updateButtons(); }

app.start();

// --- R toggle UI -------------------------------------------------------------

const bar = document.createElement('div');
bar.style.cssText = 'position:fixed; left:16px; bottom:16px; z-index:10; display:flex; gap:8px; align-items:center; font:13px ui-monospace,monospace; color:#2c2c2c;';
bar.append(document.createTextNode('lower bound:'));
const btns = RSET.map((R, i) => {
  const btn = document.createElement('button');
  btn.textContent = `R = ${R}`;
  btn.style.cssText = 'padding:5px 12px; border:1px solid rgba(0,0,0,0.2); border-radius:6px; cursor:pointer; font:13px ui-monospace;';
  btn.addEventListener('click', () => show(i));
  bar.appendChild(btn);
  return btn;
});
const note = document.createElement('div');
note.style.cssText = 'margin-left:10px; opacity:0.6;';
note.textContent = `strip a∈[0,${A_CUT}] (⊇ FD),  b∈[0,${B_MAX}] up the cusp`;
bar.appendChild(note);
document.body.appendChild(bar);
function updateButtons(): void {
  btns.forEach((b, i) => { b.style.background = i === current ? '#3e938f' : '#fff'; b.style.color = i === current ? '#fff' : '#2c2c2c'; });
}
show(current);
