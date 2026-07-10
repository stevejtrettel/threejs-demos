/**
 * Inner / outer bracket of the stable-norm ball from per-vertex support lines.
 *
 * Take the boundary sample points out to radius R (slider). They are the corners
 * of the inner-hull approximation (a LOWER bound). At each corner we compute its
 * TWO one-sided supporting hyperplanes — the left- and right-derivative support
 * lines (each is the limit of the Farey-secant construction, computed here as
 * d = lim_n N(n·u + w) − n·N(u) toward each Farey neighbour w). Intersecting all
 * of those half-planes gives a circumscribed convex body — an UPPER bound.
 *
 * Split screen:
 *   left  — the dot cloud and every vertex's two support lines (the envelope).
 *   right — the two convex bodies: inner hull (lower) and the half-plane
 *           intersection (upper), i.e. the bracket L_R ≤ V ≤ U_R.
 *
 * Modular torus.
 */

import { modularTorus, generateCurves, traceToLength } from '../_shared/markoff';
import { convexHull, polygonArea, type Vec2 } from '@/math/geometry';

const R_TRACE = 60;     // trace lookup radius
const EXTENT = 0.62;    // half-window in world (x, y) units
const BIG = 3;          // initial clip square half-size (contains the outer body)

const BG = '#f7f5f0';
const INK = '#2c2c2c';
const TEAL = '#3e938f';
const ORANGE = '#d9772b';
const FAINT = 'rgba(44,44,44,0.10)';

// --- Trace oracle (modular torus) -------------------------------------------

const key = (p: number, q: number): string => {
  if (q < 0 || (q === 0 && p < 0)) { p = -p; q = -q; }
  return `${p},${q}`;
};
const traceMap = new Map<string, number>();
for (const c of generateCurves(modularTorus, R_TRACE)) traceMap.set(key(c.slope.p, c.slope.q), c.trace);
const traceOf = (p: number, q: number): number => {
  const t = traceMap.get(key(p, q));
  return t === undefined ? NaN : t;
};

// --- All primitive classes, ordered shortest-first (= the recursion order) ---
//
// Adding the K shortest classes keeps the set "Farey-closed downward" (every
// class's shorter ancestors are already in), so consecutive boundary vertices
// stay Farey neighbours at every K — which the support construction needs.

interface Cls { p: number; q: number; trace: number; N: number; ang: number; }
const allClasses: Cls[] = [];
for (const c of generateCurves(modularTorus, 26)) {
  const N = c.length;
  if (!Number.isFinite(N) || N <= 0) continue;
  allClasses.push({ p: c.slope.p, q: c.slope.q, trace: c.trace, N, ang: Math.atan2(c.slope.q, c.slope.p) });
}
allClasses.sort((a, b) => a.N - b.N || a.ang - b.ang);
const KMAX = Math.min(48, allClasses.length);

// Boundary directions from the first K classes (each class + its antipode),
// sorted by angle around the full circle.
interface Dir { p: number; q: number; trace: number; N: number; P: Vec2; }
function dirsFromClasses(K: number): Dir[] {
  const out: Dir[] = [];
  for (const c of allClasses.slice(0, K)) {
    out.push({ p: c.p, q: c.q, trace: c.trace, N: c.N, P: [c.p / c.N, c.q / c.N] });
    out.push({ p: -c.p, q: -c.q, trace: c.trace, N: c.N, P: [-c.p / c.N, -c.q / c.N] });
  }
  out.sort((a, b) => Math.atan2(a.q, a.p) - Math.atan2(b.q, b.p));
  return out;
}

// --- One supporting half-plane at vertex u toward Farey neighbour w ----------
//
// d = lim_n [ N(n·u + w) − n·N(u) ] = the one-sided derivative D_w^+ N(u),
// via the Vieta recurrence along the ray (converges by n ≈ 10). The support
// functional λ has λ(u)=N(u), λ(w)=d; in (x,y) it is α x + β y = 1 (half-plane ≤ 1).

interface HalfPlane { alpha: number; beta: number; }
function supportHalfPlane(u: Dir, w: Dir): HalfPlane | null {
  const tu = u.trace;
  const tw = w.trace;
  const tuw = traceOf(u.p + w.p, u.q + w.q);
  if (!Number.isFinite(tu) || !Number.isFinite(tw) || !Number.isFinite(tuw)) return null;
  const L = u.N;
  let tPrev = tw, tCur = tuw, d = NaN;
  for (let n = 1; n <= 30; n++) {
    const t = n === 1 ? tuw : tu * tCur - tPrev;
    if (n > 1) { tPrev = tCur; tCur = t; }
    if (!Number.isFinite(t) || Math.abs(t) < 2 || Math.abs(t) > 1e300) break;
    d = traceToLength(t) - n * L; // last finite value = converged limit
  }
  if (!Number.isFinite(d)) return null;
  const D = u.p * w.q - u.q * w.p; // det(u, w) = ±1
  return { alpha: (w.q * L - u.q * d) / D, beta: (-w.p * L + u.p * d) / D };
}

// All per-vertex support half-planes (two per vertex: toward each neighbour).
function vertexHalfPlanes(dirs: Dir[]): HalfPlane[] {
  const planes: HalfPlane[] = [];
  const n = dirs.length;
  for (let i = 0; i < n; i++) {
    const u = dirs[i]!;
    for (const w of [dirs[(i + 1) % n]!, dirs[(i - 1 + n) % n]!]) {
      const hp = supportHalfPlane(u, w);
      if (hp) planes.push(hp);
    }
  }
  return planes;
}

// --- Intersect half-planes {α x + β y ≤ 1} by clipping a big square ----------

function clip(poly: Vec2[], a: number, b: number): Vec2[] {
  const out: Vec2[] = [];
  const val = (P: Vec2) => a * P[0] + b * P[1] - 1;
  for (let i = 0; i < poly.length; i++) {
    const C = poly[i]!, Nx = poly[(i + 1) % poly.length]!;
    const vc = val(C), vn = val(Nx);
    if (vc <= 0) out.push(C);
    if ((vc < 0) !== (vn < 0)) {
      const t = vc / (vc - vn);
      out.push([C[0] + t * (Nx[0] - C[0]), C[1] + t * (Nx[1] - C[1])]);
    }
  }
  return out;
}
function intersectHalfPlanes(planes: HalfPlane[]): Vec2[] {
  let poly: Vec2[] = [[-BIG, -BIG], [BIG, -BIG], [BIG, BIG], [-BIG, BIG]];
  for (const { alpha, beta } of planes) {
    poly = clip(poly, alpha, beta);
    if (poly.length < 3) break;
  }
  return poly;
}

// --- State / compute --------------------------------------------------------

let K = 2;
let dirs: Dir[] = [];
let planes: HalfPlane[] = [];
let innerHull: Vec2[] = [];
let outerPoly: Vec2[] = [];
let areaInner = 0, areaOuter = 0;

function recompute(): void {
  dirs = dirsFromClasses(K);
  planes = vertexHalfPlanes(dirs);
  innerHull = convexHull(dirs.map((d) => d.P));
  outerPoly = intersectHalfPlanes(planes);
  areaInner = polygonArea(innerHull);
  areaOuter = polygonArea(outerPoly);
}

// --- Layout: two canvases side by side --------------------------------------

document.body.style.cssText = 'margin:0; overflow:hidden; background:' + BG;
const root = document.createElement('div');
root.style.cssText = 'position:fixed; inset:0; display:flex; font:13px/1.5 ui-monospace,monospace; color:' + INK + ';';
const left = panel('vertices + their two support lines', 'left & right derivatives at each corner');
const right = panel('inner & outer convex bodies', 'L_R ≤ V ≤ U_R');
left.box.style.borderRight = '1px solid rgba(0,0,0,0.12)';
root.append(left.box, right.box);
document.body.appendChild(root);

const controls = document.createElement('div');
controls.style.cssText =
  'position:fixed; left:12px; bottom:12px; font:12px/1.5 ui-monospace,monospace; color:' + INK + ';' +
  'background:rgba(247,245,240,0.92); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:10px;' +
  'box-shadow:0 1px 6px rgba(0,0,0,0.12);';
const rLabel = document.createElement('span');
const rSlider = document.createElement('input');
rSlider.type = 'range'; rSlider.min = '2'; rSlider.max = String(KMAX); rSlider.step = '1'; rSlider.value = String(K);
rSlider.style.cssText = 'width:240px;';
rSlider.addEventListener('input', () => { K = Number(rSlider.value); recompute(); render(); });
controls.append(rLabel, rSlider);
document.body.appendChild(controls);

// --- Transforms (shared) ----------------------------------------------------

function scaleOf(c: HTMLCanvasElement): number { return Math.min(c.clientWidth, c.clientHeight) / (2 * EXTENT); }
function tx(c: HTMLCanvasElement, x: number): number { return c.clientWidth / 2 + x * scaleOf(c); }
function ty(c: HTMLCanvasElement, y: number): number { return c.clientHeight / 2 - y * scaleOf(c); }
function viewRect(c: HTMLCanvasElement) {
  const s = scaleOf(c);
  return { xmin: -c.clientWidth / (2 * s), xmax: c.clientWidth / (2 * s), ymin: -c.clientHeight / (2 * s), ymax: c.clientHeight / (2 * s) };
}
function lineSeg(c: HTMLCanvasElement, a: number, b: number): [Vec2, Vec2] | null {
  const { xmin, xmax, ymin, ymax } = viewRect(c);
  const pts: Vec2[] = [];
  const e = 1e-9;
  if (Math.abs(b) > e) for (const x of [xmin, xmax]) { const y = (1 - a * x) / b; if (y >= ymin - e && y <= ymax + e) pts.push([x, y]); }
  if (Math.abs(a) > e) for (const y of [ymin, ymax]) { const x = (1 - b * y) / a; if (x >= xmin - e && x <= xmax + e) pts.push([x, y]); }
  return pts.length >= 2 ? [pts[0]!, pts[1]!] : null;
}

function fillPoly(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, poly: Vec2[], fill: string, stroke: string, width: number): void {
  if (poly.length < 3) return;
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(tx(c, x), ty(c, y)) : ctx.moveTo(tx(c, x), ty(c, y))));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
}
function axes(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement): void {
  ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ty(c, 0)); ctx.lineTo(c.clientWidth, ty(c, 0));
  ctx.moveTo(tx(c, 0), 0); ctx.lineTo(tx(c, 0), c.clientHeight);
  ctx.stroke();
}

// --- Render -----------------------------------------------------------------

function render(): void {
  // LEFT: dot cloud + every support line.
  const lc = left.canvas, lx = left.ctx;
  axes(lx, lc);
  lx.strokeStyle = 'rgba(142,63,192,0.22)'; lx.lineWidth = 1; // support lines
  for (const { alpha, beta } of planes) {
    const sg = lineSeg(lc, alpha, beta);
    if (sg) { lx.beginPath(); lx.moveTo(tx(lc, sg[0][0]), ty(lc, sg[0][1])); lx.lineTo(tx(lc, sg[1][0]), ty(lc, sg[1][1])); lx.stroke(); }
  }
  lx.fillStyle = INK;
  for (const d of dirs) { lx.beginPath(); lx.arc(tx(lc, d.P[0]), ty(lc, d.P[1]), 3, 0, 2 * Math.PI); lx.fill(); }

  // RIGHT: outer body, then inner body on top.
  const rc = right.canvas, rx = right.ctx;
  axes(rx, rc);
  fillPoly(rx, rc, outerPoly, 'rgba(217,119,43,0.16)', ORANGE, 1.5);
  fillPoly(rx, rc, innerHull, 'rgba(62,147,143,0.45)', TEAL, 2);
  right.sub.textContent = `L_R = ${areaInner.toFixed(5)} ≤ V ≤ ${areaOuter.toFixed(5)} = U_R   (gap ${(areaOuter - areaInner).toExponential(2)})`;

  const longest = allClasses[Math.min(K, allClasses.length) - 1];
  rLabel.textContent = `curves: ${K}   ·   ${dirs.length} vertices   ·   longest |trace| = ${longest ? Math.abs(longest.trace).toFixed(0) : '—'}`;
}

// --- Helpers + resize -------------------------------------------------------

function panel(label: string, sub: string) {
  const box = document.createElement('div');
  box.style.cssText = 'position:relative; flex:1 1 0; min-width:0;';
  const title = document.createElement('div');
  title.style.cssText = 'position:absolute; left:12px; top:10px; pointer-events:none;';
  const main = document.createElement('div'); main.textContent = label; main.style.cssText = 'opacity:0.6;';
  const subEl = document.createElement('div'); subEl.textContent = sub; subEl.style.cssText = 'font-size:11px; opacity:0.45; margin-top:3px;';
  title.append(main, subEl);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%; height:100%;';
  box.append(canvas, title);
  return { box, canvas, ctx: canvas.getContext('2d')!, title, sub: subEl };
}

function resize(): void {
  for (const p of [left, right]) {
    const dpr = window.devicePixelRatio || 1;
    p.canvas.width = Math.round(p.canvas.clientWidth * dpr);
    p.canvas.height = Math.round(p.canvas.clientHeight * dpr);
    p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  render();
}
window.addEventListener('resize', resize);
recompute();
resize();
