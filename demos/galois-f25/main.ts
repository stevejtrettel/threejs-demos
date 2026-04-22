/**
 * F_25 Galois Orbits
 *
 * Visualizes F_25 = F_5[α]/(α² + α + 1) as a 5×5 grid.
 * Ground field F_5 (fixed by Frobenius) in red.
 * Each Galois orbit {x, x⁵} gets a distinct color.
 */

import * as THREE from 'three';
import { PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { App } from '@/app/App';
import { FiniteField } from '@/math/algebra/finiteField';
import { FiniteFieldExtension } from '@/math/algebra/finiteFieldExtension';
import { ProjectivePlane, torusEmbedding } from '@/math/algebra/ProjectivePlane';
import { ProjectivePlaneMesh } from '@/math/algebra/ProjectivePlaneMesh';
import type { PointLayer } from '@/math/algebra/ProjectivePlaneMesh';

// --- App setup ---

const app = new App({
  antialias: true,
  pathTracerDefaults: { bounces: 30, samples: 1 },
});

app.camera.position.set(0, 4, -6);
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

// --- F_25 = F_5[α]/(α² + α + 1) ---

const base = new FiniteField(5);
const ext = new FiniteFieldExtension(base, 1, 1); // α² + α + 1 = 0
const { baseField, orbits } = ext.galoisOrbits();

console.log(`F_25: ${baseField.length} ground field elements, ${orbits.length} Galois orbits of size 2`);

// --- Build layers ---

const layers: PointLayer[] = [];

// Ground field — red, larger
layers.push({
  points: baseField,
  material: new THREE.MeshPhysicalMaterial({
    color: 0xe34034, clearcoat: 1, roughness: 0.1, metalness: 0.3,
  }),
  radius: 0.3,
});

// Galois orbits — distinct colors from HSL wheel, avoiding red
for (let i = 0; i < orbits.length; i++) {
  const hue = (30 + i * 30) / 360;
  const color = new THREE.Color().setHSL(hue, 0.8, 0.55);
  layers.push({
    points: orbits[i],
    material: new THREE.MeshPhysicalMaterial({
      color, clearcoat: 1, roughness: 0.1, metalness: 0.3,
    }),
    radius: 0.25,
  });
}

// --- Grid visualization ---

const plane = new ProjectivePlane(base, torusEmbedding);

const mesh = new ProjectivePlaneMesh(plane, {
  layers,
  bgRadius: 0.1,
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
