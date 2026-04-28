/**
 * Hyperbolic triangle group `(p, q, r)` — reflection tiling of `ℍ²`.
 *
 * For integers `(p, q, r)` with `1/p + 1/q + 1/r < 1`, there is (up to
 * isometry) a unique hyperbolic triangle with interior angles `π/p`,
 * `π/q`, `π/r`. Its three side reflections generate an infinite
 * discrete group acting on `ℍ²`; the orbits of the triangle tile the
 * plane in the Escher "Circle Limit" sense. This demo renders that
 * tiling in the upper half plane model.
 *
 * Default: `(2, 3, 7)` — the smallest hyperbolic triangle in a precise
 * sense, and the source of the Hurwitz / Klein quartic story. Switch
 * via the dropdown.
 *
 * ## Construction
 *
 * Triangle is placed with:
 *   A = i,  side AB along the imaginary axis going up,
 *   side AC departing from A at angle π/p clockwise from AB.
 *
 * From hyperbolic law of cosines for angles, the side lengths are
 *
 *   cosh(b) = (cos π/q + cos π/p · cos π/r) / (sin π/p · sin π/r)   (= AC)
 *   cosh(c) = (cos π/r + cos π/p · cos π/q) / (sin π/p · sin π/q)   (= AB)
 *
 * giving B = (0, e^c) on the y-axis and C on the geodesic semicircle
 * out of A in the angle-π/p direction.
 *
 * The three side reflections are then closed-form anti-Möbius maps;
 * BFS through their group yields the tiling.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Matrix } from '@/math/linear-algebra';

// ── Isometry representation ────────────────────────────────────────

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
  // Canonicalize sign so M and −M produce the same key.
  let flip = false;
  if (a < -1e-9) flip = true;
  else if (Math.abs(a) < 1e-9 && b < -1e-9) flip = true;
  else if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9 && c < -1e-9) flip = true;
  if (flip) { a = -a; b = -b; c = -c; d = -d; }
  return `${a.toFixed(KEY_DECIMALS)},${b.toFixed(KEY_DECIMALS)},${c.toFixed(KEY_DECIMALS)},${d.toFixed(KEY_DECIMALS)}|${I.parity}`;
}

// ── Triangle setup for general (p, q, r) ───────────────────────────

interface Triangle {
  A: [number, number];
  B: [number, number];
  C: [number, number];
  R1: Isom;   // across side AB (imaginary axis)
  R2: Isom;   // across side BC
  R3: Isom;   // across side AC (geodesic out of A in the π/p direction)
  c3: number; r3: number;   // s3 semicircle params
  cx: number; r2: number;   // s2 semicircle params
}

function buildTriangle(p: number, q: number, r: number): Triangle {
  const ap = Math.PI / p, aq = Math.PI / q, ar = Math.PI / r;
  if (1 / p + 1 / q + 1 / r >= 1) {
    throw new Error(`(${p}, ${q}, ${r}) is not hyperbolic (1/p + 1/q + 1/r ≥ 1)`);
  }

  // Hyperbolic law of cosines for angles → side lengths.
  const cb = (Math.cos(aq) + Math.cos(ap) * Math.cos(ar)) / (Math.sin(ap) * Math.sin(ar));
  const cc = (Math.cos(ar) + Math.cos(ap) * Math.cos(aq)) / (Math.sin(ap) * Math.sin(aq));
  const sideB = Math.acosh(cb);   // = AC
  const sideC = Math.acosh(cc);   // = AB

  // Vertices
  const A: [number, number] = [0, 1];
  const B: [number, number] = [0, Math.exp(sideC)];

  // s3 (= AC): semicircle out of A at clockwise angle π/p from "up".
  // Center (cot π/p, 0), radius 1/sin π/p.
  const c3 = Math.cos(ap) / Math.sin(ap);   // cot(π/p) — handles p = 2 cleanly (= 0)
  const r3 = 1 / Math.sin(ap);

  // C on s3 at hyperbolic distance b from A.
  // Walking with arc length s along the semicircle gives
  // tan(t/2) = tan(t_A/2) · e^{−s} for "moving right" direction.
  const tA = Math.PI - ap;     // t-parameter of A on semicircle
  const tC = 2 * Math.atan(Math.tan(tA / 2) * Math.exp(-sideB));
  const C: [number, number] = [c3 + r3 * Math.cos(tC), r3 * Math.sin(tC)];

  // s2 (= BC): unique semicircle through B and C centered on the real axis.
  //   |B − (cx, 0)| = |C − (cx, 0)|  with x_B = 0.
  const cx = (C[0] * C[0] + C[1] * C[1] - B[1] * B[1]) / (2 * C[0]);
  const r2_ = Math.hypot(cx, B[1]);

  // Reflections. All in (matrix, parity = 1) form; we normalize so each
  // matrix has det = −1.
  const R1: Isom = { m: Matrix.fromRows([[-1, 0], [0, 1]]), parity: 1 };

  // R3 across s3: derivation gives [[cos π/p, sin π/p], [sin π/p, −cos π/p]].
  const R3: Isom = {
    m: Matrix.fromRows([
      [Math.cos(ap), Math.sin(ap)],
      [Math.sin(ap), -Math.cos(ap)],
    ]),
    parity: 1,
  };

  // R2 across s2 (semicircle centered at (cx, 0) radius r2_):
  //   z → cx + r²/conj(z − cx)
  // As anti-Möbius matrix on conj(z), normalized to det = −1:
  //   [[cx/r, (r² − cx²)/r], [1/r, −cx/r]]
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

  // Side AB along imaginary axis (x = 0).
  for (let i = 0; i <= N; i++) {
    const y = A[1] + (B[1] - A[1]) * i / N;
    pts.push([0, y]);
  }

  // Side BC along semicircle centered at (cx, 0).
  const tB = Math.atan2(B[1], B[0] - cx);
  const tCBC = Math.atan2(C[1], C[0] - cx);
  for (let i = 1; i <= N; i++) {
    const t = tB + (tCBC - tB) * i / N;
    pts.push([cx + r2_ * Math.cos(t), r2_ * Math.sin(t)]);
  }

  // Side CA along semicircle centered at (c3, 0).
  const tCs3 = Math.atan2(C[1], C[0] - c3);
  const tAs3 = Math.atan2(A[1], A[0] - c3);
  for (let i = 1; i <= N; i++) {
    const t = tCs3 + (tAs3 - tCs3) * i / N;
    pts.push([c3 + r3 * Math.cos(t), r3 * Math.sin(t)]);
  }

  return pts;
}

// ── Visibility cutoff (for large tilings) ──────────────────────────

const VIEWPORT = { xMin: -4, xMax: 4, yMin: 0.005, yMax: 5 };

function tileVisible(pts: [number, number][]): boolean {
  // Tile is visible if at least one boundary point lies in the viewport.
  for (const p of pts) {
    if (p[0] >= VIEWPORT.xMin && p[0] <= VIEWPORT.xMax &&
        p[1] >= VIEWPORT.yMin && p[1] <= VIEWPORT.yMax) {
      return true;
    }
  }
  return false;
}

// ── State ──────────────────────────────────────────────────────────

let triParams: [number, number, number] = [2, 3, 7];
let maxTiles = 400;

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 1.6, 5.5);
app.controls.target.set(0, 1.6, 0);
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

// ── BFS ────────────────────────────────────────────────────────────

interface Tile {
  isom: Isom;
  depth: number;
}

function generateTiles(triangle: Triangle, limit: number): Tile[] {
  const seen = new Map<string, Tile>();
  const queue: Tile[] = [];

  const init: Tile = {
    isom: { m: Matrix.identity(2), parity: 0 },
    depth: 0,
  };
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

  const boundary = buildBoundary(triangle, 24);
  const tiles = generateTiles(triangle, maxTiles);

  let drawn = 0;
  for (const tile of tiles) {
    const transformed = boundary.map((p_) => applyIsom(tile.isom, p_));
    if (!tileVisible(transformed)) continue;

    // Drop any sample that landed essentially on or below the boundary
    // (these are on the boundary geodesic of ℍ², not really "visible").
    const visible = transformed.filter((p_) => p_[1] > 0.003);
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
  readoutInfo.textContent = `(${p}, ${q}, ${r})  —  1/p + 1/q + 1/r = ${(1/p + 1/q + 1/r).toFixed(4)}`;
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
  <div style="font-weight:bold;">(p, q, r) reflection tiling</div>
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>triangle</span>
  </label>
  <select id="tt-pqr" style="font:11px monospace;padding:2px;">
    ${PRESETS.map((p, i) =>
      `<option value="${i}"${i === 0 ? ' selected' : ''}>${p.label}</option>`,
    ).join('')}
  </select>
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
    <span>tiles (BFS limit)</span><span id="tt-n-v">${maxTiles}</span>
  </label>
  <input id="tt-n" type="range" min="1" max="2000" step="1" value="${maxTiles}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:6px;">
    <span>info</span><span id="tt-info">—</span>
    <span>tiles</span><span id="tt-count">—</span>
  </div>
  <div style="font-size:10px;color:#888;margin-top:6px;line-height:1.5;">
    <span style="color:#ee7733;font-weight:bold;">orange</span>: D (the seed)<br>
    <span style="color:#3366cc;">blue</span>: orientation-preserving<br>
    <span style="color:#cc3344;">red</span>: orientation-reversing
  </div>
`;
document.body.appendChild(panel);

const readoutTileCount = panel.querySelector<HTMLSpanElement>('#tt-count')!;
const readoutInfo      = panel.querySelector<HTMLSpanElement>('#tt-info')!;

panel.querySelector<HTMLSelectElement>('#tt-pqr')!.addEventListener('change', (e) => {
  const idx = parseInt((e.target as HTMLSelectElement).value, 10);
  triParams = PRESETS[idx].pqr;
  rebuildTiles();
});

const slider = panel.querySelector<HTMLInputElement>('#tt-n')!;
const valueLabel = panel.querySelector<HTMLSpanElement>('#tt-n-v')!;
slider.addEventListener('input', () => {
  maxTiles = parseInt(slider.value, 10);
  valueLabel.textContent = String(maxTiles);
  rebuildTiles();
});

// ── Boot ────────────────────────────────────────────────────────────

rebuildTiles();
app.start();
