/**
 * Omega Design — Pseudosphere
 *
 * Aluminum omega weave on a pseudosphere (surface of constant negative curvature).
 */

import { App } from '@/app/App';
import { integrate } from '@/math';
import { analyzeMesh } from '@/math/weave/analyzeMesh';
import { generateStrands } from '@/math/weave/generateStrands';
import { omegaDesign } from '@/math/weave/designs/omegaDesign';
import type { ParsedMesh } from '@/math/mesh/parseOBJ';
import * as THREE from 'three';
import { PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { Panel } from '@/ui/containers/Panel';
import { Button } from '@/ui/inputs/Button';
import '@/ui/styles/index.css';

// --- Pseudosphere quad mesh (surface of revolution from ODE profile) ---

function makePseudosphereMesh(uMax: number, nTheta: number, nV: number): ParsedMesh {
  const NUM_STEPS = 400;

  // Solve profile ODE: r(u) = 1/u, h'(u) = (1/u) sqrt(1 - 1/u²)
  const { states, times } = integrate({
    deriv: (_state: number[], t: number) => {
      const u = 1 + t;
      const u2 = u * u;
      return [(1 / u) * Math.sqrt(Math.max(0, 1 - 1 / u2))];
    },
    initial: [0],
    dt: (uMax - 1) / NUM_STEPS,
    steps: NUM_STEPS,
  });

  // Sample profile at nV+1 evenly spaced parameter values
  const profileR: number[] = [];
  const profileH: number[] = [];
  for (let j = 0; j <= nV; j++) {
    const idx = (j / nV) * (NUM_STEPS);
    const i0 = Math.min(Math.floor(idx), NUM_STEPS - 1);
    const i1 = Math.min(i0 + 1, NUM_STEPS);
    const frac = idx - i0;
    const h = states[i0][0] * (1 - frac) + states[i1][0] * frac;
    const t = times[i0] * (1 - frac) + times[i1] * frac;
    const u = 1 + t;
    profileR.push(1 / u);
    profileH.push(h);
  }

  // Build vertices by revolving profile around Y axis
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < nTheta; i++) {
    const theta = (i / nTheta) * 2 * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let j = 0; j <= nV; j++) {
      vertices.push(new THREE.Vector3(
        profileR[j] * cosT,
        profileH[j],
        profileR[j] * sinT,
      ));
    }
  }

  // Build quad faces (closed in theta, open in v)
  const faces: number[][] = [];
  const stride = nV + 1;
  for (let i = 0; i < nTheta; i++) {
    for (let j = 0; j < nV; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = ((i + 1) % nTheta) * stride + j + 1;
      const d = ((i + 1) % nTheta) * stride + j;
      faces.push([a, b, c, d]);
    }
  }

  return { vertices, faces };
}

// --- App setup ---

const app = new App({
  antialias: true,
  debug: true,
  pathTracerDefaults: { bounces: 10, samples: 1 },
});

app.camera.position.set(0, 1.5, 3.5);
app.controls.target.set(0, 0.4, 0);

// --- Environment ---

const envTexture = new GradientEquirectTexture();
envTexture.topColor.set(0xddeeff);
envTexture.bottomColor.set(0xffffff);
envTexture.update();
app.scene.environment = envTexture;
app.scene.background = envTexture;

// --- White floor ---

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.1,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5;
app.scene.add(floor);

// --- Lighting ---

function createSpot(color: number, intensity: number, pos: THREE.Vector3): PhysicalSpotLight {
  const light = new PhysicalSpotLight(color);
  light.position.copy(pos);
  light.angle = Math.PI / 4;
  light.decay = 0;
  light.penumbra = 0.8;
  light.intensity = intensity;
  light.radius = 0.25;
  light.castShadow = true;
  light.target.position.set(0, 0.4, 0);
  return light;
}

const keyLight = createSpot(0xffeedd, 5, new THREE.Vector3(-4, 6, 4));
app.scene.add(keyLight);
app.scene.add(keyLight.target);

const fillLight = createSpot(0xddeeff, 2.5, new THREE.Vector3(5, 4, 2));
app.scene.add(fillLight);
app.scene.add(fillLight.target);

const rimLight = createSpot(0xffffff, 3, new THREE.Vector3(0, 5, -4));
app.scene.add(rimLight);
app.scene.add(rimLight.target);

const previewLight = new THREE.DirectionalLight(0xffffff, 1.5);
previewLight.position.set(3, 6, 4);
app.scene.add(previewLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
app.scene.add(ambientLight);

// --- Build omega on pseudosphere ---

const pseudosphereMesh = makePseudosphereMesh(6, 48, 32);

const analysis = analyzeMesh(pseudosphereMesh, omegaDesign.families);
const result = generateStrands(analysis, omegaDesign, {
  amplitude: 0.15,
  samplesPerLoop: 32,
  archHeight: 1.5,
});

// --- Aluminum material ---

const strandMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x8a8a90,
  roughness: 0.3,
  metalness: 0.9,
  clearcoat: 0.4,
  clearcoatRoughness: 0.2,
});

// --- Render strands as tubes (radius from average face area) ---

const tubeScale = 0.08;

for (let i = 0; i < result.strands.length; i++) {
  const strand = result.strands[i];
  if (strand.length < 2) continue;

  const radii = result.strandRadii?.[i];
  const radius = radii
    ? tubeScale * (radii.reduce((a, b) => a + b, 0) / radii.length)
    : 0.012;

  const curve = new THREE.CatmullRomCurve3(strand, result.strandClosed[i], 'catmullrom', 0.5);
  const geometry = new THREE.TubeGeometry(curve, strand.length * 4, radius, 8, result.strandClosed[i]);

  const mesh = new THREE.Mesh(geometry, strandMaterial);
  mesh.frustumCulled = false;
  app.scene.add(mesh);
}

// --- UI: path trace button ---

const panel = new Panel('Render');

let isPathTracing = false;
const pathTraceButton = new Button('Start Path Trace', () => {
  isPathTracing = !isPathTracing;
  if (isPathTracing) {
    previewLight.intensity = 0;
    app.renderManager.notifyMaterialsChanged();
    ambientLight.intensity = 0;
    app.enablePathTracing();
    pathTraceButton.setLabel('Stop Path Trace');
    pathTraceButton.domElement.style.backgroundColor = '#c94444';
  } else {
    app.disablePathTracing();
    previewLight.intensity = 0.8;
    ambientLight.intensity = 0.15;
    pathTraceButton.setLabel('Start Path Trace');
    pathTraceButton.domElement.style.backgroundColor = '#44aa44';
  }
});
pathTraceButton.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold;padding:8px 12px';
panel.add(pathTraceButton);
panel.mount(document.body);

// --- Animate ---

app.addAnimateCallback(() => {});
app.start();
