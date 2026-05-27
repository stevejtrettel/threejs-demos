/**
 * Algebraic curve in CP^2 — toric (moment-map) image with U(3) rotation.
 *
 * Samples F = 0 by a random walk (random line through current point → solve
 * intersections numerically → branch to all d-1 new ones), then projects via
 * the moment map (|X|², |Y|², |Z|²) into the standard 2-simplex.
 *
 * UI: dropdown to switch curves, samples slider, checkbox to toggle rotation.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { evaluateAtPoint } from '@/math/algebraic-curves/homopoly';
import { cAbs } from '@/math/algebraic-curves/complex';
import { findInitialPoint } from '@/math/algebraic-curves/initialPoint';
import { walkSample } from '@/math/algebraic-curves/sampler';
import type { CP2Point } from '@/math/cp2/point';
import { TRIANGLE_VERTICES } from '@/math/cp2/momentMap';
import {
  composeU3Rotation,
  randomU3Speeds,
  type U3RotationSpeeds,
} from '@/math/cp2/u3';
import {
  toricProjection,
  affineR3Projection,
  type CP2Projection,
} from '@/math/cp2/projections';
import { CP2PointCloud } from '@/math/cp2/CP2PointCloud';
import { CURVES, type CurveDef } from '@/math/algebraic-curves/curveLibrary';

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
const TORIC_PROJECTION = toricProjection();
const AFFINE_PROJECTION = affineR3Projection({ scale: 1.5 });

// --- Point cloud component ---
const cloud = new CP2PointCloud({ projection: TORIC_PROJECTION, opacity: 0.7 });
app.scene.add(cloud);

function applyView(mode: ViewMode): void {
  const proj: CP2Projection = mode === 'toric' ? TORIC_PROJECTION : AFFINE_PROJECTION;
  cloud.setProjection(proj);
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

let currentDef: CurveDef = CURVES[0];

function loadCurve(def: CurveDef, targetPoints: number): void {
  currentDef = def;
  const stepsNeeded = Math.max(
    1,
    Math.round((targetPoints - 1) / Math.max(1, def.F.degree - 1)),
  );
  const start = findInitialPoint(def.F);
  const sampled: CP2Point[] = walkSample(def.F, start, {
    steps: stepsNeeded,
    branching: true,
  });
  cloud.setPoints(sampled);

  let maxR = 0;
  for (const p of sampled) {
    const r = cAbs(evaluateAtPoint(def.F, p));
    if (r > maxR) maxR = r;
  }
  console.log(`[${def.label}] ${sampled.length} pts, maxRes=${maxR.toExponential(2)}`);
}

// --- Rotation state ---
const speeds: U3RotationSpeeds = randomU3Speeds();
let rotating = true;
let phase = 0;

app.addAnimateCallback((_time: number, delta: number) => {
  if (rotating) phase += delta;
  cloud.project(composeU3Rotation(phase, speeds));
});

// --- Overlay menu ---
function buildOverlay(): void {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'z-index:10',
    'background:rgba(20,20,24,0.78)', 'color:#e8e8ec',
    'font:13px/1.4 -apple-system, system-ui, sans-serif',
    'padding:10px 12px', 'border-radius:8px',
    'border:1px solid #333', 'min-width:280px',
    'backdrop-filter:blur(6px)',
  ].join(';');

  const label = document.createElement('div');
  label.textContent = 'Curve';
  label.style.cssText =
    'font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8c8c95;margin-bottom:4px';
  root.appendChild(label);

  const select = document.createElement('select');
  select.style.cssText = [
    'width:100%', 'background:#1a1a1f', 'color:#e8e8ec',
    'border:1px solid #444', 'border-radius:4px',
    'padding:5px 6px', 'font:inherit', 'margin-bottom:10px',
  ].join(';');
  CURVES.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = c.label;
    select.appendChild(opt);
  });

  const note = document.createElement('div');
  note.style.cssText = 'color:#8c8c95;font-size:11px;margin-bottom:10px;min-height:14px';

  const samplesRow = document.createElement('div');
  samplesRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
  const samplesLabel = document.createElement('span');
  samplesLabel.style.cssText = 'font-size:11px;color:#8c8c95;min-width:56px';
  const samplesSlider = document.createElement('input');
  samplesSlider.type = 'range';
  samplesSlider.min = '500'; samplesSlider.max = '50000'; samplesSlider.step = '500';
  samplesSlider.style.cssText = 'flex:1';
  samplesRow.append(samplesLabel, samplesSlider);

  const updateSamplesLabel = (points: number) => {
    samplesLabel.textContent = `${points.toLocaleString()} pts`;
  };

  // View mode + rotation controls share one row.
  const viewRow = document.createElement('div');
  viewRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:2px';

  const viewLabel = document.createElement('span');
  viewLabel.textContent = 'view';
  viewLabel.style.cssText = 'color:#8c8c95;font-size:11px';
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

  root.append(select, note, samplesRow, viewRow);
  document.body.appendChild(root);

  viewSelect.onchange = () => applyView(viewSelect.value as ViewMode);

  const applyIndex = (idx: number) => {
    const def = CURVES[idx];
    note.textContent = def.note ?? '';
    samplesSlider.value = String(def.defaultPoints);
    updateSamplesLabel(def.defaultPoints);
    loadCurve(def, def.defaultPoints);
  };

  select.onchange = () => applyIndex(parseInt(select.value, 10));
  rotCheck.onchange = () => { rotating = rotCheck.checked; };
  samplesSlider.addEventListener('input', () => {
    updateSamplesLabel(parseInt(samplesSlider.value, 10));
  });
  samplesSlider.addEventListener('change', () => {
    loadCurve(currentDef, parseInt(samplesSlider.value, 10));
  });

  const defaultIdx = CURVES.findIndex((c) => c.label.startsWith('Weierstrass'));
  const startIdx = defaultIdx >= 0 ? defaultIdx : 0;
  select.value = String(startIdx);
  applyIndex(startIdx);
}

buildOverlay();
app.start();
