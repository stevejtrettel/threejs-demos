/**
 * Genus-2 hyperelliptic curve  y² = ∏_{i=1..6} (x - rᵢ)  in P(1, 3, 1).
 *
 * The curve is sampled in the ambient CP² via the singular degree-6 embedding
 *   F(X, Y, Z) = Y²Z⁴ - ∏ (X - rᵢ Z) = 0,
 * then visualized through the weighted moment map of P(1, 3, 1):
 *   μ_w([X:Y:Z]) = (|X|², 3|Y|², |Z|²) / (|X|² + 3|Y|² + |Z|²).
 *
 * Branch points: the six roots rᵢ as points (rᵢ, 0) ∈ E, marked in a rainbow,
 * plus one ∞ marker at [0:1:0] (the singular point where both weighted-
 * projective infinity points of the smooth model collapse in this embedding).
 *
 * Lift loops: each adjacent pair (rᵢ, rᵢ₊₁) is lifted to a closed loop on E
 * by analytic continuation of √(∏(x - rⱼ)); five loops total.
 *
 * The rotation g(t) ∈ U(3) is taken from the ambient CP² (not the genuine
 * symmetry group of P(1,3,1), which is only U(2) × U(1) on the weight-1
 * coordinates). The "loose" interpretation: rotate vectors in C³, then apply
 * the weighted moment map. This gives a richer set of views at the cost of
 * not strictly preserving the P(1,3,1) structure.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { homoPoly, evaluateAtPoint, type HomoPoly } from '@/math/algebraic-curves/homopoly';
import { cAbs } from '@/math/algebraic-curves/complex';
import { findInitialPoint } from '@/math/algebraic-curves/initialPoint';
import { walkSample } from '@/math/algebraic-curves/sampler';
import { cp2Norm, type CP2Point } from '@/math/cp2/point';
import { TRIANGLE_VERTICES } from '@/math/cp2/momentMap';
import { composeU3Rotation, randomU3Speeds, type U3RotationSpeeds } from '@/math/cp2/u3';
import {
  toricProjection,
  affineR3Projection,
  type CP2Projection,
} from '@/math/cp2/projections';
import { CP2PointCloud } from '@/math/cp2/CP2PointCloud';
import { CP2Markers, type RGB } from '@/math/cp2/CP2Markers';

const WEIGHTS: [number, number, number] = [1, 3, 1];
const TORIC_PROJECTION = toricProjection(WEIGHTS);
const AFFINE_PROJECTION = affineR3Projection({ scale: 1.5 });

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

type ViewMode = 'toric' | 'affineR3';

// --- Scene components ---
const cloud = new CP2PointCloud({ projection: TORIC_PROJECTION, opacity: 0.7 });
app.scene.add(cloud);

const BRANCH_COLORS: RGB[] = [
  [1.00, 0.30, 0.30], // r1 red
  [1.00, 0.65, 0.20], // r2 orange
  [0.95, 0.95, 0.30], // r3 yellow
  [0.30, 0.95, 0.40], // r4 green
  [0.40, 0.55, 1.00], // r5 blue
  [0.85, 0.45, 1.00], // r6 magenta
  [1.00, 1.00, 1.00], // ∞ white
];
const POINT_AT_INFINITY: CP2Point = [
  { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 },
];
const markers = new CP2Markers({
  colors: BRANCH_COLORS,
  size: 0.022,
  projection: TORIC_PROJECTION,
});
app.scene.add(markers);

function applyView(mode: ViewMode): void {
  const proj: CP2Projection = mode === 'toric' ? TORIC_PROJECTION : AFFINE_PROJECTION;
  cloud.setProjection(proj);
  markers.setProjection(proj);
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

// --- Polynomial construction ---
function expandRootProduct(rs: number[]): number[] {
  let coeffs = [1];
  for (const r of rs) {
    const next = new Array(coeffs.length + 1).fill(0);
    for (let k = 0; k < coeffs.length; k++) {
      next[k + 1] += coeffs[k];
      next[k] += -r * coeffs[k];
    }
    coeffs = next;
  }
  return coeffs;
}

/** F = Y²Z^(n-2) - ∏(X - rᵢ Z) as a homogeneous polynomial of degree n. */
function hyperellipticPoly(rs: number[]): HomoPoly {
  const cs = expandRootProduct(rs);
  const n = rs.length;
  const terms: Array<[number, number, number, number]> = [
    [0, 2, n - 2, 1],
  ];
  for (let k = 0; k <= n; k++) {
    if (Math.abs(cs[k]) > 1e-15) terms.push([k, 0, n - k, -cs[k]]);
  }
  return homoPoly(n, terms);
}

// --- Sampling ---
const DEFAULT_POINTS = 12000;

function sampleAndUpload(rs: number[], targetPoints: number): void {
  // Sort roots first; downstream code (markers, lifts, colors) keys off sorted order.
  const sorted = [...rs].sort((a, b) => a - b);
  const F = hyperellipticPoly(sorted);
  const stepsNeeded = Math.max(
    1,
    Math.round((targetPoints - 1) / (F.degree - 1)),
  );

  let sampled: CP2Point[];
  try {
    const start = findInitialPoint(F);
    sampled = walkSample(F, start, { steps: stepsNeeded, branching: true });
  } catch (e) {
    console.warn('findInitialPoint failed:', e);
    return;
  }
  cloud.setPoints(sampled);

  const branchOnCurve = sorted.map((r) =>
    cp2Norm([{ re: r, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }]),
  );
  markers.setPoints([...branchOnCurve, POINT_AT_INFINITY]);

  let maxR = 0;
  for (const p of sampled) {
    const r = cAbs(evaluateAtPoint(F, p));
    if (r > maxR) maxR = r;
  }
  console.log(
    `roots [${sorted.map((r) => r.toFixed(2)).join(', ')}]  ` +
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
});

// --- UI overlay ---
function buildOverlay(): void {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%',
    'transform:translateX(-50%)', 'z-index:10',
    'background:rgba(20,20,24,0.78)', 'color:#e8e8ec',
    'font:13px/1.4 -apple-system, system-ui, sans-serif',
    'padding:12px 16px', 'border-radius:8px',
    'border:1px solid #333', 'min-width:440px',
    'backdrop-filter:blur(6px)',
    'display:grid', 'grid-template-columns:auto 1fr auto',
    'gap:5px 12px', 'align-items:center',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'y² = ∏ (x − rᵢ)   in   P(1, 3, 1)';
  title.style.cssText =
    'grid-column:1 / -1;text-align:center;font-size:14px;margin-bottom:4px;color:#cdd2dc';
  root.appendChild(title);

  const DEFAULT_ROOTS = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const rootSliders: HTMLInputElement[] = [];
  const rootValueEls: HTMLSpanElement[] = [];

  for (let i = 0; i < 6; i++) {
    const label = document.createElement('span');
    label.textContent = `r${i + 1}`;
    const [r, gr, b] = BRANCH_COLORS[i];
    label.style.cssText =
      `color:rgb(${Math.round(r * 255)}, ${Math.round(gr * 255)}, ${Math.round(b * 255)});` +
      `font-size:12px;width:18px;text-align:right`;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '-3'; input.max = '3'; input.step = '0.02';
    input.value = String(DEFAULT_ROOTS[i]);
    input.style.cssText = 'width:100%';

    const valueEl = document.createElement('span');
    valueEl.style.cssText =
      'font-variant-numeric:tabular-nums;color:#cdd2dc;font-size:12px;min-width:48px;text-align:right';
    valueEl.textContent = DEFAULT_ROOTS[i].toFixed(2);

    root.append(label, input, valueEl);
    rootSliders.push(input);
    rootValueEls.push(valueEl);
  }

  const ptsLabel = document.createElement('span');
  ptsLabel.textContent = 'pts';
  ptsLabel.style.cssText = 'color:#8c8c95;font-size:12px;width:18px;text-align:right';
  const ptsInput = document.createElement('input');
  ptsInput.type = 'range';
  ptsInput.min = '500'; ptsInput.max = '50000'; ptsInput.step = '500';
  ptsInput.value = String(DEFAULT_POINTS);
  ptsInput.style.cssText = 'width:100%';
  const ptsValue = document.createElement('span');
  ptsValue.style.cssText =
    'font-variant-numeric:tabular-nums;color:#cdd2dc;font-size:12px;min-width:48px;text-align:right';
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
  for (const [v, label] of [['toric', 'Toric P(1,3,1)'], ['affineR3', 'Affine R³']] as const) {
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
      const rs = rootSliders.map((el) => parseFloat(el.value));
      const targetPts = parseInt(ptsInput.value, 10);
      sampleAndUpload(rs, targetPts);
    });
  }

  for (let i = 0; i < 6; i++) {
    rootSliders[i].addEventListener('input', () => {
      rootValueEls[i].textContent = parseFloat(rootSliders[i].value).toFixed(2);
      scheduleResample();
    });
  }
  ptsInput.addEventListener('input', () => {
    ptsValue.textContent = parseInt(ptsInput.value, 10).toLocaleString();
    scheduleResample();
  });
  rotCheck.onchange = () => { rotating = rotCheck.checked; };

  scheduleResample();
}

buildOverlay();
app.start();
