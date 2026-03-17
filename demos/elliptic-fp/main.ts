/**
 * Elliptic Curve over F_p Demo
 *
 * Visualizes solutions to y² = x³ + ax + b on the projective plane P²(F_p),
 * rendered as spheres on a torus (or grid).
 */

import * as THREE from 'three';
import { PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { App } from '@/app/App';
import { FiniteField } from '@/math/algebra/finiteField';
import { ProjectivePlane, gridEmbedding } from '@/math/algebra/ProjectivePlane';
import { ProjectivePlaneMesh } from '@/math/algebra/ProjectivePlaneMesh';

// --- App setup ---

const app = new App({
  antialias: true,
  pathTracerDefaults: { bounces: 30, samples: 1 },
});

app.camera.position.set(0, 8, -12);
app.controls.target.set(0, 0, 0);

// Environment (works with both WebGL and path tracer)
const envTexture = new GradientEquirectTexture();
envTexture.bottomColor.set(0xffffff);
envTexture.topColor.set(0x666666);
envTexture.update();
app.scene.environment = envTexture;
app.scene.background = envTexture;

// Physical spot light (works with path tracer)
const spotLight = new PhysicalSpotLight(0xffffff);
spotLight.position.set(2, 10, 0);
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

const p = 11;
const a = 5; // y² = x³ + 5x + 7 (mod 11)
const b = 7;

const field = new FiniteField(p);
const solutions = field.solve((x, y) => y * y - (x * x * x + a * x + b));

console.log(`F_${p}: found ${solutions.length} solutions to y² = x³ + ${a}x + ${b}`);
console.log('Solutions:', solutions);

// --- Projective plane ---

// Swap to gridEmbedding for the grid view
const plane = new ProjectivePlane(field, gridEmbedding);

const mesh = new ProjectivePlaneMesh(plane, {
  solutions,
  solutionMaterial: new THREE.MeshPhysicalMaterial({
    color: 0x3478e3,
    clearcoat: 1,
    roughness: 0.1,
    metalness: 0.3,
  }),
  showInfinity: true,
  infinityPosition: [7, 0, 0],
  solutionRadius: 0.2,
  bgRadius: 0.12,
  showGridLines: true,
});
app.scene.add(mesh);

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
