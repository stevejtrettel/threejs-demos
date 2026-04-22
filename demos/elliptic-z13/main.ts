/**
 * Elliptic Curve y² = x³ + 3x over F_13 — Group law illustration
 *
 * j-invariant 1728, CM by Z[i]. Since 13 ≡ 1 (mod 4),
 * we can write 13 = 2² + 3² and the point count deviates from p+1.
 *
 * Step through the group law with a slider:
 *   1. Elliptic curve
 *   2. + chosen points P, Q
 *   3. + line through P, Q
 *   4. + third intersection R
 *   5. + reflection -R = P + Q
 */

import * as THREE from 'three';
import { PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { App } from '@/app/App';
import { FiniteField } from '@/math/algebra/finiteField';
import { ProjectivePlane, gridEmbedding } from '@/math/algebra/ProjectivePlane';
import { ProjectivePlaneMesh } from '@/math/algebra/ProjectivePlaneMesh';
import type { PointLayer, LineSpec } from '@/math/algebra/ProjectivePlaneMesh';

// --- App setup ---

const app = new App({
  antialias: true,
  pathTracerDefaults: { bounces: 30, samples: 1 },
});

app.camera.position.set(0, 18, 0);
app.controls.target.set(0, 0, 0);
app.camera.up.set(0, 0, 1);

// Environment
const envTexture = new GradientEquirectTexture();
envTexture.bottomColor.set(0xffffff);
envTexture.topColor.set(0x666666);
envTexture.update();
app.scene.environment = envTexture;
app.scene.background = envTexture;

// Spot light
const spotLight = new PhysicalSpotLight(0xffffff);
spotLight.position.set(2, 14, 0);
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 3.0;
spotLight.radius = 0.5;
spotLight.castShadow = true;
app.scene.add(spotLight);

const spotTarget = spotLight.target;
spotTarget.position.set(0, 0, 0);
app.scene.add(spotTarget);

// --- Finite field and equation ---

const p = 13;
const a = 3; // y² = x³ + 3x (mod 13)
const b = 0;

const field = new FiniteField(p);
const solutions = field.solveProjective(
  (X, Y, Z) => Y * Y * Z - (X * X * X + a * X * Z * Z + b * Z * Z * Z),
);

// --- Group law data ---

const P: [number, number] = [-5, 4];
const Q: [number, number] = [-1, -3];
const R: [number, number] = [5, 6];       // third intersection
const negR: [number, number] = [5, -6];   // reflection = P + Q
const lineThruPQ = field.projectiveLine([P[0], P[1], 1], [Q[0], Q[1], 1]);

// --- Materials ---

const curveMat = new THREE.MeshPhysicalMaterial({
  color: 0xe34034, clearcoat: 1, roughness: 0.1, metalness: 0.3,
});
const pqMat = new THREE.MeshPhysicalMaterial({
  color: 0x3478e3, clearcoat: 1, roughness: 0.1, metalness: 0.3,
});
const lineMat = new THREE.MeshPhysicalMaterial({
  color: 0xf5c542, clearcoat: 1, roughness: 0.1, metalness: 0.3,
});
const purpleMat = new THREE.MeshPhysicalMaterial({
  color: 0x9b59b6, clearcoat: 1, roughness: 0.1, metalness: 0.3,
});

// --- Layer definitions for each step ---

const stepLayers: PointLayer[][] = [
  // Step 1: curve only
  [
    { points: solutions, material: curveMat, radius: 0.2 },
  ],
  // Step 2: + P and Q
  [
    { points: solutions, material: curveMat, radius: 0.2 },
    { points: [P, Q], material: pqMat, radius: 0.3 },
  ],
  // Step 3: + line through P, Q
  [
    { points: solutions, material: curveMat, radius: 0.2 },
    { points: lineThruPQ, material: lineMat, radius: 0.18 },
    { points: [P, Q], material: pqMat, radius: 0.3 },
  ],
  // Step 4: + third intersection R
  [
    { points: solutions, material: curveMat, radius: 0.2 },
    { points: lineThruPQ, material: lineMat, radius: 0.18 },
    { points: [[R[0], R[1], 1] as [number, number, number]], material: purpleMat, radius: 0.3 },
    { points: [P, Q], material: pqMat, radius: 0.3 },
  ],
  // Step 5: + reflection -R = P + Q, including [0:1:0] on the vertical line
  [
    { points: solutions, material: curveMat, radius: 0.2 },
    { points: lineThruPQ, material: lineMat, radius: 0.18 },
    { points: [[R[0], R[1], 1], [negR[0], negR[1], 1], [0, 1, 0]] as [number, number, number][], material: purpleMat, radius: 0.3 },
    { points: [P, Q], material: pqMat, radius: 0.3 },
  ],
];

// --- Visual lines for each step (empty = no lines drawn) ---

const pqLine: LineSpec = {
  from: [P[0], P[1], 1], to: [Q[0], Q[1], 1],
  material: lineMat, radius: 0.04,
};
const reflectLine: LineSpec = {
  from: [R[0], R[1], 1], to: [negR[0], negR[1], 1],
  material: purpleMat, radius: 0.04,
};

const stepLines: LineSpec[][] = [
  [],                   // Step 1: curve only
  [],                   // Step 2: + P, Q
  [pqLine],             // Step 3: + line through P, Q
  [pqLine],             // Step 4: + third intersection R
  [pqLine, reflectLine], // Step 5: + reflection
];

const stepLabels = [
  'E(F₁₃): y² = x³ + 3x',
  'Choose P, Q',
  'Line through P, Q',
  'Third intersection R',
  'Reflect: P + Q = −R',
];

// --- Grid visualization ---

const plane = new ProjectivePlane(field, gridEmbedding);
let currentMesh: ProjectivePlaneMesh | null = null;

function buildStep(step: number) {
  if (currentMesh) {
    app.scene.remove(currentMesh);
    currentMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }
  currentMesh = new ProjectivePlaneMesh(plane, {
    layers: stepLayers[step],
    lines: stepLines[step],
    bgRadius: 0.1,
    showGridLines: true,
  });
  app.scene.add(currentMesh);
}

buildStep(0);

// --- Slider UI ---

const container = document.createElement('div');
Object.assign(container.style, {
  position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
  zIndex: '1000', display: 'flex', alignItems: 'center', gap: '12px',
  background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: '8px',
});

const label = document.createElement('span');
Object.assign(label.style, { color: '#fff', fontSize: '14px', minWidth: '200px' });
label.textContent = stepLabels[0];

const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = String(stepLayers.length - 1);
slider.value = '0';
slider.step = '1';
Object.assign(slider.style, { width: '200px' });

slider.addEventListener('input', () => {
  const step = parseInt(slider.value);
  label.textContent = stepLabels[step];
  buildStep(step);
});

container.appendChild(slider);
container.appendChild(label);
document.body.appendChild(container);

// --- Ground plane ---

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(100, 0.1, 100),
  new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5 }),
);
ground.position.set(0, -2, 0);
app.scene.add(ground);

// --- Path tracer toggle ---

const btn = document.createElement('button');
btn.textContent = 'Path Trace';
Object.assign(btn.style, {
  position: 'fixed', bottom: '20px', right: '20px', zIndex: '1000',
  padding: '8px 16px', background: '#333', color: '#fff', border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontSize: '14px',
});
let ptEnabled = false;
btn.addEventListener('click', () => {
  ptEnabled = !ptEnabled;
  if (ptEnabled) {
    app.enablePathTracing();
    btn.textContent = 'WebGL';
  } else {
    app.disablePathTracing();
    btn.textContent = 'Path Trace';
  }
});
document.body.appendChild(btn);

app.start();
