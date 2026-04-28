/**
 * Hyperbolic triangle group `(p, q, r)` rendered in the **Poincaré disk**.
 *
 * Same math as `triangle-tiling`: build the fundamental hyperbolic
 * triangle in the upper half plane, generate the reflection group's
 * orbit by BFS, transform each tile's boundary. The only difference is
 * that here we project each point through the **Cayley map** to land in
 * the unit disk before rendering.
 *
 * ## Cayley map
 *
 *   ψ(z) = (i z + 1) / (z + i)
 *
 * (the standard `(z − i)/(z + i)`, post-composed with multiplication by
 * `i` so that "north" in ℍ² maps to "north" in 𝔻 — purely cosmetic).
 *
 * In coordinates:
 *
 *   ψ(x + iy) = ( 2x,  x² + y² − 1 ) / (x² + (y + 1)²).
 *
 * Properties:
 *   - i ↦ 0           (basepoint of ℍ² → center of disk)
 *   - ℝ ↦ unit circle (boundary ↔ boundary)
 *   - ∞ ↦ -i          (specifically the south point of the disk in this rotated convention)
 *
 * Geodesics in the disk are circular arcs perpendicular to the boundary
 * unit circle, plus diameters (the ones passing through the center).
 *
 * ## Group-theory note
 *
 * The Cayley map conjugates `PSL(2, ℝ)` to `PSU(1, 1)`. We could have
 * implemented `SU(1, 1)` as a separate Lie group acting natively on the
 * disk. Mathematically equivalent; chose the conversion-at-render
 * approach to keep the library small. If a future demo really wants
 * native-disk arithmetic, `SU(1, 1)` is a 1-session addition.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Matrix } from '@/math/linear-algebra';

// ── Cayley map ─────────────────────────────────────────────────────

function cayleyToDisk(z: [number, number]): [number, number] {
  const [x, y] = z;
  const denom = x * x + (y + 1) * (y + 1);
  return [
    2 * x / denom,
    (x * x + y * y - 1) / denom,
  ];
}

// ── Isometry representation (anti-Möbius reflections + their products) ─

interface Isom {
  m: Matrix;
  parity: 0 | 1;
}

function applyIsom(I: Isom, z: [number, number]): [number, number] {
  const [zr, zi] = z;
  const wr = zr;
  const wi = I.parity === 1 ? -zi : zi;
  const a = I.m.data[0], b = I.m.data[1], c = I.m.data[2], d = I.m.data[3];
  const numR = a * wr + b;
  const numI = a * wi;
  const denR = c * wr + d;
  const denI = c * wi;
  const den2 = denR * denR + denI * denI;
  return [
    (numR * denR + numI * denI) / den2,
    (numI * denR - numR * denI) / den2,
  ];
}

function composeIsom(I1: Isom, I2: Isom): Isom {
  return {
    m: I1.m.multiply(I2.m),
    parity: ((I1.parity ^ I2.parity) as 0 | 1),
  };
}

const KEY_DECIMALS = 5;
function isomKey(I: Isom): string {
  let a = I.m.data[0], b = I.m.data[1], c = I.m.data[2], d = I.m.data[3];
  let flip = false;
  if (a < -1e-9) flip = true;
  else if (Math.abs(a) < 1e-9 && b < -1e-9) flip = true;
  else if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9 && c < -1e-9) flip = true;
  if (flip) { a = -a; b = -b; c = -c; d = -d; }
  return `${a.toFixed(KEY_DECIMALS)},${b.toFixed(KEY_DECIMALS)},${c.toFixed(KEY_DECIMALS)},${d.toFixed(KEY_DECIMALS)}|${I.parity}`;
}

// ── (p, q, r) triangle setup (same as triangle-tiling demo) ────────

interface Triangle {
  A: [number, number];
  B: [number, number];
  C: [number, number];
  R1: Isom; R2: Isom; R3: Isom;
  c3: number; r3: number;
  cx: number; r2: number;
}

function buildTriangle(p: number, q: number, r: number): Triangle {
  const ap = Math.PI / p, aq = Math.PI / q, ar = Math.PI / r;
  if (1 / p + 1 / q + 1 / r >= 1) {
    throw new Error(`(${p}, ${q}, ${r}) is not hyperbolic`);
  }
  const cb = (Math.cos(aq) + Math.cos(ap) * Math.cos(ar)) / (Math.sin(ap) * Math.sin(ar));
  const cc = (Math.cos(ar) + Math.cos(ap) * Math.cos(aq)) / (Math.sin(ap) * Math.sin(aq));
  const sideB = Math.acosh(cb);
  const sideC = Math.acosh(cc);

  const A: [number, number] = [0, 1];
  const B: [number, number] = [0, Math.exp(sideC)];
  const c3 = Math.cos(ap) / Math.sin(ap);
  const r3 = 1 / Math.sin(ap);
  const tA = Math.PI - ap;
  const tC = 2 * Math.atan(Math.tan(tA / 2) * Math.exp(-sideB));
  const C: [number, number] = [c3 + r3 * Math.cos(tC), r3 * Math.sin(tC)];

  const cx = (C[0] * C[0] + C[1] * C[1] - B[1] * B[1]) / (2 * C[0]);
  const r2_ = Math.hypot(cx, B[1]);

  const R1: Isom = { m: Matrix.fromRows([[-1, 0], [0, 1]]), parity: 1 };
  const R3: Isom = {
    m: Matrix.fromRows([
      [Math.cos(ap), Math.sin(ap)],
      [Math.sin(ap), -Math.cos(ap)],
    ]),
    parity: 1,
  };
  const R2: Isom = {
    m: Matrix.fromRows([
      [cx / r2_, (r2_ * r2_ - cx * cx) / r2_],
      [1 / r2_, -cx / r2_],
    ]),
    parity: 1,
  };

  return { A, B, C, R1, R2, R3, c3, r3, cx, r2: r2_ };
}

function buildBoundary(tri: Triangle, N: number): [number, number][] {
  const pts: [number, number][] = [];
  const { A, B, C, c3, r3, cx, r2: r2_ } = tri;

  for (let i = 0; i <= N; i++) {
    const y = A[1] + (B[1] - A[1]) * i / N;
    pts.push([0, y]);
  }
  const tB = Math.atan2(B[1], B[0] - cx);
  const tCBC = Math.atan2(C[1], C[0] - cx);
  for (let i = 1; i <= N; i++) {
    const t = tB + (tCBC - tB) * i / N;
    pts.push([cx + r2_ * Math.cos(t), r2_ * Math.sin(t)]);
  }
  const tCs3 = Math.atan2(C[1], C[0] - c3);
  const tAs3 = Math.atan2(A[1], A[0] - c3);
  for (let i = 1; i <= N; i++) {
    const t = tCs3 + (tAs3 - tCs3) * i / N;
    pts.push([c3 + r3 * Math.cos(t), r3 * Math.sin(t)]);
  }
  return pts;
}

// ── State ──────────────────────────────────────────────────────────

let triParams: [number, number, number] = [2, 3, 7];
let maxTiles = 600;

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 3.2);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.controls.controls.enableRotate = false;
app.backgrounds.setColor(0xfafbfc);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.95));

const STAGE = new THREE.Group();
app.scene.add(STAGE);

// Disk boundary — drawn as a clear circle.
{
  const N = 256;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
  }
  STAGE.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x222222 }),
  ));
}

const tileGroup = new THREE.Group();
STAGE.add(tileGroup);

function clearTiles() {
  while (tileGroup.children.length > 0) {
    const c = tileGroup.children.pop()!;
    if ((c as THREE.Line).geometry) (c as THREE.Line).geometry.dispose();
  }
}

function colorForTile(depth: number, parity: 0 | 1): { color: number; opacity: number } {
  if (depth === 0) return { color: 0xee7733, opacity: 1.0 };
  const t = Math.min(depth / 12, 1);
  const opacity = 0.85 - 0.4 * t;
  const baseHue = parity === 0 ? 0.55 : 0.0;
  const c = new THREE.Color().setHSL(baseHue, 0.5, 0.5 - 0.15 * t);
  return { color: c.getHex(), opacity };
}

// Visibility cutoff in disk coords: keep tiles touching the unit disk.
const VIS_RADIUS = 0.999;

function tileVisibleInDisk(diskPts: [number, number][]): boolean {
  for (const p of diskPts) {
    if (p[0] * p[0] + p[1] * p[1] <= VIS_RADIUS * VIS_RADIUS) return true;
  }
  return false;
}

// ── BFS through reflection group ───────────────────────────────────

interface Tile { isom: Isom; depth: number; }

function generateTiles(triangle: Triangle, limit: number): Tile[] {
  const seen = new Map<string, Tile>();
  const queue: Tile[] = [];

  const init: Tile = { isom: { m: Matrix.identity(2), parity: 0 }, depth: 0 };
  seen.set(isomKey(init.isom), init);
  queue.push(init);

  while (queue.length > 0 && seen.size < limit) {
    const cur = queue.shift()!;
    for (const refl of [triangle.R1, triangle.R2, triangle.R3]) {
      const next: Tile = {
        isom: composeIsom(cur.isom, refl),
        depth: cur.depth + 1,
      };
      const k = isomKey(next.isom);
      if (!seen.has(k)) {
        seen.set(k, next);
        queue.push(next);
      }
    }
  }
  return Array.from(seen.values());
}

// ── Render ─────────────────────────────────────────────────────────

function rebuildTiles() {
  clearTiles();

  const [p, q, r] = triParams;
  let triangle: Triangle;
  try {
    triangle = buildTriangle(p, q, r);
  } catch (e) {
    readoutInfo.textContent = (e as Error).message;
    return;
  }

  const boundaryHP = buildBoundary(triangle, 24);
  const tiles = generateTiles(triangle, maxTiles);

  let drawn = 0;
  for (const tile of tiles) {
    // Apply group element in upper-half-plane coords, then Cayley to disk.
    const transformedHP = boundaryHP.map((p_) => applyIsom(tile.isom, p_));
    const transformedDisk = transformedHP.map(cayleyToDisk);
    if (!tileVisibleInDisk(transformedDisk)) continue;

    const visible = transformedDisk.filter((p_) => p_[0] * p_[0] + p_[1] * p_[1] < 1.001);
    if (visible.length < 2) continue;

    const pts = visible.map((p_) => new THREE.Vector3(p_[0], p_[1], 0));
    const { color, opacity } = colorForTile(tile.depth, tile.isom.parity);
    tileGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    ));
    drawn++;
  }

  readoutTileCount.textContent = `${drawn} drawn / ${tiles.length} generated`;
  readoutInfo.textContent = `(${p}, ${q}, ${r})  —  Σ 1/k = ${(1/p + 1/q + 1/r).toFixed(4)}`;
}

// ── UI ──────────────────────────────────────────────────────────────

const PRESETS: Array<{ label: string; pqr: [number, number, number] }> = [
  { label: '(2, 3, 7)  — Hurwitz', pqr: [2, 3, 7] },
  { label: '(2, 3, 8)',           pqr: [2, 3, 8] },
  { label: '(2, 3, 13)',          pqr: [2, 3, 13] },
  { label: '(2, 4, 5)',           pqr: [2, 4, 5] },
  { label: '(2, 4, 7)',           pqr: [2, 4, 7] },
  { label: '(2, 5, 5)',           pqr: [2, 5, 5] },
  { label: '(3, 3, 4)',           pqr: [3, 3, 4] },
  { label: '(3, 3, 7)',           pqr: [3, 3, 7] },
  { label: '(2, 3, 100) ≈ (2,3,∞)', pqr: [2, 3, 100] },
];

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:240px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <div style="font-weight:bold;">(p, q, r) — Poincaré disk</div>
  <select id="pd-pqr" style="font:11px monospace;padding:2px;">
    ${PRESETS.map((p, i) =>
      `<option value="${i}"${i === 0 ? ' selected' : ''}>${p.label}</option>`,
    ).join('')}
  </select>
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
    <span>tiles (BFS limit)</span><span id="pd-n-v">${maxTiles}</span>
  </label>
  <input id="pd-n" type="range" min="1" max="3000" step="1" value="${maxTiles}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:6px;">
    <span>info</span><span id="pd-info">—</span>
    <span>tiles</span><span id="pd-count">—</span>
  </div>
  <div style="font-size:10px;color:#888;margin-top:6px;line-height:1.5;">
    <span style="color:#ee7733;font-weight:bold;">orange</span>: D (the seed)<br>
    <span style="color:#3366cc;">blue</span>: orientation-preserving<br>
    <span style="color:#cc3344;">red</span>: orientation-reversing<br>
    rendered via Cayley map ψ(z) = (iz+1)/(z+i)
  </div>
`;
document.body.appendChild(panel);

const readoutTileCount = panel.querySelector<HTMLSpanElement>('#pd-count')!;
const readoutInfo      = panel.querySelector<HTMLSpanElement>('#pd-info')!;

panel.querySelector<HTMLSelectElement>('#pd-pqr')!.addEventListener('change', (e) => {
  const idx = parseInt((e.target as HTMLSelectElement).value, 10);
  triParams = PRESETS[idx].pqr;
  rebuildTiles();
});

const slider = panel.querySelector<HTMLInputElement>('#pd-n')!;
const valueLabel = panel.querySelector<HTMLSpanElement>('#pd-n-v')!;
slider.addEventListener('input', () => {
  maxTiles = parseInt(slider.value, 10);
  valueLabel.textContent = String(maxTiles);
  rebuildTiles();
});

// ── Boot ────────────────────────────────────────────────────────────

rebuildTiles();
app.start();
