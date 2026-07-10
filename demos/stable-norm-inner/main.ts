/**
 * Inner approximation of the stable-norm ball.
 *
 * A dense cloud of boundary samples ±(p,q)/ℓ outlines the "true" ball. The inner
 * convex hull of the samples out to a slope-radius R (slider) is a LOWER bound on
 * the ball: every sample is on the boundary, so their hull sits inside. As R
 * grows the hull fills the cloud — its area rises monotonically to V.
 * (Modular torus; change STRUCT to taste.)
 */

import { generateCurves, type TraceTriple } from '../_shared/markoff';
import { convexHull, polygonArea, type Vec2 } from '@/math/geometry';

const STRUCT: TraceTriple = { x: 3, y: 3, z: 3 };
const CLOUD_R = 70;      // dense "true" boundary cloud
const BG = '#f7f5f0', INK = '#2c2c2c', TEAL = '#3e938f';

interface Sample { P: Vec2; r: number; }
const ALL: Sample[] = [];
for (const c of generateCurves(STRUCT, CLOUD_R)) {
  const l = c.length;
  if (!Number.isFinite(l) || l <= 0) continue;
  const { p, q } = c.slope;
  const r = Math.hypot(p, q);
  ALL.push({ P: [p / l, q / l], r });
  ALL.push({ P: [-p / l, -q / l], r });
}
let EXT = 1e-6;
for (const s of ALL) EXT = Math.max(EXT, Math.abs(s.P[0]), Math.abs(s.P[1]));
const TRUE_AREA = polygonArea(convexHull(ALL.map((s) => s.P)));

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
title.textContent = 'inner approximation: hull of samples with slope radius ≤ R';
wrap.append(canvas, title);
const ctx = canvas.getContext('2d')!;

const bar = document.createElement('div');
bar.style.cssText = 'flex:0 0 auto; padding:10px 16px; display:flex; align-items:center; gap:14px; border-top:1px solid rgba(0,0,0,0.12); background:rgba(247,245,240,0.9);';
const slider = document.createElement('input');
slider.type = 'range'; slider.min = '1'; slider.max = '40'; slider.step = '1'; slider.value = '2';
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
  const X = (v: Vec2) => cx + v[0] * s, Y = (v: Vec2) => cy - v[1] * s;

  ctx.strokeStyle = 'rgba(44,44,44,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, cy); ctx.lineTo(w - 24, cy); ctx.moveTo(cx, 24); ctx.lineTo(cx, h - 24); ctx.stroke();

  // faint full cloud (the "true" boundary)
  ctx.fillStyle = 'rgba(44,44,44,0.18)';
  for (const samp of ALL) { ctx.beginPath(); ctx.arc(X(samp.P), Y(samp.P), 0.9, 0, 7); ctx.fill(); }

  // inner hull of samples with r ≤ R
  const used = ALL.filter((samp) => samp.r <= R).map((samp) => samp.P);
  const hull = convexHull(used);
  if (hull.length >= 3) {
    ctx.beginPath();
    hull.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
    ctx.closePath();
    ctx.fillStyle = 'rgba(62,147,143,0.25)'; ctx.fill();
    ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.stroke();
  }
  // highlight the samples being used (the hull's input)
  ctx.fillStyle = '#cb4f4a';
  for (const samp of ALL) { if (samp.r <= R) { ctx.beginPath(); ctx.arc(X(samp.P), Y(samp.P), 1.8, 0, 7); ctx.fill(); } }

  const area = hull.length >= 3 ? polygonArea(hull) : 0;
  readout.textContent = `R=${R}   points used=${used.length}   inner area=${area.toFixed(4)}   (true ${TRUE_AREA.toFixed(4)}, gap ${(TRUE_AREA - area).toFixed(4)})`;
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
