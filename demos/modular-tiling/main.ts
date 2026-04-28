/**
 * `PSL(2, ℤ)` — the modular tiling of `ℍ²`.
 *
 * The modular group is generated (modulo `±I`) by two elements
 *
 *   T = [[1, 1], [0, 1]]    (translation `z → z + 1`)
 *   S = [[0, −1], [1, 0]]   (inversion   `z → −1/z`)
 *
 * with relations `S² = I` and `(ST)³ = I`. The standard fundamental
 * domain is the strip
 *
 *   D = { z ∈ ℍ² : |Re z| ≤ 1/2,  |z| ≥ 1 }
 *
 * — vertical sides at `Re z = ±1/2` and a circular arc along `|z| = 1`
 * meeting them at the corners `e^{i π/3}`, `e^{i 2π/3}`. The orbit of
 * `D` under `PSL(2, ℤ)` tiles all of ℍ². This is the modular surface.
 *
 * ## Connection to elliptic curves
 *
 * Every point `τ ∈ D` is a unique representative of a complex elliptic
 * curve `ℂ / (ℤ + ℤτ)` up to isomorphism. The `j`-invariant takes the
 * same value at any two points related by a `PSL(2, ℤ)` element, so the
 * tiling here is exactly the level set picture of `j`. This is the
 * bridge to `math/lattices/`.
 *
 * Algorithm: BFS through `PSL(2, ℤ)` from the identity, applying
 * `T`, `T⁻¹`, `S` to each generated element, deduplicating up to sign
 * (since `g` and `−g` are the same in `PSL`). For each unique element
 * `g`, transform `D`'s boundary by Möbius and draw.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { mobiusSL2R, SL2R } from '@/math';
import { Matrix } from '@/math/linear-algebra';

// ── State ───────────────────────────────────────────────────────────

let maxTiles = 150;

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 1.4, 5.5);
app.controls.target.set(0, 1.4, 0);
app.controls.update();
app.controls.controls.enableRotate = false;
app.backgrounds.setColor(0xfafbfc);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.95));

const STAGE = new THREE.Group();
app.scene.add(STAGE);

// Real axis.
STAGE.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.5, 0, 0),
    new THREE.Vector3( 4.5, 0, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x222222 }),
));

// ── Fundamental domain boundary ────────────────────────────────────

const Y_TOP = 5;     // truncate the open top of D somewhere visible
const SQRT3_2 = Math.sqrt(3) / 2;

function fundamentalBoundary(N: number): [number, number][] {
  const pts: [number, number][] = [];
  // Right side: x = 1/2, top to bottom
  for (let i = 0; i <= N; i++) {
    const y = Y_TOP - (Y_TOP - SQRT3_2) * i / N;
    pts.push([0.5, y]);
  }
  // Bottom arc along unit circle, π/3 to 2π/3
  for (let i = 1; i <= N; i++) {
    const t = Math.PI / 3 + (Math.PI / 3) * i / N;
    pts.push([Math.cos(t), Math.sin(t)]);
  }
  // Left side: x = -1/2, bottom to top
  for (let i = 1; i <= N; i++) {
    const y = SQRT3_2 + (Y_TOP - SQRT3_2) * i / N;
    pts.push([-0.5, y]);
  }
  return pts;
}

const BOUNDARY_SEGMENTS = 32;
const D = fundamentalBoundary(BOUNDARY_SEGMENTS);

// ── BFS through PSL(2, ℤ) ──────────────────────────────────────────

const T    = Matrix.fromRows([[1, 1], [0, 1]]);
const Tinv = Matrix.fromRows([[1, -1], [0, 1]]);
const S    = Matrix.fromRows([[0, -1], [1, 0]]);

/**
 * Canonicalize a `g ∈ SL(2, ℤ)` to a unique PSL representative by
 * picking the sign so the lexicographically first nonzero entry is
 * positive. Round to integers so the key is exact (`PSL(2, ℤ)` is
 * discrete; entries are exact integers if we've only multiplied
 * integer matrices).
 */
function pslKey(g: Matrix): string {
  let a = Math.round(g.data[0]);
  let b = Math.round(g.data[1]);
  let c = Math.round(g.data[2]);
  let d = Math.round(g.data[3]);
  let flip = false;
  if (a < 0) flip = true;
  else if (a === 0 && b < 0) flip = true;
  else if (a === 0 && b === 0 && c < 0) flip = true;
  if (flip) { a = -a; b = -b; c = -c; d = -d; }
  return `${a},${b},${c},${d}`;
}

interface Tile {
  g: Matrix;
  depth: number;
}

function generateTiles(limit: number): Tile[] {
  const seen = new Map<string, Tile>();
  const queue: Tile[] = [];

  const I: Tile = { g: SL2R.identity(), depth: 0 };
  seen.set(pslKey(I.g), I);
  queue.push(I);

  while (queue.length > 0 && seen.size < limit) {
    const cur = queue.shift()!;
    for (const move of [T, Tinv, S]) {
      const next = cur.g.multiply(move);
      const k = pslKey(next);
      if (!seen.has(k)) {
        const t: Tile = { g: next, depth: cur.depth + 1 };
        seen.set(k, t);
        queue.push(t);
      }
    }
  }

  return Array.from(seen.values());
}

// ── Tile rendering ─────────────────────────────────────────────────

const tileGroup = new THREE.Group();
STAGE.add(tileGroup);

function clearTiles() {
  while (tileGroup.children.length > 0) {
    const c = tileGroup.children.pop()!;
    if ((c as THREE.Line).geometry) (c as THREE.Line).geometry.dispose();
  }
}

function colorForDepth(depth: number): { color: number; opacity: number } {
  if (depth === 0) return { color: 0xee7733, opacity: 1.0 };
  const t = Math.min(depth / 8, 1);
  const hue = 0.55 + 0.1 * t;          // blue → blue-green-ish
  const c = new THREE.Color().setHSL(hue, 0.45, 0.45 - 0.15 * t);
  const opacity = 0.85 - 0.45 * t;
  return { color: c.getHex(), opacity };
}

function rebuildTiles() {
  clearTiles();

  const tiles = generateTiles(maxTiles);

  // Visibility cutoff: the upper half plane region we care about.
  // We render the whole transformed boundary even if some samples
  // escape — the line just leaves the visible area.
  const Y_FLOOR = 0.005;

  for (const tile of tiles) {
    const transformed = D.map((p) => mobiusSL2R(tile.g, p));
    // Drop any sample that landed essentially on or below the boundary.
    const filtered = transformed.filter((p) => p[1] > Y_FLOOR);
    if (filtered.length < 2) continue;

    const pts = filtered.map((p) => new THREE.Vector3(p[0], p[1], 0));
    const { color, opacity } = colorForDepth(tile.depth);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    tileGroup.add(line);
  }

  readoutTileCount.textContent = String(tiles.length);
}

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:220px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <div style="font-weight:bold;">PSL(2, ℤ) modular tiling</div>
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>tiles (BFS limit)</span><span id="mt-n-v">${maxTiles}</span>
  </label>
  <input id="mt-n" type="range" min="1" max="600" step="1" value="${maxTiles}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:6px;">
    <span>tiles drawn</span><span id="mt-count">—</span>
  </div>
  <div style="font-size:10px;color:#888;margin-top:6px;line-height:1.5;">
    <span style="color:#ee7733;font-weight:bold;">orange</span> = fundamental domain D<br>
    blue tiles = images of D under PSL(2, ℤ)<br>
    generators: T = z+1, S = −1/z<br>
    color fades with BFS word length
  </div>
`;
document.body.appendChild(panel);

const readoutTileCount = panel.querySelector<HTMLSpanElement>('#mt-count')!;

const slider = panel.querySelector<HTMLInputElement>('#mt-n')!;
const valueLabel = panel.querySelector<HTMLSpanElement>('#mt-n-v')!;
slider.addEventListener('input', () => {
  maxTiles = parseInt(slider.value, 10);
  valueLabel.textContent = String(maxTiles);
  rebuildTiles();
});

// ── Boot ────────────────────────────────────────────────────────────

rebuildTiles();
app.start();
