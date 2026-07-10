/**
 * The area-contraction ratio q — the lemma the rigorous-numerics proof rests on.
 *
 * Left: ONE fundamental domain of moduli space — the modular triangle, with
 * corners at the hexagonal torus (minimum), the square torus (saddle), and the
 * cusp — colored by sup q, the Farey-tree area-contraction ratio. q < 1 means the
 * bulge tail V − V_R is a convergent geometric series; q only approaches 1 toward
 * the cusp (sized away by a horoball). Right: for the hovered structure, the
 * stable-norm ball with its Farey subdivision, each triangle tinted by its q.
 */

import { liftToTriple } from '../_shared/markoffChart';
import { inFundamentalDomain } from '../_shared/markoffSymmetry';
import { normBallHull } from '../_shared/stableNorm';
import { supQ, collectTriangles, qByDepth } from './contraction';
import type { TraceTriple } from '../_shared/markoff';
import type { Vec2 } from '@/math/geometry';

// The fundamental domain is a thin sliver in (a,b); rotate the plane by −60° so
// its bisector points right and it reads as a landscape wedge — hexagonal apex at
// the left, opening rightward toward the cusp. C, S = cos/sin of the rotation.
const C = 0.5, S = Math.sqrt(3) / 2;
const U_LO = -0.4, U_HI = 4.6, V_LO = -1.3, V_HI = 2.9; // display-frame (rotated coords)
const FD_R = 30;          // disk radius for the inFundamentalDomain test (beyond the panel)
const GRID = 160;         // heatmap grid resolution
const GRID_DEPTH = 13;    // Farey depth for the heatmap
const HOROBALL = 2.1;     // exclude systole trace below this (the cusp) from "sup_K q"
const SADDLE_GAP = 0.0027; // V(square) − V(hex), the separation the bracket must beat

const BG = '#f7f5f0', INK = '#2c2c2c';

// Corners of the fundamental domain, in (a, b).
const HEX: Vec2 = [0, 0];
const SQUARE: Vec2 = [0.829, 0.479];

// q → colour: 0 blue · 0.5 gold · 1 red · >1 magenta alarm.
function qColor(q: number): [number, number, number] {
  if (!Number.isFinite(q)) return [220, 220, 216];
  if (q >= 1) { const u = Math.min(1, q - 1); return [150 + 50 * u, 20, 90 + 40 * u]; }
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  if (q < 0.5) { const t = q / 0.5; return [lerp(47, 217, t), lerp(111, 169, t), lerp(143, 62, t)]; }
  const t = (q - 0.5) / 0.5; return [lerp(217, 203, t), lerp(169, 79, t), lerp(62, 74, t)];
}
const qCss = (q: number) => { const [r, g, b] = qColor(q); return `rgb(${r | 0},${g | 0},${b | 0})`; };

// --- Layout ------------------------------------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;
const root = document.createElement('div');
root.style.cssText = 'position:fixed; inset:0; display:flex; font:13px/1.5 ui-monospace,monospace; color:' + INK;
const left = panel('one fundamental domain of moduli space', 'the modular triangle (hexagonal · square · cusp), colored by contraction ratio q');
const right = panel('stable-norm ball — Farey subdivision', 'each triangle tinted by its q = (child area)/(parent area)');
left.box.style.borderRight = '1px solid rgba(0,0,0,0.12)';
root.append(left.box, right.box);
document.body.appendChild(root);

const readout = document.createElement('div');
readout.style.cssText =
  'position:absolute; left:12px; bottom:12px; white-space:pre; z-index:5;' +
  'background:rgba(247,245,240,0.9); padding:8px 10px; border-radius:6px; box-shadow:0 1px 6px rgba(0,0,0,0.08);';
left.box.appendChild(readout);
readout.textContent = 'computing q over the fundamental domain…';

// --- Shared coordinate transform (image AND cursor use the SAME mapping) ------

interface Frame { s: number; ox: number; oy: number; }
function frameOf(c: HTMLCanvasElement): Frame {
  const w = c.clientWidth, h = c.clientHeight;
  const s = Math.min(w / (U_HI - U_LO), h / (V_HI - V_LO)); // fit, preserve aspect
  return { s, ox: (w - s * (U_HI - U_LO)) / 2, oy: (h - s * (V_HI - V_LO)) / 2 };
}
const toDisp = (a: number, b: number): Vec2 => [C * a + S * b, -S * a + C * b];        // rotate −60°
const dispToWorld = (u: number, v: number): Vec2 => [C * u - S * v, S * u + C * v];     // rotate +60°
const toScreen = (a: number, b: number, F: Frame): [number, number] => {
  const [u, v] = toDisp(a, b);
  return [F.ox + (u - U_LO) * F.s, F.oy + (V_HI - v) * F.s];
};
const toWorld = (x: number, y: number, F: Frame): Vec2 =>
  dispToWorld(U_LO + (x - F.ox) / F.s, V_HI - (y - F.oy) / F.s);

// --- Heatmap precompute (only the fundamental domain) ------------------------

let heatmap: HTMLCanvasElement | null = null;
let cursor: Vec2 | null = null;
let feasibility = '';

function compute(): void {
  const off = document.createElement('canvas'); off.width = GRID; off.height = GRID;
  const octx = off.getContext('2d')!;
  const img = octx.createImageData(GRID, GRID);
  let supAll = 0, supK = 0, argK: TraceTriple | null = null;

  for (let j = 0; j < GRID; j++) {
    const v = V_HI - (V_HI - V_LO) * (j / (GRID - 1)); // row 0 = top
    for (let i = 0; i < GRID; i++) {
      const u = U_LO + (U_HI - U_LO) * (i / (GRID - 1));
      const [a, b] = dispToWorld(u, v);
      if (!inFundamentalDomain(a, b, FD_R)) continue; // leave transparent → cream shows
      const t = liftToTriple(a, b);
      if (!t) continue;
      const q = supQ(t, GRID_DEPTH);
      const [r, g, bl] = qColor(q);
      const idx = (j * GRID + i) * 4;
      img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = bl; img.data[idx + 3] = 255;
      supAll = Math.max(supAll, q);
      if (Math.min(t.x, t.y, t.z) >= HOROBALL && q > supK) { supK = q; argK = t; }
    }
  }
  octx.putImageData(img, 0, 0);
  heatmap = off;

  const levels = Math.ceil(Math.log(SADDLE_GAP / 0.13) / Math.log(supK));
  feasibility =
    `sup q over K (systole trace ≥ ${HOROBALL.toFixed(1)}):  ${supK.toFixed(3)}   ${supK < 1 ? '✓ < 1' : '✗ ≥ 1'}\n` +
    `  worst at traces (${argK ? [argK.x, argK.y, argK.z].map((v) => v.toFixed(2)).join(', ') : '—'})\n` +
    `sup q over the whole domain (incl. cusp approach):  ${supAll.toFixed(3)}\n` +
    `⇒ geometric tail rate q* ≈ ${supK.toFixed(3)};  ~${levels} Farey levels to bracket below the ${SADDLE_GAP} saddle gap`;
  draw();
}
requestAnimationFrame(() => setTimeout(compute, 20));

// --- Drawing -----------------------------------------------------------------

function drawLeft(): void {
  const c = left.canvas, ctx = left.ctx, w = c.clientWidth, h = c.clientHeight;
  const F = frameOf(c);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  if (heatmap) ctx.drawImage(heatmap, F.ox, F.oy, F.s * (U_HI - U_LO), F.s * (V_HI - V_LO));

  // The two straight edges of the modular triangle from the hexagonal apex:
  // the cusp edge (a = 0, up) and the short edge to the square torus.
  ctx.strokeStyle = 'rgba(44,44,44,0.35)'; ctx.lineWidth = 1.2;
  const seg = (p: Vec2, q: Vec2) => { const A = toScreen(p[0], p[1], F), B = toScreen(q[0], q[1], F); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); };
  seg(HEX, [0, 6.5]); seg(HEX, SQUARE); // cusp edge (a=0, up) and hex→square edge

  // Corners.
  const mark = (p: Vec2, text: string, color: string, dot = true) => {
    const [x, y] = toScreen(p[0], p[1], F);
    if (dot) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = color; ctx.font = '11px ui-monospace,monospace';
    ctx.fillText(text, x + 8, y + 4);
  };
  mark(HEX, 'hexagonal (min)', '#cb4f4a');
  mark(SQUARE, 'square (saddle)', '#4c72b0');
  mark([0, 4.9], 'cusp →', 'rgba(150,20,90,0.85)', false);

  drawColorbar(ctx, w - 134, 16, 110, 9);

  if (cursor) {
    const [x, y] = toScreen(cursor[0], cursor[1], F);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.stroke();
  }
}

function drawColorbar(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number): void {
  for (let i = 0; i < bw; i++) { const [r, g, b] = qColor(i / (bw - 1)); ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; ctx.fillRect(x + i, y, 1, bh); }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw, bh);
  ctx.fillStyle = 'rgba(44,44,44,0.7)'; ctx.font = '10px ui-monospace,monospace';
  ctx.fillText('q', x - 10, y + bh); ctx.fillText('0', x - 1, y + bh + 11); ctx.fillText('1', x + bw - 4, y + bh + 11);
}

function drawRight(triple: TraceTriple | null, inFD: boolean): void {
  const c = right.canvas, ctx = right.ctx, w = c.clientWidth, h = c.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (!triple) { right.sub.textContent = 'hover the fundamental domain'; return; }

  const hull = normBallHull(triple, 40);
  const { tris, maxQ } = collectTriangles(triple, 8);
  let m = 1e-9;
  for (const [x, y] of hull) m = Math.max(m, Math.abs(x), Math.abs(y));
  const pad = 0.12 * Math.min(w, h), s = (Math.min(w, h) / 2 - pad) / m, cx = w / 2, cy = h / 2;
  const X = (p: Vec2) => cx + p[0] * s, Y = (p: Vec2) => cy - p[1] * s;

  ctx.beginPath();
  hull.forEach((p, i) => (i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))));
  ctx.closePath(); ctx.fillStyle = 'rgba(62,147,143,0.07)'; ctx.fill();

  ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
  for (const sign of [1, -1] as const) {
    for (const tr of tris) {
      ctx.strokeStyle = qCss(tr.q);
      ctx.beginPath();
      ctx.moveTo(cx + sign * tr.a[0] * s, cy - sign * tr.a[1] * s);
      ctx.lineTo(cx + sign * tr.b[0] * s, cy - sign * tr.b[1] * s);
      ctx.lineTo(cx + sign * tr.c[0] * s, cy - sign * tr.c[1] * s);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  right.sub.textContent = inFD
    ? `max q here = ${maxQ.toFixed(3)}  ${maxQ < 1 ? '(contracts ✓)' : '(✗ ≥ 1)'}`
    : `outside the fundamental domain — fold to reduce first  (raw q = ${maxQ.toFixed(2)})`;

  drawInset(ctx, w - 184, 14, 168, 104, qByDepth(triple, 16));

  if (!inFD) {
    ctx.fillStyle = 'rgba(150,20,90,0.9)'; ctx.font = '12px ui-monospace,monospace'; ctx.textAlign = 'center';
    ctx.fillText('outside fundamental domain', w / 2, h - 24);
    ctx.fillStyle = 'rgba(150,20,90,0.6)'; ctx.font = '11px ui-monospace,monospace';
    ctx.fillText('(reduce first — q is only the proof rate on K)', w / 2, h - 10);
    ctx.textAlign = 'left';
  }
}

function drawInset(ctx: CanvasRenderingContext2D, x0: number, y0: number, iw: number, ih: number, qd: number[]): void {
  let last = 0;
  for (let d = 0; d < qd.length; d++) if (qd[d] > 0) last = d;
  const QMAX = 1.2, pad = 16;
  const px = (d: number) => x0 + pad + (iw - 2 * pad) * (last ? d / last : 0);
  const py = (q: number) => y0 + ih - pad - (ih - 2 * pad) * Math.min(q, QMAX) / QMAX;

  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.rect(x0, y0, iw, ih); ctx.fill(); ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(203,79,74,0.8)';
  ctx.beginPath(); ctx.moveTo(px(0), py(1)); ctx.lineTo(px(last), py(1)); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(last), py(0)); ctx.stroke();
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let d = 0; d <= last; d++) (d ? ctx.lineTo(px(d), py(qd[d])) : ctx.moveTo(px(d), py(qd[d])));
  ctx.stroke();
  for (let d = 0; d <= last; d++) { ctx.fillStyle = qd[d] >= 1 ? 'rgb(150,20,90)' : '#2c2c2c'; ctx.beginPath(); ctx.arc(px(d), py(qd[d]), 1.8, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(44,44,44,0.6)'; ctx.font = '10px ui-monospace,monospace';
  ctx.fillText('q vs Farey depth', x0 + pad, y0 + 11);
  ctx.fillStyle = 'rgba(203,79,74,0.9)'; ctx.fillText('1', x0 + 3, py(1) + 3);
}

function draw(): void {
  drawLeft();
  const t = cursor ? liftToTriple(cursor[0], cursor[1]) : null;
  const inFD = cursor ? inFundamentalDomain(cursor[0], cursor[1], FD_R) : false;
  drawRight(t ?? null, inFD);
  if (heatmap) {
    const cur = t
      ? `\n\ncursor:  traces (${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)})  systole ${Math.min(t.x, t.y, t.z).toFixed(3)}\n` +
        `         sup q here = ${supQ(t, 15).toFixed(3)}${inFD ? '' : '   (outside fundamental domain)'}`
      : '';
    readout.textContent = feasibility + cur;
  }
}

// --- Interaction & resize ----------------------------------------------------

left.canvas.addEventListener('mousemove', (e) => {
  const rect = left.canvas.getBoundingClientRect();
  cursor = toWorld(e.clientX - rect.left, e.clientY - rect.top, frameOf(left.canvas));
  draw();
});
left.canvas.addEventListener('mouseleave', () => { cursor = null; draw(); });

function resize(): void {
  for (const p of [left, right]) {
    const dpr = window.devicePixelRatio || 1;
    p.canvas.width = Math.round(p.canvas.clientWidth * dpr);
    p.canvas.height = Math.round(p.canvas.clientHeight * dpr);
    p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  draw();
}
window.addEventListener('resize', resize);
resize();

// --- Panel helper ------------------------------------------------------------

function panel(label: string, sub: string) {
  const box = document.createElement('div');
  box.style.cssText = 'position:relative; flex:1 1 0; min-width:0;';
  const title = document.createElement('div');
  title.style.cssText = 'position:absolute; left:12px; top:10px; pointer-events:none;';
  const main = document.createElement('div'); main.textContent = label; main.style.cssText = 'opacity:0.6;';
  const subEl = document.createElement('div'); subEl.textContent = sub;
  subEl.style.cssText = 'font-size:11px; opacity:0.45; margin-top:3px;';
  title.append(main, subEl);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%; height:100%;';
  box.append(canvas, title);
  return { box, canvas, ctx: canvas.getContext('2d')!, sub: subEl };
}
