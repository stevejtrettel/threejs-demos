/**
 * Support lines at a corner of the stable-norm ball, from the Farey sequence.
 *
 * At a rational direction u the McShane–Rivin ball has a corner. Its one-sided
 * supporting line is the limit of secants through the boundary points of u and
 * h_n = n·u + v (v a Farey neighbour, det(u,v) = 1): as n → ∞, h_n's direction
 * → u's, P_n = h_n/N(h_n) → P_u, and the secant rotates onto the support line.
 *
 * The point worth seeing: each finite secant is a CHORD, not a support line. It
 * meets the norm N at exactly two classes (u and h_n), so by convexity it lies
 * ABOVE the ball in the sector between them — the ball pokes out in a little cap.
 * Only in the limit (the cap shrinking to nothing) is it supporting. We shade
 * that cap so the non-supporting-ness is visible, and the displayed
 *   d_n = N(h_n) − n·N(u)
 * decreases monotonically to d (the one-sided derivative) = the support slope.
 *
 * Modular torus; v1 does the n·u + v side only.
 */

import { modularTorus, generateCurves, traceToLength } from '../_shared/markoff';
import { convexHull, type Vec2 } from '@/math/geometry';

const R_DRAW = 14;      // radius of clickable boundary samples
const R_TRACE = 44;     // radius of the trace lookup table (covers u, v, u+v)
const NMAX_SEQ = 60;    // sequence length used internally (cap arc + converged d)
const EXTENT = 0.62;    // half-window in world (x, y) units

// Palette (shared cream theme).
const BG = '#f7f5f0';
const INK = '#2c2c2c';
const TEAL = '#3e938f';   // the ball
const RED = '#cb4f4a';    // chosen corner u
const BLUE = '#4c72b0';   // neighbour v
const GOLD = '#d9a93e';   // sequence points
const PURPLE = '#8e3fc0'; // secant
const GREEN = '#2f8f6f';  // limiting support line
const FAINT = 'rgba(44,44,44,0.10)';

// --- Trace oracle (modular torus) -------------------------------------------

const key = (p: number, q: number): string => {
  if (q < 0 || (q === 0 && p < 0)) { p = -p; q = -q; }
  return `${p},${q}`;
};
const traceMap = new Map<string, number>();
for (const c of generateCurves(modularTorus, R_TRACE)) traceMap.set(key(c.slope.p, c.slope.q), c.trace);
function traceOf(p: number, q: number): number {
  const t = traceMap.get(key(p, q));
  return t === undefined ? NaN : t;
}

// --- Integer helpers --------------------------------------------------------

type IVec = readonly [number, number];
const add = (a: IVec, b: IVec): IVec => [a[0] + b[0], a[1] + b[1]];
const scl = (k: number, a: IVec): IVec => [k * a[0], k * a[1]];

function extgcd(a: number, b: number): [number, number, number] {
  let or = a, r = b, os = 1, s = 0, ot = 0, t = 1;
  while (r !== 0) {
    const qt = Math.trunc(or / r);
    [or, r] = [r, or - qt * r];
    [os, s] = [s, os - qt * s];
    [ot, t] = [t, ot - qt * t];
  }
  return [or, os, ot]; // g, x, y with a·x + b·y = g
}

/** Shortest Farey neighbour v of u with det(u, v) = +1. */
function neighbour(u: IVec): IVec {
  let [g, x, y] = extgcd(u[0], u[1]);
  if (g < 0) { x = -x; y = -y; } // ensure p·x + q·y = +1
  let a = -y, b = x;             // det(u, (a,b)) = p·b − q·a = p·x + q·y = 1
  const uu = u[0] * u[0] + u[1] * u[1];
  const k = Math.round((a * u[0] + b * u[1]) / uu);
  a -= k * u[0]; b -= k * u[1];  // remove the u-component → shortest neighbour
  return [a, b];
}

// --- Boundary samples (clickable corners) -----------------------------------

interface Corner { p: number; q: number; trace: number; P: Vec2; }
const corners: Corner[] = [];
for (const c of generateCurves(modularTorus, R_DRAW)) {
  const l = c.length;
  if (!Number.isFinite(l) || l <= 0) continue;
  const { p, q } = c.slope;
  const P: Vec2 = [p / l, q / l];
  corners.push({ p, q, trace: c.trace, P });
  corners.push({ p: -p, q: -q, trace: c.trace, P: [-P[0], -P[1]] });
}
const ballHull = convexHull(corners.map((c) => c.P));

// --- The Farey sequence for a chosen corner ---------------------------------

interface SeqItem { n: number; h: IVec; N: number; P: Vec2; dn: number; }
interface Side { items: SeqItem[]; dExact: number; }
interface Sequence { u: IVec; v: IVec; L: number; plus: Side; minus: Side; }

// One family h_n = n·u + sign·v, via the Vieta recurrence along the ray.
function ray(u: IVec, v: IVec, L: number, tu: number, sign: 1 | -1): Side {
  const T0 = traceOf(v[0], v[1]);                                   // t(±v) = t(v)
  const T1 = traceOf(u[0] + sign * v[0], u[1] + sign * v[1]);       // t(u ± v)
  const items: SeqItem[] = [];
  let tPrev = T0, tCur = T1;
  for (let n = 1; n <= NMAX_SEQ; n++) {
    const t = n === 1 ? T1 : tu * tCur - tPrev;
    if (n > 1) { tPrev = tCur; tCur = t; }
    if (!Number.isFinite(t) || Math.abs(t) < 2 || Math.abs(t) > 1e300) break;
    const N = traceToLength(t);
    const h = add(scl(n, u), scl(sign, v));
    items.push({ n, h, N, P: [h[0] / N, h[1] / N], dn: N - n * L });
  }
  const dExact = items.length ? items[items.length - 1]!.dn : NaN; // converged d_n
  return { items, dExact };
}

function buildSequence(u: IVec): Sequence {
  const v = neighbour(u);
  const tu = traceOf(u[0], u[1]);
  const L = traceToLength(tu);
  return { u, v, L, plus: ray(u, v, L, tu, 1), minus: ray(u, v, L, tu, -1) };
}

// --- State ------------------------------------------------------------------

let seq = buildSequence([1, 0]);
let nShown = 6;
let showSupport = true;
let showCap = true;

// --- Canvas + DOM -----------------------------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;
const canvas = document.createElement('canvas');
canvas.style.cssText = 'display:block; width:100vw; height:100vh; cursor:pointer;';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const readout = document.createElement('div');
readout.style.cssText =
  'position:fixed; left:12px; top:12px; font:12px/1.5 ui-monospace,monospace; color:' + INK + ';' +
  'background:rgba(247,245,240,0.92); padding:10px 12px; border-radius:8px; white-space:pre;' +
  'box-shadow:0 1px 6px rgba(0,0,0,0.12); max-width:340px;';
document.body.appendChild(readout);

const controls = document.createElement('div');
controls.style.cssText =
  'position:fixed; left:12px; bottom:12px; font:12px/1.5 ui-monospace,monospace; color:' + INK + ';' +
  'background:rgba(247,245,240,0.92); padding:10px 12px; border-radius:8px; display:flex; flex-direction:column; gap:6px;' +
  'box-shadow:0 1px 6px rgba(0,0,0,0.12);';
document.body.appendChild(controls);

const nRow = document.createElement('div');
nRow.style.cssText = 'display:flex; align-items:center; gap:8px;';
const nLabel = document.createElement('span');
const nSlider = document.createElement('input');
nSlider.type = 'range'; nSlider.min = '1'; nSlider.max = '24'; nSlider.step = '1'; nSlider.value = String(nShown);
nSlider.style.cssText = 'width:160px;';
nRow.append(nLabel, nSlider);
controls.appendChild(nRow);

function checkbox(label: string, val: boolean, on: (v: boolean) => void): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer;';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = val;
  cb.addEventListener('change', () => { on(cb.checked); render(); });
  wrap.append(cb, document.createTextNode(label));
  return wrap;
}
controls.appendChild(checkbox('limiting support lines', showSupport, (v) => (showSupport = v)));
controls.appendChild(checkbox('shade the cap (ball poking past the secant)', showCap, (v) => (showCap = v)));

nSlider.addEventListener('input', () => { nShown = Number(nSlider.value); render(); });

// --- Transforms -------------------------------------------------------------

function scale(): number { return Math.min(canvas.clientWidth, canvas.clientHeight) / (2 * EXTENT); }
function toX(x: number): number { return canvas.clientWidth / 2 + x * scale(); }
function toY(y: number): number { return canvas.clientHeight / 2 - y * scale(); }
function worldAt(px: number, py: number): Vec2 {
  const s = scale();
  return [(px - canvas.clientWidth / 2) / s, -(py - canvas.clientHeight / 2) / s];
}

// World rectangle currently visible (for line clipping).
function viewRect(): { xmin: number; xmax: number; ymin: number; ymax: number } {
  const s = scale();
  const hx = canvas.clientWidth / (2 * s), hy = canvas.clientHeight / (2 * s);
  return { xmin: -hx, xmax: hx, ymin: -hy, ymax: hy };
}

/** Segment of the line α·x + β·y = 1 inside the view rect, or null. */
function lineSegment(alpha: number, beta: number): [Vec2, Vec2] | null {
  const { xmin, xmax, ymin, ymax } = viewRect();
  const pts: Vec2[] = [];
  const eps = 1e-9;
  if (Math.abs(beta) > eps) {
    for (const x of [xmin, xmax]) { const y = (1 - alpha * x) / beta; if (y >= ymin - eps && y <= ymax + eps) pts.push([x, y]); }
  }
  if (Math.abs(alpha) > eps) {
    for (const y of [ymin, ymax]) { const x = (1 - beta * y) / alpha; if (x >= xmin - eps && x <= xmax + eps) pts.push([x, y]); }
  }
  if (pts.length < 2) return null;
  return [pts[0]!, pts[1]!];
}

// --- Drawing ----------------------------------------------------------------

function dot(P: Vec2, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(toX(P[0]), toY(P[1]), r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}
function strokeLine(seg: [Vec2, Vec2], color: string, width: number, dash: number[] = []): void {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(toX(seg[0][0]), toY(seg[0][1]));
  ctx.lineTo(toX(seg[1][0]), toY(seg[1][1]));
  ctx.stroke();
  ctx.restore();
}

// Line coefficients α·x + β·y = 1 of the functional with λ(u)=L, λ(v)=lambdaV.
function lineCoeffs(lambdaV: number): [number, number] {
  const [p, q] = seq.u, [a, b] = seq.v;
  return [b * seq.L - q * lambdaV, -a * seq.L + p * lambdaV];
}

const Pu = (): Vec2 => [seq.u[0] / seq.L, seq.u[1] / seq.L];

// Draw one family. sign=+1 → n·u+v (λ(v)=d_n); sign=−1 → n·u−v (λ(v)=−d_n).
function drawSide(side: Side, sign: 1 | -1, secColor: string, supColor: string, capColor: string): void {
  const idx = Math.min(nShown, side.items.length) - 1;
  const cur = side.items[idx];
  const pu = Pu();

  if (showCap && cur && idx + 1 < side.items.length) {
    ctx.beginPath();
    ctx.moveTo(toX(pu[0]), toY(pu[1]));
    ctx.lineTo(toX(cur.P[0]), toY(cur.P[1]));
    for (let k = idx + 1; k < side.items.length; k++) ctx.lineTo(toX(side.items[k]!.P[0]), toY(side.items[k]!.P[1]));
    ctx.closePath();
    ctx.fillStyle = capColor;
    ctx.fill();
  }
  if (showSupport && Number.isFinite(side.dExact)) {
    const sg = lineSegment(...lineCoeffs(sign * side.dExact));
    if (sg) strokeLine(sg, supColor, 2);
  }
  for (let k = 0; k <= idx; k++) dot(side.items[k]!.P, 3, GOLD);
  if (cur) {
    const sg = lineSegment(...lineCoeffs(sign * cur.dn));
    if (sg) strokeLine(sg, secColor, 2);
    strokeLine([[0, 0], cur.P], 'rgba(217,169,62,0.5)', 1);
    dot(cur.P, 5, GOLD);
  }
}

function render(): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);

  // Axes.
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, toY(0)); ctx.lineTo(w, toY(0));
  ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), h);
  ctx.stroke();

  // The ball (inner hull).
  ctx.beginPath();
  ballHull.forEach(([x, y], i) => (i ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y))));
  ctx.closePath();
  ctx.fillStyle = 'rgba(62,147,143,0.10)';
  ctx.strokeStyle = TEAL; ctx.lineWidth = 1.5;
  ctx.fill(); ctx.stroke();

  // Clickable boundary samples.
  for (const c of corners) dot(c.P, 3, 'rgba(44,44,44,0.45)');

  // Ray to u, then both families (minus under, plus over).
  strokeLine([[0, 0], [seq.u[0] / seq.L * 1.25, seq.u[1] / seq.L * 1.25]], 'rgba(203,79,74,0.35)', 1);
  drawSide(seq.minus, -1, '#d9772b', '#2f6aa0', 'rgba(47,106,160,0.18)'); // − side: orange secant, blue support
  drawSide(seq.plus, 1, PURPLE, GREEN, 'rgba(203,79,74,0.20)');           // + side: purple secant, green support

  // Neighbour + corner emphasis (on top).
  const Pv: Vec2 = (() => { const N = traceToLength(traceOf(seq.v[0], seq.v[1])); return [seq.v[0] / N, seq.v[1] / N]; })();
  dot(Pv, 5, BLUE);
  dot(Pu(), 6, RED);

  // Numerics.
  const f = (x: number) => (Number.isFinite(x) ? x.toFixed(5) : '—');
  const cP = seq.plus.items[Math.min(nShown, seq.plus.items.length) - 1];
  const cM = seq.minus.items[Math.min(nShown, seq.minus.items.length) - 1];
  readout.textContent =
    `click a vertex to choose the corner u\n\n` +
    `u = (${seq.u[0]}, ${seq.u[1]})   v = (${seq.v[0]}, ${seq.v[1]})   det(u,v)=1\n` +
    `n = ${nShown}    N(u) = ${f(seq.L)}\n\n` +
    `+ side  (purple → green):  h = n·u+v = (${cP ? cP.h[0] : '—'}, ${cP ? cP.h[1] : '—'})\n` +
    `   d_n = ${f(cP ? cP.dn : NaN)}   d = ${f(seq.plus.dExact)}   |d_n−d| = ${f(cP ? Math.abs(cP.dn - seq.plus.dExact) : NaN)}\n` +
    `− side  (orange → blue):   h = n·u−v = (${cM ? cM.h[0] : '—'}, ${cM ? cM.h[1] : '—'})\n` +
    `   d_n = ${f(cM ? cM.dn : NaN)}   d = ${f(seq.minus.dExact)}   |d_n−d| = ${f(cM ? Math.abs(cM.dn - seq.minus.dExact) : NaN)}`;
  nLabel.textContent = `n = ${nShown}`;
}

// --- Interaction ------------------------------------------------------------

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = worldAt(e.clientX - rect.left, e.clientY - rect.top);
  let best: Corner | null = null, bestD = Infinity;
  for (const c of corners) {
    const dx = c.P[0] - wx, dy = c.P[1] - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = c; }
  }
  // Accept only clicks reasonably near a vertex (in world units).
  if (best && bestD < (12 / scale()) ** 2) {
    seq = buildSequence([best.p, best.q]);
    const maxN = Math.max(seq.plus.items.length, seq.minus.items.length, 1);
    nShown = Math.min(nShown, maxN);
    nSlider.value = String(nShown);
    render();
  }
});

// --- Resize -----------------------------------------------------------------

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
window.addEventListener('resize', resize);
resize();
