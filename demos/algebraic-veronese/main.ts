/**
 * Veronese embeddings of CP² curves, projected to R³.
 *
 * Same sampled cloud as `algebraic-curve-cp2`, but viewed through a
 * degree-d Veronese embedding ν_d: CP² → CP^N into higher codim, then
 * projected down to R³.
 *
 *   Veronese-2:  CP² → CP⁵  (curve in real 10D)
 *   Veronese-3:  CP² → CP⁹  (curve in real 18D)
 *
 * Two projection methods:
 *
 *   - PCA-aligned: 3 directions of greatest variance in the Veronese-mapped
 *     point cloud. Preserves the most curve structure under projection.
 *   - Random: uniform random orthonormal 3-plane in R^(2N+2). By concentration
 *     of measure these tend to look Gaussian-blob-y; pressing 'reroll' samples
 *     a new direction.
 *
 * The U(3) rotation continues to act on the underlying CP² point before the
 * Veronese map, so as the cloud rotates the curve moves through the fixed
 * projection.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { evaluateAtPoint } from '@/math/algebraic-curves/homopoly';
import { cAbs } from '@/math/algebraic-curves/complex';
import { findInitialPoint } from '@/math/algebraic-curves/initialPoint';
import { walkSample } from '@/math/algebraic-curves/sampler';
import type { CP2Point } from '@/math/cp2/point';
import {
  composeU3Rotation,
  randomU3Speeds,
  type U3RotationSpeeds,
} from '@/math/cp2/u3';
import {
  affineR3Projection,
  veroneseR3Projection,
  veronesePcaR3Projection,
  cp3TetrahedronProjection,
  projectorPcaR3Projection,
  TETRAHEDRON_VERTICES,
  type CP2Projection,
} from '@/math/cp2/projections';
import { CP2PointCloud } from '@/math/cp2/CP2PointCloud';
import {
  CURVES,
  type CurveDef,
} from '@/math/algebraic-curves/curveLibrary';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0x0a0a0a);
app.camera.position.set(2.5, 2.0, 3.0);
app.controls.target.set(0, 0, 0);

// --- Point cloud component ---
const cloud = new CP2PointCloud({ opacity: 0.7 });
app.scene.add(cloud);

// --- Tetrahedron outline (visible only in tetrahedron mode) ---
const tetraEdgeIndices: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];
const tetraPositions = new Float32Array(tetraEdgeIndices.length * 6);
for (let i = 0; i < tetraEdgeIndices.length; i++) {
  const [a, b] = tetraEdgeIndices[i];
  tetraPositions[i * 6 + 0] = TETRAHEDRON_VERTICES[a][0];
  tetraPositions[i * 6 + 1] = TETRAHEDRON_VERTICES[a][1];
  tetraPositions[i * 6 + 2] = TETRAHEDRON_VERTICES[a][2];
  tetraPositions[i * 6 + 3] = TETRAHEDRON_VERTICES[b][0];
  tetraPositions[i * 6 + 4] = TETRAHEDRON_VERTICES[b][1];
  tetraPositions[i * 6 + 5] = TETRAHEDRON_VERTICES[b][2];
}
const tetraGeom = new THREE.BufferGeometry();
tetraGeom.setAttribute('position', new THREE.BufferAttribute(tetraPositions, 3));
const tetraOutline = new THREE.LineSegments(
  tetraGeom,
  new THREE.LineBasicMaterial({ color: 0x555555 }),
);
tetraOutline.visible = false;
app.scene.add(tetraOutline);

// --- State ---
type Embedding = 'none' | 'tetrahedron' | 2 | 3 | 'proj1' | 'proj2' | 'proj3';
let currentDef: CurveDef = CURVES[0];
let currentSamples: CP2Point[] = [];
let embedding: Embedding = 'none';
let projectionMethod: 'pca' | 'random' = 'pca';

function buildProjection(): CP2Projection {
  if (embedding === 'none') {
    return affineR3Projection({ scale: 1.5 });
  }
  if (embedding === 'tetrahedron') {
    return cp3TetrahedronProjection();
  }
  if (embedding === 'proj1' || embedding === 'proj2' || embedding === 'proj3') {
    const deg = embedding === 'proj1' ? 1 : embedding === 'proj2' ? 2 : 3;
    return projectorPcaR3Projection({
      degree: deg as 1 | 2 | 3,
      samples: currentSamples,
      scale: 1.5,
    });
  }
  if (projectionMethod === 'pca') {
    return veronesePcaR3Projection({
      degree: embedding,
      samples: currentSamples,
      scale: 1.5,
    });
  }
  return veroneseR3Projection({ degree: embedding, scale: 1.5 });
}

function syncSceneForEmbedding(): void {
  tetraOutline.visible = embedding === 'tetrahedron';
}

function refreshProjection(): void {
  cloud.setProjection(buildProjection());
}

function loadCurve(def: CurveDef, targetPoints: number): void {
  currentDef = def;
  const stepsNeeded = Math.max(
    1,
    Math.round((targetPoints - 1) / Math.max(1, def.F.degree - 1)),
  );
  const start = findInitialPoint(def.F);
  currentSamples = walkSample(def.F, start, {
    steps: stepsNeeded,
    branching: true,
  });
  cloud.setPoints(currentSamples);
  refreshProjection();

  let maxR = 0;
  for (const p of currentSamples) {
    const r = cAbs(evaluateAtPoint(def.F, p));
    if (r > maxR) maxR = r;
  }
  const embedLabel =
    embedding === 'none'
      ? 'affine C²'
      : embedding === 'tetrahedron'
        ? 'tetrahedron CP³'
        : `ν${embedding} ${projectionMethod}`;
  console.log(
    `[${def.label}] ${embedLabel}: ${currentSamples.length} pts, ` +
      `maxRes=${maxR.toExponential(2)}`,
  );
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
    'border:1px solid #333', 'min-width:300px',
    'backdrop-filter:blur(6px)',
  ].join(';');

  const label = (text: string) => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8c8c95;margin:6px 0 3px';
    return el;
  };

  const selectStyle = [
    'width:100%', 'background:#1a1a1f', 'color:#e8e8ec',
    'border:1px solid #444', 'border-radius:4px',
    'padding:5px 6px', 'font:inherit',
  ].join(';');

  // --- Curve dropdown ---
  root.appendChild(label('Curve'));
  const curveSelect = document.createElement('select');
  curveSelect.style.cssText = selectStyle;
  CURVES.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = c.label;
    curveSelect.appendChild(opt);
  });

  const note = document.createElement('div');
  note.style.cssText = 'color:#8c8c95;font-size:11px;margin-top:4px;min-height:14px';

  root.append(curveSelect, note);

  // --- Embedding ---
  root.appendChild(label('Embedding'));
  const degreeSelect = document.createElement('select');
  degreeSelect.style.cssText = selectStyle;
  for (const [v, t] of [
    ['none', 'None — affine C² ⊂ CP²'],
    ['tetrahedron', 'Tetrahedron CP³ (linear + FS moment)'],
    ['2', 'ν₂ PCA (CP⁵ → R³)'],
    ['3', 'ν₃ PCA (CP⁹ → R³)'],
    ['proj1', 'Projector (CP² → R⁹ → R³)'],
    ['proj2', 'Projector ∘ ν₂ (CP⁵ → R³⁶ → R³)'],
    ['proj3', 'Projector ∘ ν₃ (CP⁹ → R¹⁰⁰ → R³)'],
  ] as const) {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    degreeSelect.appendChild(o);
  }
  root.appendChild(degreeSelect);

  // --- Projection method ---
  root.appendChild(label('Projection method'));
  const methodSelect = document.createElement('select');
  methodSelect.style.cssText = selectStyle;
  for (const [v, t] of [
    ['pca', 'PCA-aligned (data-driven)'],
    ['random', 'Random 3-plane'],
  ] as const) {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    methodSelect.appendChild(o);
  }
  root.appendChild(methodSelect);

  // --- Reroll button (only meaningful for random projections) ---
  const rerollBtn = document.createElement('button');
  rerollBtn.textContent = 'New random projection';
  rerollBtn.style.cssText = [
    'margin-top:8px', 'width:100%',
    'background:#2a2a35', 'color:#e8e8ec',
    'border:1px solid #444', 'border-radius:4px',
    'padding:5px', 'font:inherit', 'cursor:pointer',
  ].join(';');
  rerollBtn.onmouseenter = () => (rerollBtn.style.background = '#363645');
  rerollBtn.onmouseleave = () => (rerollBtn.style.background = '#2a2a35');
  root.appendChild(rerollBtn);

  // --- Points slider ---
  root.appendChild(label('Sample points'));
  const samplesRow = document.createElement('div');
  samplesRow.style.cssText = 'display:flex;align-items:center;gap:8px';
  const samplesLabel = document.createElement('span');
  samplesLabel.style.cssText = 'font-size:11px;color:#8c8c95;min-width:56px';
  const samplesSlider = document.createElement('input');
  samplesSlider.type = 'range';
  samplesSlider.min = '500'; samplesSlider.max = '50000'; samplesSlider.step = '500';
  samplesSlider.style.cssText = 'flex:1';
  samplesRow.append(samplesLabel, samplesSlider);
  root.appendChild(samplesRow);

  const updateSamplesLabel = (n: number) => {
    samplesLabel.textContent = `${n.toLocaleString()} pts`;
  };

  // --- Rotation checkbox ---
  const rotRow = document.createElement('label');
  rotRow.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:10px';
  const rotCheck = document.createElement('input');
  rotCheck.type = 'checkbox';
  rotCheck.checked = rotating;
  rotRow.appendChild(rotCheck);
  const rotLabel = document.createElement('span');
  rotLabel.textContent = 'Rotate through U(3)';
  rotRow.appendChild(rotLabel);
  root.appendChild(rotRow);

  document.body.appendChild(root);

  // --- Wire ---
  const applyCurveIndex = (idx: number) => {
    const def = CURVES[idx];
    note.textContent = def.note ?? '';
    samplesSlider.value = String(def.defaultPoints);
    updateSamplesLabel(def.defaultPoints);
    loadCurve(def, def.defaultPoints);
  };

  const syncEnabled = () => {
    // Only the plain Veronese modes (2, 3) support PCA vs Random toggle.
    const hasMethod = embedding === 2 || embedding === 3;
    const isRandom = hasMethod && projectionMethod === 'random';
    methodSelect.disabled = !hasMethod;
    methodSelect.style.opacity = hasMethod ? '1' : '0.4';
    rerollBtn.disabled = !isRandom;
    rerollBtn.style.opacity = isRandom ? '1' : '0.4';
  };

  curveSelect.onchange = () => applyCurveIndex(parseInt(curveSelect.value, 10));
  degreeSelect.onchange = () => {
    const v = degreeSelect.value;
    embedding =
      v === 'none' ? 'none' :
      v === 'tetrahedron' ? 'tetrahedron' :
      v === '2' ? 2 :
      v === '3' ? 3 :
      v as Embedding;
    syncSceneForEmbedding();
    syncEnabled();
    refreshProjection();
  };
  methodSelect.onchange = () => {
    projectionMethod = methodSelect.value as 'pca' | 'random';
    syncEnabled();
    refreshProjection();
  };
  rerollBtn.onclick = () => {
    if (embedding !== 'none' && projectionMethod === 'random') refreshProjection();
  };
  samplesSlider.addEventListener('input', () => {
    updateSamplesLabel(parseInt(samplesSlider.value, 10));
  });
  samplesSlider.addEventListener('change', () => {
    loadCurve(currentDef, parseInt(samplesSlider.value, 10));
  });
  rotCheck.onchange = () => { rotating = rotCheck.checked; };

  // Default: Weierstrass cubic, embedding = none (affine C²).
  const defaultIdx = CURVES.findIndex((c) => c.label.startsWith('Weierstrass'));
  const startIdx = defaultIdx >= 0 ? defaultIdx : 0;
  curveSelect.value = String(startIdx);
  degreeSelect.value = 'none';
  syncSceneForEmbedding();
  syncEnabled();
  applyCurveIndex(startIdx);
}

buildOverlay();
app.start();
