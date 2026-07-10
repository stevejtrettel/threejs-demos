/**
 * Boundary samples of the stable-norm ball, accumulating with the cutoff radius.
 *
 * Every simple closed curve of slope (p, q) and hyperbolic length ℓ contributes
 * the point ±(p, q)/ℓ to the unit sphere of the stable norm. As the slope-radius
 * slider grows, more curves enter and the samples fill in the (convex) boundary
 * — the shortest curves (the corners) land farthest out, longer ones crowd the
 * edges between. (Modular torus; change STRUCT to taste.)
 */

import { generateCurves, type TraceTriple } from '../_shared/markoff';
import type { Vec2 } from '@/math/geometry';

const STRUCT: TraceTriple = { x: 3, y: 3, z: 3 };
const MAX_R = 60;
const BG = '#f7f5f0', INK = '#2c2c2c';

// Precompute every sample up to MAX_R, tagged with its slope-radius and 1/ℓ.
interface Sample { P: Vec2; r: number; invL: number; }
const ALL: Sample[] = [];
for (const c of generateCurves(STRUCT, MAX_R)) {
  const l = c.length;
  if (!Number.isFinite(l) || l <= 0) continue;
  const { p, q } = c.slope;
  const r = Math.hypot(p, q), invL = 1 / l;
  ALL.push({ P: [p / l, q / l], r, invL });
  ALL.push({ P: [-p / l, -q / l], r, invL });
}
let EXT = 1e-6, MAXINV = 1e-6;
for (const s of ALL) { EXT = Math.max(EXT, Math.abs(s.P[0]), Math.abs(s.P[1])); MAXINV = Math.max(MAXINV, s.invL); }

// q → warm-for-corners colour by 1/ℓ.
function dotColor(t: number): string {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return `rgb(${lerp(62, 203) | 0},${lerp(110, 79) | 0},${lerp(143, 74) | 0})`;
}

// --- Layout ------------------------------------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;
const root = document.createElement('div');
root.style.cssText = 'position:fixed; inset:0; display:flex; flex-direction:column; font:13px/1.5 ui-monospace,monospace; color:' + INK;
const wrap = document.createElement('div');
wrap.style.cssText = 'flex:1 1 0; position:relative; min-height:0;';
const canvas = document.createElement('canvas');
canvas.style.cssText = 'display:block; width:100%; height:100%;';
const title = document.createElement('div');
title.style.cssText = 'position:absolute; left:12px; top:10px; pointer-events:none; opacity:0.6;';
title.textContent = 'boundary samples  ±(p,q)/ℓ  (slope radius ≤ R)';
wrap.append(canvas, title);
const ctx = canvas.getContext('2d')!;

const bar = document.createElement('div');
bar.style.cssText = 'flex:0 0 auto; padding:10px 16px; display:flex; align-items:center; gap:14px; border-top:1px solid rgba(0,0,0,0.12); background:rgba(247,245,240,0.9);';
const slider = document.createElement('input');
slider.type = 'range'; slider.min = '1'; slider.max = String(MAX_R); slider.step = '1'; slider.value = '3';
slider.style.cssText = 'flex:1 1 auto; max-width:460px;';
const readout = document.createElement('div'); readout.style.cssText = 'white-space:pre; opacity:0.85;';
bar.append(document.createTextNode('R: '), slider, readout);
root.append(wrap, bar);
document.body.appendChild(root);

// --- Draw --------------------------------------------------------------------

function draw(): void {
  const R = Number(slider.value);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const s = (Math.min(w, h) / 2 - 24) / (EXT * 1.05), cx = w / 2, cy = h / 2;

  ctx.strokeStyle = 'rgba(44,44,44,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, cy); ctx.lineTo(w - 24, cy); ctx.moveTo(cx, 24); ctx.lineTo(cx, h - 24); ctx.stroke();

  let n = 0;
  for (const samp of ALL) {
    if (samp.r > R) continue;
    n++;
    ctx.fillStyle = dotColor(samp.invL / MAXINV);
    const rad = 1.1 + 2.4 * (samp.invL / MAXINV); // shortest curves (corners) = biggest dots
    ctx.beginPath(); ctx.arc(cx + samp.P[0] * s, cy - samp.P[1] * s, rad, 0, 7); ctx.fill();
  }
  readout.textContent = `R=${R}   points=${n}`;
}

slider.addEventListener('input', draw);
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
window.addEventListener('resize', resize);
resize();
