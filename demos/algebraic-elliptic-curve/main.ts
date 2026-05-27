/**
 * Elliptic curve  y² = x³ + f·x + g  in CP², toric (moment-map) image.
 *
 * Sliders set the real parameters (f, g). The homogeneous polynomial is
 *   F(X, Y, Z) = Y²Z - X³ - f·X·Z² - g·Z³.
 * The discriminant of the affine cubic x³ + fx + g is Δ = -(4f³ + 27g²);
 * the curve is smooth iff Δ ≠ 0.
 *
 * The sampled cloud is rotated continuously through a one-parameter subgroup of
 * U(3) so all moment-map shadows of the curve are visible.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { homoPoly, evaluateAtPoint, type HomoPoly } from '@/math/algebraic-curves/homopoly';
import { cAbs, cMul, cAdd, cScale, type Complex } from '@/math/algebraic-curves/complex';
import { findInitialPoint } from '@/math/algebraic-curves/initialPoint';
import { walkSample } from '@/math/algebraic-curves/sampler';
import { findRoots } from '@/math/algebraic-curves/rootfind';
import { cp2Norm, type CP2Point } from '@/math/cp2/point';
import { liftSegmentLoop } from '@/math/algebraic-curves/elliptic-lift';
import { TRIANGLE_VERTICES } from '@/math/cp2/momentMap';
import { composeU3Rotation, randomU3Speeds, type U3RotationSpeeds } from '@/math/cp2/u3';
import {
  toricProjection,
  affineR3Projection,
  type CP2Projection,
} from '@/math/cp2/projections';
import { CP2PointCloud } from '@/math/cp2/CP2PointCloud';
import { CP2Markers, type RGB } from '@/math/cp2/CP2Markers';
import { CP2Loop } from '@/math/cp2/CP2Loop';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0x0a0a0a);

const SQ3_2 = Math.sqrt(3) / 2;
const TRI_CENTROID: [number, number] = [0.5, SQ3_2 / 3];

// --- Triangle outline (visible only in toric mode) ---
const triPts = TRIANGLE_VERTICES.map(([x, y]) => new THREE.Vector3(x, y, 0));
triPts.push(triPts[0].clone());
const triangleOutline = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(triPts),
  new THREE.LineBasicMaterial({ color: 0x555555 }),
);
app.scene.add(triangleOutline);

// --- View mode constants ---
type ViewMode = 'toric' | 'affineR3';
const TORIC_PROJECTION = toricProjection();
const AFFINE_PROJECTION = affineR3Projection({ scale: 1.5 });

// --- Scene components ---
const cloud = new CP2PointCloud({ opacity: 0.7 });
app.scene.add(cloud);

// Branch points of the (x,y) → x double cover plus the point at infinity
// [0:1:0] (identity of the group law and the 4th 2-torsion point).
const BRANCH_COLORS: RGB[] = [
  [1.0, 0.35, 0.35], // r1  red
  [0.35, 1.0, 0.45], // r2  green
  [0.55, 0.65, 1.0], // r3  blue
  [1.0, 0.95, 0.45], // ∞   yellow
];
const POINT_AT_INFINITY: CP2Point = [
  { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 },
];
const markers = new CP2Markers({ colors: BRANCH_COLORS, size: 0.022 });
app.scene.add(markers);

// Lift loops: segments in C_x between branch points, analytically continued
// to closed loops on the curve. r1-r2 in white, r2-r3 in orange.
const LIFT_N = 240;
const LIFT_LOOP_CAPACITY = 2 * LIFT_N + 3;
const liftSegments: Array<{ rootPair: [number, number]; loop: CP2Loop }> = [
  { rootPair: [0, 1], loop: new CP2Loop({ capacity: LIFT_LOOP_CAPACITY, color: 0xffffff, linewidth: 2.5 }) },
  { rootPair: [1, 2], loop: new CP2Loop({ capacity: LIFT_LOOP_CAPACITY, color: 0xff9933, linewidth: 2.5 }) },
];
for (const { loop } of liftSegments) app.scene.add(loop);

function applyView(mode: ViewMode): void {
  const proj: CP2Projection = mode === 'toric' ? TORIC_PROJECTION : AFFINE_PROJECTION;
  cloud.setProjection(proj);
  markers.setProjection(proj);
  for (const { loop } of liftSegments) loop.setProjection(proj);
  triangleOutline.visible = mode === 'toric';
  if (mode === 'toric') {
    app.camera.position.set(TRI_CENTROID[0], TRI_CENTROID[1], 1.4);
    app.controls.target.set(TRI_CENTROID[0], TRI_CENTROID[1], 0);
  } else {
    app.camera.position.set(2.5, 2.0, 3.0);
    app.controls.target.set(0, 0, 0);
  }
  app.controls.update();
}
applyView('toric');

// --- Polynomial family ---
function weierstrass(f: number, g: number): HomoPoly {
  return homoPoly(3, [
    [0, 2, 1, 1],
    [3, 0, 0, -1],
    [1, 0, 2, -f],
    [0, 0, 3, -g],
  ]);
}
function makeCubicEval(f: number, g: number): (x: Complex) => Complex {
  const gC: Complex = { re: g, im: 0 };
  return (x: Complex) =>
    cAdd(cAdd(cMul(cMul(x, x), x), cScale(x, f)), gC);
}

// --- Sampling ---
let lastRoots: Complex[] = [];
let onRootsUpdated: (() => void) | null = null;
const DEFAULT_POINTS = 12000;

function sampleAndUpload(f: number, g: number, targetPoints: number): void {
  const F = weierstrass(f, g);
  const stepsNeeded = Math.max(
    1,
    Math.round((targetPoints - 1) / (F.degree - 1)),
  );

  let sampled: CP2Point[];
  try {
    const start = findInitialPoint(F);
    sampled = walkSample(F, start, { steps: stepsNeeded, branching: true });
  } catch (e) {
    console.warn('findInitialPoint failed (likely on discriminant locus):', e);
    return;
  }
  cloud.setPoints(sampled);

  // Roots of x³ + fx + g, sorted by (re, im) for stable color assignment.
  const roots = findRoots([
    { re: g, im: 0 }, { re: f, im: 0 },
    { re: 0, im: 0 }, { re: 1, im: 0 },
  ]);
  roots.sort((a, b) => a.re - b.re || a.im - b.im);
  lastRoots = roots;

  const finiteBranch = roots.map((r) =>
    cp2Norm([r, { re: 0, im: 0 }, { re: 1, im: 0 }]),
  );
  markers.setPoints([...finiteBranch, POINT_AT_INFINITY]);

  // Lift each requested segment to a closed loop, then hand it to the CP2Loop
  // component. (CP2Loop doesn't auto-close; we push a copy of vertex 0 at the
  // tail so Line2 draws the closing edge.)
  const polyEval = makeCubicEval(f, g);
  for (const { rootPair, loop } of liftSegments) {
    const [iA, iB] = rootPair;
    if (roots.length <= Math.max(iA, iB)) {
      loop.setPoints([]);
      continue;
    }
    const affineLoop = liftSegmentLoop(roots[iA], roots[iB], polyEval, LIFT_N);
    const cp2Loop: CP2Point[] = affineLoop.map(({ x, y }) =>
      cp2Norm([x, y, { re: 1, im: 0 }]),
    );
    cp2Loop.push(cp2Loop[0]); // close the line
    loop.setPoints(cp2Loop);
  }

  onRootsUpdated?.();

  let maxR = 0;
  for (const p of sampled) {
    const r = cAbs(evaluateAtPoint(F, p));
    if (r > maxR) maxR = r;
  }
  const disc = -(4 * f * f * f + 27 * g * g);
  console.log(
    `f=${f.toFixed(3)}  g=${g.toFixed(3)}  Δ=${disc.toExponential(2)}  ` +
      `${sampled.length} pts  maxRes=${maxR.toExponential(2)}`,
  );
}

// --- Rotation state ---
const speeds: U3RotationSpeeds = randomU3Speeds();
let rotating = true;
let phase = 0;

app.addAnimateCallback((_time: number, delta: number) => {
  if (rotating) phase += delta;
  const g = composeU3Rotation(phase, speeds);
  cloud.project(g);
  markers.project(g);
  for (const { loop } of liftSegments) loop.project(g);
});

// --- UI overlay (top-center) ---
function fmtComplex(z: Complex): string {
  if (Math.abs(z.im) < 1e-6) return z.re.toFixed(3);
  const sign = z.im >= 0 ? '+' : '−';
  return `${z.re.toFixed(3)} ${sign} ${Math.abs(z.im).toFixed(3)}i`;
}

function buildOverlay(): void {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%',
    'transform:translateX(-50%)', 'z-index:10',
    'background:rgba(20,20,24,0.78)', 'color:#e8e8ec',
    'font:13px/1.4 -apple-system, system-ui, sans-serif',
    'padding:12px 16px', 'border-radius:8px',
    'border:1px solid #333', 'min-width:420px',
    'backdrop-filter:blur(6px)',
    'display:grid', 'grid-template-columns:auto 1fr auto',
    'gap:6px 12px', 'align-items:center',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'y² = x³ + f·x + g';
  title.style.cssText = 'grid-column:1 / -1;text-align:center;font-size:14px;margin-bottom:4px;color:#cdd2dc';
  root.appendChild(title);

  function makeSlider(name: string, min: number, max: number, step: number, initial: number) {
    const label = document.createElement('span');
    label.textContent = name;
    label.style.cssText = 'color:#8c8c95;font-size:12px;width:14px;text-align:right';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max);
    input.step = String(step); input.value = String(initial);
    input.style.cssText = 'width:100%';
    const valueEl = document.createElement('span');
    valueEl.style.cssText = 'font-variant-numeric:tabular-nums;color:#cdd2dc;font-size:12px;min-width:48px;text-align:right';
    valueEl.textContent = initial.toFixed(2);
    root.append(label, input, valueEl);
    return { input, valueEl };
  }

  const fSlider = makeSlider('f', -3, 3, 0.02, -1);
  const gSlider = makeSlider('g', -3, 3, 0.02, 1);

  const ptsLabel = document.createElement('span');
  ptsLabel.textContent = 'pts';
  ptsLabel.style.cssText = 'color:#8c8c95;font-size:12px;width:14px;text-align:right';
  const ptsInput = document.createElement('input');
  ptsInput.type = 'range';
  ptsInput.min = '500'; ptsInput.max = '50000'; ptsInput.step = '500';
  ptsInput.value = String(DEFAULT_POINTS);
  ptsInput.style.cssText = 'width:100%';
  const ptsValue = document.createElement('span');
  ptsValue.style.cssText = 'font-variant-numeric:tabular-nums;color:#cdd2dc;font-size:12px;min-width:48px;text-align:right';
  ptsValue.textContent = DEFAULT_POINTS.toLocaleString();
  root.append(ptsLabel, ptsInput, ptsValue);

  // View mode + rotation controls share one row.
  const viewRow = document.createElement('div');
  viewRow.style.cssText =
    'grid-column:1 / -1;display:flex;align-items:center;gap:14px;justify-content:center;margin-top:4px';

  const viewLabel = document.createElement('span');
  viewLabel.textContent = 'view';
  viewLabel.style.cssText = 'color:#8c8c95;font-size:12px';
  const viewSelect = document.createElement('select');
  viewSelect.style.cssText =
    'background:#1a1a1f;color:#e8e8ec;border:1px solid #444;border-radius:4px;padding:3px 6px;font:inherit';
  for (const [v, label] of [['toric', 'Toric (P²)'], ['affineR3', 'Affine R³']] as const) {
    const o = document.createElement('option');
    o.value = v; o.textContent = label;
    viewSelect.appendChild(o);
  }

  const rotRow = document.createElement('label');
  rotRow.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer';
  const rotCheck = document.createElement('input');
  rotCheck.type = 'checkbox';
  rotCheck.checked = rotating;
  rotRow.appendChild(rotCheck);
  const rotLabel = document.createElement('span');
  rotLabel.textContent = 'Rotate U(3)';
  rotRow.appendChild(rotLabel);

  viewRow.append(viewLabel, viewSelect, rotRow);
  root.appendChild(viewRow);

  viewSelect.onchange = () => applyView(viewSelect.value as ViewMode);

  const discNote = document.createElement('div');
  discNote.style.cssText = 'grid-column:1 / -1;color:#8c8c95;font-size:11px;text-align:center;min-height:14px';
  root.appendChild(discNote);

  const rootsBox = document.createElement('div');
  rootsBox.style.cssText =
    'grid-column:1 / -1;display:flex;justify-content:center;gap:18px;font-size:11px;font-variant-numeric:tabular-nums;margin-top:2px';
  const rootEls: HTMLSpanElement[] = [];
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('span');
    const [r, gr, b] = BRANCH_COLORS[i];
    el.style.color = `rgb(${Math.round(r * 255)}, ${Math.round(gr * 255)}, ${Math.round(b * 255)})`;
    rootsBox.appendChild(el);
    rootEls.push(el);
  }
  rootEls[3].textContent = '∞ = [0:1:0]';
  root.appendChild(rootsBox);

  onRootsUpdated = () => {
    for (let i = 0; i < 3; i++) {
      rootEls[i].textContent = lastRoots[i]
        ? `r${i + 1} = ${fmtComplex(lastRoots[i])}`
        : '';
    }
  };

  document.body.appendChild(root);

  let dirty = false;
  let rafScheduled = false;
  function scheduleResample(): void {
    dirty = true;
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      if (!dirty) return;
      dirty = false;
      const f = parseFloat(fSlider.input.value);
      const g = parseFloat(gSlider.input.value);
      const targetPts = parseInt(ptsInput.value, 10);
      sampleAndUpload(f, g, targetPts);
    });
  }

  const updateLive = () => {
    const f = parseFloat(fSlider.input.value);
    const g = parseFloat(gSlider.input.value);
    fSlider.valueEl.textContent = f.toFixed(2);
    gSlider.valueEl.textContent = g.toFixed(2);
    const disc = -(4 * f * f * f + 27 * g * g);
    discNote.textContent =
      Math.abs(disc) < 1e-2 ? `Δ ≈ 0 — curve is singular` : `Δ = ${disc.toFixed(3)}`;
    scheduleResample();
  };

  fSlider.input.addEventListener('input', updateLive);
  gSlider.input.addEventListener('input', updateLive);
  ptsInput.addEventListener('input', () => {
    ptsValue.textContent = parseInt(ptsInput.value, 10).toLocaleString();
    scheduleResample();
  });
  rotCheck.onchange = () => { rotating = rotCheck.checked; };

  updateLive();
}

buildOverlay();
app.start();
