/**
 * Inner and outer estimates of the stable-norm unit ball.
 *
 * Left: the (a, b) chart of punctured-torus Teichmüller space (projection of the
 * Markoff cubic along the (1,1,1) axis). Hover to pick a structure.
 *
 * Right: its McShane–Rivin stable-norm ball, drawn with BOTH estimates overlaid:
 *   • inner (lower bound L_R): convex hull of the samples ±(p,q)/ℓ  — fills below V.
 *   • outer (upper bound U_R): circumscribed polygon from the exact one-sided
 *     supporting lines at each rational corner (Doan–Li–Nguyen)  — sits above V.
 * The thin shell between them is the bracket L_R ≤ V ≤ U_R; a slider sets the
 * slope cutoff R and you can watch it close.
 */

import { liftToTriple } from '../_shared/markoffChart';
import { normBallHull, normBallArea } from '../_shared/stableNorm';
import { normBallUpperPolygon, normBallUpperArea } from '../_shared/stableNormUpper';
import { HEX_SEED, SQUARE_SEED, markoffOrbit, inFundamentalDomain } from '../_shared/markoffSymmetry';
import type { TraceTriple } from '../_shared/markoff';
import type { Vec2 } from '@/math/geometry';

const R_WIN = 3;          // half-width of the (a, b) window shown
const BALL_EXTENT = 1.5;  // fixed half-window for the ball panel
let normR = 2;            // slope cutoff for both estimates (slider-controlled).
                          // The bracket closes exponentially fast, so the shell
                          // is only visible near R = 2; by R ≈ 4 it is sub-pixel.

// Palette (shared cream theme).
const BG = '#f7f5f0';
const INK = '#2c2c2c';
const TEAL = '#3e938f';    // inner estimate (lower bound)
const ORANGE = '#d9772b';  // outer estimate (upper bound)
const RED = '#cb4f4a';     // hexagonal torus copies
const BLUE = '#4c72b0';    // square torus copies
const FAINT = 'rgba(44,44,44,0.10)';

// --- Layout: two canvases side by side --------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;

const root = document.createElement('div');
root.style.cssText = 'position:fixed; inset:0; display:flex; font:13px/1.5 ui-monospace,monospace; color:' + INK;

const leftWrap = panel(
  'punctured torus Teichmüller space',
  'character variety  x² + y² + z² = xyz   projected to  x + y + z = 0',
);
const rightWrap = panel('stable-norm unit ball', 'inner & outer estimate');
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

// Right-panel key + radius slider.
const ballKey = document.createElement('div');
ballKey.style.cssText = 'position:absolute; right:12px; top:10px; font-size:11px; opacity:0.75; display:flex; flex-direction:column; gap:3px; align-items:flex-end;';
ballKey.append(
  keyRow(TEAL, 'inner estimate  L_R ≤ V'),
  keyRow(ORANGE, 'outer estimate  V ≤ U_R'),
);
rightWrap.box.appendChild(ballKey);

const ctrl = document.createElement('div');
ctrl.style.cssText =
  'position:absolute; left:12px; bottom:12px; display:flex; align-items:center; gap:8px;' +
  'background:rgba(247,245,240,0.85); padding:6px 10px; border-radius:6px; font-size:12px;';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '2'; slider.max = '24'; slider.step = '1'; slider.value = String(normR);
slider.style.cssText = 'width:140px;';
const sliderLabel = document.createElement('span');
const setSliderLabel = () => (sliderLabel.textContent = `cutoff R = ${normR}`);
setSliderLabel();
ctrl.append(sliderLabel, slider);
rightWrap.box.appendChild(ctrl);

const planeCtx = leftWrap.ctx;
const ballCtx = rightWrap.ctx;

// --- Plane ↔ pixel transforms -----------------------------------------------

function planeScale(c: HTMLCanvasElement): number {
  return Math.min(c.clientWidth, c.clientHeight) / (2 * R_WIN);
}
function pixelToAB(c: HTMLCanvasElement, px: number, py: number): Vec2 {
  const s = planeScale(c);
  return [(px - c.clientWidth / 2) / s, -(py - c.clientHeight / 2) / s];
}

// --- Special points ---------------------------------------------------------

const HEX_PTS = markoffOrbit(HEX_SEED, R_WIN);
const SQUARE_PTS = markoffOrbit(SQUARE_SEED, R_WIN);

// --- Plane drawing ----------------------------------------------------------

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
        d[i] = 217; d[i + 1] = 169; d[i + 2] = 62; d[i + 3] = 60;
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

  planeCtx.beginPath();
  planeCtx.arc(cx, cy, R_WIN * s, 0, 2 * Math.PI);
  planeCtx.fillStyle = '#ffffff';
  planeCtx.fill();

  if (domainLayer) planeCtx.drawImage(domainLayer, 0, 0, w, h);

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

  if (cursor) {
    planeCtx.strokeStyle = TEAL;
    planeCtx.lineWidth = 1.5;
    planeCtx.beginPath();
    planeCtx.arc(toX(cursor[0]), toY(cursor[1]), 5, 0, 2 * Math.PI);
    planeCtx.stroke();
  }
}

// --- Ball drawing (both estimates overlaid) ---------------------------------

function strokePath(ctx: CanvasRenderingContext2D, poly: Vec2[], toX: (x: number) => number, toY: (y: number) => number): void {
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y))));
  ctx.closePath();
}

function drawBall(triple: TraceTriple | null): void {
  const c = rightWrap.canvas;
  const w = c.clientWidth, h = c.clientHeight;
  ballCtx.clearRect(0, 0, w, h);
  if (!triple) { rightWrap.sub.textContent = 'inner & outer estimate'; return; }

  const hull = normBallHull(triple, normR);
  const outer = normBallUpperPolygon(triple, normR);
  if (hull.length < 3) { rightWrap.sub.textContent = 'inner & outer estimate'; return; }

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

  // Outer estimate: fill the whole circumscribed region orange, so the shell
  // outside the inner hull shows the bracket; then outline it.
  if (outer.length >= 3) {
    ballCtx.beginPath();
    strokePath(ballCtx, outer, toX, toY);
    ballCtx.fillStyle = 'rgba(217,119,43,0.18)';
    ballCtx.fill();
    ballCtx.strokeStyle = ORANGE;
    ballCtx.lineWidth = 1.5;
    ballCtx.stroke();
  }

  // Inner estimate: fill teal over the outer fill (so the shell stays orange).
  ballCtx.beginPath();
  strokePath(ballCtx, hull, toX, toY);
  ballCtx.fillStyle = 'rgba(62,147,143,0.55)';
  ballCtx.strokeStyle = TEAL;
  ballCtx.lineWidth = 2;
  ballCtx.fill();
  ballCtx.stroke();

  rightWrap.sub.textContent = `inner ${hull.length} verts · outer ${outer.length} verts`;
}

// --- Readout ----------------------------------------------------------------

function updateReadout(triple: TraceTriple | null, a: number, b: number): void {
  if (!triple) { readout.textContent = 'outside Teichmüller space'; return; }
  const L = normBallArea(triple, normR);
  const U = normBallUpperArea(triple, normR);
  readout.textContent =
    `plane point = ${a.toFixed(3)}, ${b.toFixed(3)}\n` +
    `traces      = ${triple.x.toFixed(3)}, ${triple.y.toFixed(3)}, ${triple.z.toFixed(3)}\n` +
    `L_R = ${L.toFixed(5)}  ≤  V  ≤  ${U.toFixed(5)} = U_R\n` +
    `bracket U_R − L_R = ${(U - L).toExponential(2)}`;
}

// --- Interaction ------------------------------------------------------------

let cursorAB: Vec2 | null = null;

function tripleAt(ab: Vec2 | null): TraceTriple | null {
  if (!ab) return null;
  return ab[0] * ab[0] + ab[1] * ab[1] <= R_WIN * R_WIN ? liftToTriple(ab[0], ab[1]) : null;
}

function render(): void {
  const triple = tripleAt(cursorAB);
  drawPlane(cursorAB);
  drawBall(triple);
  if (cursorAB) updateReadout(triple, cursorAB[0], cursorAB[1]);
  else readout.textContent = '';
}

leftWrap.canvas.addEventListener('mousemove', (e) => {
  const rect = leftWrap.canvas.getBoundingClientRect();
  cursorAB = pixelToAB(leftWrap.canvas, e.clientX - rect.left, e.clientY - rect.top);
  render();
});

leftWrap.canvas.addEventListener('mouseleave', () => {
  cursorAB = null;
  render();
});

slider.addEventListener('input', () => {
  normR = Number(slider.value);
  setSliderLabel();
  render();
});

// --- Resize -----------------------------------------------------------------

function resize(): void {
  for (const p of [leftWrap, rightWrap]) {
    const dpr = window.devicePixelRatio || 1;
    p.canvas.width = Math.round(p.canvas.clientWidth * dpr);
    p.canvas.height = Math.round(p.canvas.clientHeight * dpr);
    p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  buildDomainLayer();
  render();
}
window.addEventListener('resize', resize);
resize();

// --- Helpers ----------------------------------------------------------------

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
