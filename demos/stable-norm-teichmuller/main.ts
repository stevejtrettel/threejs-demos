/**
 * The Markoff cubic, the flat way.
 *
 * Left: the R² parameter plane that is the orthogonal complement of the (1,1,1)
 * symmetry axis of the Markoff cubic x² + y² + z² = xyz. Each point (a, b) lifts
 * to the hyperbolic structure sitting "above" it on the Teichmüller sheet; the
 * modular torus (3,3,3) is the origin, and the 3-fold trace symmetry is the
 * symmetry of the plane.
 *
 * Right: the stable-norm unit ball of that structure — conv{ ±(p,q)/ℓ } over
 * simple closed curves — drawn live as the mouse moves over the plane.
 */

import { liftToTriple } from '../_shared/markoffChart';
import { normBallHull, normBallArea } from '../_shared/stableNorm';
import { HEX_SEED, SQUARE_SEED, markoffOrbit, inFundamentalDomain } from '../_shared/markoffSymmetry';
import type { TraceTriple } from '../_shared/markoff';
import type { Vec2 } from '@/math/geometry';

const R_WIN = 3;       // half-width of the (a, b) window shown
const NORM_R = 24;     // slope cutoff for the inner-estimate ball
const BALL_EXTENT = 1.5; // fixed half-window for the ball panel — so size is comparable across the domain

// Palette (shared cream theme, inlined so this demo stays THREE-free).
const BG = '#f7f5f0';
const INK = '#2c2c2c';
const TEAL = '#3e938f';
const RED = '#cb4f4a';   // hexagonal torus copies
const BLUE = '#4c72b0';  // square torus copies
const FAINT = 'rgba(44,44,44,0.10)';

// --- Layout: two canvases side by side ---------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;

const root = document.createElement('div');
root.style.cssText = 'position:fixed; inset:0; display:flex; font:13px/1.5 ui-monospace,monospace; color:' + INK;

const leftWrap = panel(
  'punctured torus Teichmüller space',
  'character variety  x² + y² + z² = xyz   projected to  x + y + z = 0',
);
const rightWrap = panel('stable-norm unit ball', 'inner estimate');
leftWrap.box.style.borderRight = '1px solid rgba(0,0,0,0.12)';
root.append(leftWrap.box, rightWrap.box);
document.body.appendChild(root);

// Key, under the character-variety line.
const key = document.createElement('div');
key.style.cssText = 'margin-top:8px; font-size:11px; opacity:0.7; display:flex; flex-direction:column; gap:3px;';
const keyRow = (color: string, text: string) => {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; align-items:center; gap:6px;';
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block; width:9px; height:9px; border-radius:50%; background:${color};`;
  const tx = document.createElement('span');
  tx.textContent = text;
  row.append(dot, tx);
  return row;
};
key.append(
  keyRow(RED, 'hexagonal torus  (3, 3, 3)'),
  keyRow(BLUE, 'square torus  (2√2, 2√2, 4)'),
  keyRow('#d9a93e', 'SL(2,ℤ) fundamental domain'),
);
leftWrap.title.appendChild(key);

const readout = document.createElement('div');
readout.style.cssText =
  'position:absolute; left:12px; bottom:12px; white-space:pre; opacity:0.85;' +
  'background:rgba(247,245,240,0.85); padding:6px 8px; border-radius:6px;';
leftWrap.box.appendChild(readout);

const planeCtx = leftWrap.ctx;
const ballCtx = rightWrap.ctx;

// --- Plane ↔ pixel transforms ------------------------------------------------

// Square fit of (a, b) ∈ [-R_WIN, R_WIN] centred in the canvas.
function planeScale(c: HTMLCanvasElement): number {
  return Math.min(c.clientWidth, c.clientHeight) / (2 * R_WIN);
}
function pixelToAB(c: HTMLCanvasElement, px: number, py: number): Vec2 {
  const s = planeScale(c);
  return [(px - c.clientWidth / 2) / s, -(py - c.clientHeight / 2) / s];
}

// --- Special points: copies of the hexagonal / square tori in the window -----

const HEX_PTS = markoffOrbit(HEX_SEED, R_WIN);
const SQUARE_PTS = markoffOrbit(SQUARE_SEED, R_WIN);

// --- Drawing -----------------------------------------------------------------

// The fundamental domain is a fixed region, so rasterize it once (per resize)
// into an offscreen layer and blit it, rather than per-pixel-testing each frame.
let domainLayer: HTMLCanvasElement | null = null;
function buildDomainLayer(): void {
  const c = leftWrap.canvas;
  const w = c.clientWidth, h = c.clientHeight;
  if (w === 0 || h === 0) return;
  const s = planeScale(c), cx = w / 2, cy = h / 2;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d')!;
  const img = octx.createImageData(w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (inFundamentalDomain((px - cx) / s, -(py - cy) / s, R_WIN)) {
        const i = (py * w + px) * 4;
        d[i] = 217; d[i + 1] = 169; d[i + 2] = 62; d[i + 3] = 60; // warm gold tint
      }
    }
  }
  octx.putImageData(img, 0, 0);
  domainLayer = off;
}

function drawPlane(cursor: Vec2 | null): void {
  const c = leftWrap.canvas;
  const w = c.clientWidth, h = c.clientHeight;
  const s = planeScale(c);
  const cx = w / 2, cy = h / 2;
  const toX = (a: number) => cx + a * s;
  const toY = (b: number) => cy - b * s;

  planeCtx.clearRect(0, 0, w, h);

  // The window disk.
  planeCtx.beginPath();
  planeCtx.arc(cx, cy, R_WIN * s, 0, 2 * Math.PI);
  planeCtx.fillStyle = '#ffffff';
  planeCtx.fill();

  // The fundamental domain (precomputed tint).
  if (domainLayer) planeCtx.drawImage(domainLayer, 0, 0, w, h);

  // The three mirror lines of the trace symmetry (x=y and its 120° rotates).
  planeCtx.strokeStyle = FAINT;
  planeCtx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const th = Math.PI / 2 + (k * 2 * Math.PI) / 3;
    const dx = Math.cos(th) * R_WIN * s, dy = Math.sin(th) * R_WIN * s;
    planeCtx.beginPath();
    planeCtx.moveTo(cx - dx, cy + dy);
    planeCtx.lineTo(cx + dx, cy - dy);
    planeCtx.stroke();
  }

  // Hexagonal (red) and square (blue) torus copies.
  const dots = (pts: Vec2[], color: string) => {
    planeCtx.fillStyle = color;
    for (const [a, b] of pts) {
      planeCtx.beginPath();
      planeCtx.arc(toX(a), toY(b), 4, 0, 2 * Math.PI);
      planeCtx.fill();
    }
  };
  dots(HEX_PTS, RED);
  dots(SQUARE_PTS, BLUE);

  // Cursor.
  if (cursor) {
    planeCtx.strokeStyle = TEAL;
    planeCtx.lineWidth = 1.5;
    planeCtx.beginPath();
    planeCtx.arc(toX(cursor[0]), toY(cursor[1]), 5, 0, 2 * Math.PI);
    planeCtx.stroke();
  }
}

function drawBall(triple: TraceTriple | null): void {
  const c = rightWrap.canvas;
  const w = c.clientWidth, h = c.clientHeight;
  ballCtx.clearRect(0, 0, w, h);
  if (!triple) { rightWrap.sub.textContent = 'inner estimate'; return; }

  const hull = normBallHull(triple, NORM_R);
  if (hull.length < 3) { rightWrap.sub.textContent = 'inner estimate'; return; }
  rightWrap.sub.textContent = `inner estimate · ${hull.length} vertices`;

  // Fixed scale (NOT fit-to-ball): the ball grows and shrinks with the structure.
  const pad = 0.12 * Math.min(w, h);
  const s = (Math.min(w, h) / 2 - pad) / BALL_EXTENT;
  const cx = w / 2, cy = h / 2;
  const toX = (x: number) => cx + x * s;
  const toY = (y: number) => cy - y * s;

  // Axes.
  ballCtx.strokeStyle = FAINT;
  ballCtx.lineWidth = 1;
  ballCtx.beginPath();
  ballCtx.moveTo(pad, cy); ballCtx.lineTo(w - pad, cy);
  ballCtx.moveTo(cx, pad); ballCtx.lineTo(cx, h - pad);
  ballCtx.stroke();

  // The ball.
  ballCtx.beginPath();
  hull.forEach(([x, y], i) => (i ? ballCtx.lineTo(toX(x), toY(y)) : ballCtx.moveTo(toX(x), toY(y))));
  ballCtx.closePath();
  ballCtx.fillStyle = 'rgba(62,147,143,0.20)';
  ballCtx.strokeStyle = TEAL;
  ballCtx.lineWidth = 2;
  ballCtx.fill();
  ballCtx.stroke();
}

// --- Interaction -------------------------------------------------------------

let cursorAB: Vec2 | null = null;

leftWrap.canvas.addEventListener('mousemove', (e) => {
  const rect = leftWrap.canvas.getBoundingClientRect();
  const [a, b] = pixelToAB(leftWrap.canvas, e.clientX - rect.left, e.clientY - rect.top);
  cursorAB = [a, b];
  const triple = a * a + b * b <= R_WIN * R_WIN ? liftToTriple(a, b) : null;

  drawPlane(cursorAB);
  drawBall(triple);
  readout.textContent = triple
    ? `plane point = ${a.toFixed(3)}, ${b.toFixed(3)}\n` +
      `traces      = ${triple.x.toFixed(3)}, ${triple.y.toFixed(3)}, ${triple.z.toFixed(3)}\n` +
      `volume      = ${normBallArea(triple, NORM_R).toFixed(3)}`
    : 'outside Teichmüller space';
});

leftWrap.canvas.addEventListener('mouseleave', () => {
  cursorAB = null;
  drawPlane(null);
  drawBall(null);
  readout.textContent = '';
});

// --- Resize ------------------------------------------------------------------

function resize(): void {
  for (const p of [leftWrap, rightWrap]) {
    const dpr = window.devicePixelRatio || 1;
    p.canvas.width = Math.round(p.canvas.clientWidth * dpr);
    p.canvas.height = Math.round(p.canvas.clientHeight * dpr);
    p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  buildDomainLayer();
  drawPlane(cursorAB);
  drawBall(cursorAB && cursorAB[0] * cursorAB[0] + cursorAB[1] * cursorAB[1] <= R_WIN * R_WIN
    ? liftToTriple(cursorAB[0], cursorAB[1])
    : null);
}
window.addEventListener('resize', resize);
resize();

// --- Helpers -----------------------------------------------------------------

function panel(label: string, sub = '') {
  const box = document.createElement('div');
  box.style.cssText = 'position:relative; flex:1 1 0; min-width:0;';
  const title = document.createElement('div');
  title.style.cssText = 'position:absolute; left:12px; top:10px; pointer-events:none;';
  const main = document.createElement('div');
  main.textContent = label;
  main.style.cssText = 'opacity:0.6;';
  const subEl = document.createElement('div');
  subEl.textContent = sub;
  subEl.style.cssText = 'font-size:11px; opacity:0.45; margin-top:3px;';
  title.append(main, subEl);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%; height:100%;';
  box.append(canvas, title);
  return { box, canvas, ctx: canvas.getContext('2d')!, title, sub: subEl };
}
