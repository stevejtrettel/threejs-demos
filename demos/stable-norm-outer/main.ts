/**
 * Outer approximation of the stable-norm ball.
 *
 * The same dense cloud of boundary samples ±(p,q)/ℓ outlines the "true" ball. At
 * each rational direction the ball has a corner with two one-sided supporting
 * lines, given in CLOSED FORM from the neighbour traces (Doan–Li–Nguyen, via
 * `_shared/stableNormUpper`: gapSupports). Each line supports the ball, so the
 * intersection of their half-planes is an OUTER body. Using only the directions
 * out to a slope-radius R (slider) and intersecting their support lines gives a
 * circumscribed polygon ⊇ ball; as R grows it uses more of the cloud and the
 * polygon converges down onto it from outside. (Modular torus; change STRUCT.)
 */

import { generateCurves, type TraceTriple } from '../_shared/markoff';
import { convexHull, polygonArea, type Vec2 } from '@/math/geometry';
import { boundaryDirections, gapSupports } from '../_shared/stableNormUpper';

const STRUCT: TraceTriple = { x: 3, y: 3, z: 3 };
const CLOUD_R = 70;      // dense "true" boundary cloud
const BG = '#f7f5f0', INK = '#2c2c2c', GOLD = '#d9a93e', TEAL = '#3e938f';

// dense cloud (the "true" boundary), each sample tagged with its slope radius
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
let CLOUD_EXT = 1e-6;
for (const s of ALL) CLOUD_EXT = Math.max(CLOUD_EXT, Math.abs(s.P[0]), Math.abs(s.P[1]));
const TRUE_AREA = polygonArea(convexHull(ALL.map((s) => s.P)));

// --- Outer polygon = intersection of half-planes ⟨v,wᵢ⟩ ≤ 1 = polar of conv{wᵢ}
// Collinear covectors (parallel support lines) must be collapsed to the tightest
// one per direction first — otherwise the hull keeps redundant near-duplicate
// vertices and the polar picks up degenerate edges → spurious inward spikes.
function outerPolygon(normals: Vec2[]): Vec2[] {
  const byDir = new Map<number, Vec2>();
  for (const w of normals) {
    const key = Math.round(Math.atan2(w[1], w[0]) * 1e6);
    const cur = byDir.get(key);
    if (!cur || w[0] * w[0] + w[1] * w[1] > cur[0] * cur[0] + cur[1] * cur[1]) byDir.set(key, w);
  }
  const cleaned = [...byDir.values()];
  if (cleaned.length < 3) return [];
  const H = convexHull(cleaned);
  const poly: Vec2[] = [];
  for (let i = 0; i < H.length; i++) {
    const wa = H[i], wb = H[(i + 1) % H.length];
    const det = wa[0] * wb[1] - wb[0] * wa[1];
    if (Math.abs(det) < 1e-12) continue;
    poly.push([(wb[1] - wa[1]) / det, (wa[0] - wb[0]) / det]); // solve ⟨v,wa⟩=⟨v,wb⟩=1
  }
  return poly;
}

// circumscribed polygon from the support lines of all directions with radius ≤ R.
// 'two'  — both one-sided lines at each vertex (tightest; touches the ball at
//          every vertex).  'one' — a single line per vertex, the average of its
//          two extreme slopes (a clean circumscribed polygon, looser at corners).
function buildOuter(R: number, mode: 'two' | 'one'): { poly: Vec2[]; nDirs: number } {
  const dirs = boundaryDirections(STRUCT, R);
  const n = dirs.length;
  const extreme: Vec2[] = [];
  const perVertex: Vec2[][] = dirs.map(() => []);
  for (let i = 0; i < n; i++) {
    const g = gapSupports(dirs[i], dirs[(i + 1) % n]);
    if (!g) continue;
    extreme.push(g.atU, g.atV);
    perVertex[i].push(g.atU);
    perVertex[(i + 1) % n].push(g.atV);
  }
  if (mode === 'two') return { poly: outerPolygon(extreme), nDirs: n };
  const avg: Vec2[] = [];
  for (const cs of perVertex) {
    if (!cs.length) continue;
    let sx = 0, sy = 0; for (const c of cs) { sx += c[0]; sy += c[1]; }
    avg.push([sx / cs.length, sy / cs.length]);
  }
  return { poly: outerPolygon(avg), nDirs: n };
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
title.textContent = 'outer approximation: support-line polygon with slope radius ≤ R';
wrap.append(canvas, title);
const ctx = canvas.getContext('2d')!;

const bar = document.createElement('div');
bar.style.cssText = 'flex:0 0 auto; padding:10px 16px; display:flex; align-items:center; gap:12px 14px; flex-wrap:wrap; border-top:1px solid rgba(0,0,0,0.12); background:rgba(247,245,240,0.9);';
const slider = document.createElement('input');
// R=1 is degenerate (only the two axis curves; can't bound the ball), so floor at 2.
slider.type = 'range'; slider.min = '2'; slider.max = '40'; slider.step = '1'; slider.value = '2';
slider.style.cssText = 'flex:1 1 auto; max-width:460px;';
let mode: 'two' | 'one' = 'two';
const toggle = document.createElement('div');
toggle.style.cssText = 'display:flex; align-items:center; gap:9px; white-space:nowrap;';
const lblExt = document.createElement('span'); lblExt.textContent = 'extremal supports'; lblExt.style.cursor = 'pointer';
const lblMid = document.createElement('span'); lblMid.textContent = 'mid supports'; lblMid.style.cursor = 'pointer';
const track = document.createElement('div');
track.style.cssText = 'position:relative; width:38px; height:18px; flex:0 0 auto; border-radius:9px; background:#cdcabf; cursor:pointer;';
const knob = document.createElement('div');
knob.style.cssText = 'position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.3); transition:left .14s;';
track.appendChild(knob);
toggle.append(lblExt, track, lblMid);
function styleSeg(): void {
  const mid = mode === 'one';
  knob.style.left = mid ? '22px' : '2px';
  lblExt.style.opacity = mid ? '0.4' : '1'; lblExt.style.fontWeight = mid ? '400' : '700';
  lblMid.style.opacity = mid ? '1' : '0.4'; lblMid.style.fontWeight = mid ? '700' : '400';
}
track.addEventListener('click', () => { mode = mode === 'two' ? 'one' : 'two'; styleSeg(); draw(); });
lblExt.addEventListener('click', () => { mode = 'two'; styleSeg(); draw(); });
lblMid.addEventListener('click', () => { mode = 'one'; styleSeg(); draw(); });
const innerToggle = document.createElement('input');
innerToggle.type = 'checkbox';
const innerLabel = document.createElement('label');
innerLabel.style.cssText = 'display:flex; align-items:center; gap:5px; cursor:pointer; white-space:nowrap;';
innerLabel.append(innerToggle, document.createTextNode('show inner'));
const readout = document.createElement('div'); readout.style.cssText = 'opacity:0.85; flex:1 1 100%; margin-top:2px;';
bar.append(document.createTextNode('R: '), slider, toggle, innerLabel, readout);
root.append(wrap, bar);
document.body.appendChild(root);

// --- Draw --------------------------------------------------------------------

function draw(): void {
  const R = Number(slider.value);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const { poly, nDirs } = buildOuter(R, mode);
  // fit cloud + (possibly larger) outer polygon; as R grows the view settles onto the cloud
  let ext = CLOUD_EXT;
  for (const [x, y] of poly) ext = Math.max(ext, Math.abs(x), Math.abs(y));
  const s = (Math.min(w, h) / 2 - 24) / (ext * 1.05), cx = w / 2, cy = h / 2;
  const X = (v: Vec2) => cx + v[0] * s, Y = (v: Vec2) => cy - v[1] * s;

  ctx.strokeStyle = 'rgba(44,44,44,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, cy); ctx.lineTo(w - 24, cy); ctx.moveTo(cx, 24); ctx.lineTo(cx, h - 24); ctx.stroke();

  // faint full cloud (the "true" boundary)
  ctx.fillStyle = 'rgba(44,44,44,0.18)';
  for (const samp of ALL) { ctx.beginPath(); ctx.arc(X(samp.P), Y(samp.P), 0.9, 0, 7); ctx.fill(); }

  // outer polygon from directions with r ≤ R
  if (poly.length >= 3) {
    ctx.beginPath();
    poly.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
    ctx.closePath();
    ctx.fillStyle = 'rgba(217,169,62,0.14)'; ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
  }

  // inner hull of the same used directions (optional) — the bracket's lower body
  const usedPts = ALL.filter((samp) => samp.r <= R).map((samp) => samp.P);
  let innerArea = NaN;
  if (innerToggle.checked) {
    const inner = convexHull(usedPts);
    if (inner.length >= 3) {
      ctx.beginPath();
      inner.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
      ctx.closePath();
      ctx.fillStyle = 'rgba(62,147,143,0.28)'; ctx.fill();
      ctx.strokeStyle = TEAL; ctx.lineWidth = 1.5; ctx.stroke();
      innerArea = polygonArea(inner);
    }
  }

  // highlight the cloud samples whose directions feed the polygon (the contact points)
  ctx.fillStyle = '#cb4f4a';
  for (const p of usedPts) { ctx.beginPath(); ctx.arc(X(p), Y(p), 1.8, 0, 7); ctx.fill(); }

  const area = poly.length >= 3 ? polygonArea(poly) : Infinity;
  const outStr = Number.isFinite(area) ? area.toFixed(4) : '—';
  const m = mode === 'two' ? 'extremal supports' : 'mid support';
  readout.textContent = innerToggle.checked
    ? `R=${R}  ${m}   points used=${usedPts.length}   inner ${Number.isFinite(innerArea) ? innerArea.toFixed(4) : '—'} ≤ V ≤ outer ${outStr}   bracket ${Number.isFinite(area) && Number.isFinite(innerArea) ? (area - innerArea).toFixed(4) : '—'}`
    : `R=${R}  ${m}   points used=${usedPts.length}   directions=${nDirs}   outer area=${outStr}   (true ${TRUE_AREA.toFixed(4)}, gap ${Number.isFinite(area) ? (area - TRUE_AREA).toFixed(4) : '—'})`;
}

slider.addEventListener('input', draw);
innerToggle.addEventListener('change', draw);
styleSeg();
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
window.addEventListener('resize', resize);
resize();
