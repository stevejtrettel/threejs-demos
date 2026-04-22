/**
 * Parabola over F_p Demo
 *
 * Visualizes solutions to y = x² on the affine plane F_p × F_p,
 * rendered as spheres on a grid.
 */

import * as THREE from 'three';
import { PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { App } from '@/app/App';
import { FiniteField } from '@/math/algebra/finiteField';
import { ProjectivePlane, gridEmbedding, scaledTorusEmbedding } from '@/math/algebra/ProjectivePlane';
import { ProjectivePlaneMesh } from '@/math/algebra/ProjectivePlaneMesh';

// --- Parameters (edit and refresh) ---

const p = 97; // prime for the finite field
const torusMode = true; // toggle between flat grid and torus

const scale = p / 11; // scale everything relative to p=11 baseline

// --- App setup ---

const app = new App({
  antialias: true,
  pathTracerDefaults: { bounces: 30, samples: 1 },
});

app.camera.position.set(0, torusMode ? 8 * scale : 14 * scale, torusMode ? -12 * scale : 0);
app.controls.target.set(0, 0, 0);

// Environment
const envTexture = new GradientEquirectTexture();
envTexture.bottomColor.set(0xffffff);
envTexture.topColor.set(0x666666);
envTexture.update();
app.scene.environment = envTexture;
app.scene.background = envTexture;

// Spot light
const spotLight = new PhysicalSpotLight(0xffffff);
spotLight.position.set(2, 10 * scale, 0);
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

const field = new FiniteField(p);
// y = x² homogenized: YZ = X² → X² - YZ = 0
const solutions = field.solveProjective((X, Y, Z) => X * X - Y * Z);

console.log(`F_${p}: found ${solutions.length} projective solutions to y = x²`);
console.log('Solutions:', solutions);

// --- Grid visualization ---

const embedding = torusMode ? scaledTorusEmbedding(scale) : gridEmbedding;
const plane = new ProjectivePlane(field, embedding);

const mesh = new ProjectivePlaneMesh(plane, {
  layers: [{
    points: solutions,
    material: new THREE.MeshPhysicalMaterial({
      color: 0x3478e3, clearcoat: 1, roughness: 0.1, metalness: 0.3,
    }),
    radius: 0.6,
  }],
  bgRadius: 0.08,
  showGridLines: true,
});
mesh.rotation.y = Math.PI;
app.scene.add(mesh);

// --- Ground plane ---

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(100, 0.1, 100),
  new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5 }),
);
ground.position.set(0, -2 * scale, 0);
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
