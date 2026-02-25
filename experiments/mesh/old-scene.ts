/**
 * Path Tracer Mesh Examples
 *
 * Clean white studio environment for displaying OBJ meshes.
 * Designed for mesh embeddings with checkerboard coloring (+1/-1 groups).
 *
 * Features:
 * - White gradient background
 * - Physical spotlight lighting
 * - Clearcoat ground plane
 * - Load OBJ files with face groups
 * - Two-sided face coloring (front/back)
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import { ColorInput } from '@/ui/inputs/ColorInput';
import '@/ui/styles/index.css';
import * as THREE from 'three';
import {
  GradientEquirectTexture,
  PhysicalSpotLight,
} from 'three-gpu-pathtracer';
import { OBJStructure } from '@/math/mesh/OBJStructure';
import { saveAs } from 'file-saver';

// Create app
const app = new App({
  debug: true,
  antialias: true,
  pathTracerDefaults: {
    bounces: 30,
    samples: 1
  }
});

// ===================================
// WHITE GRADIENT BACKGROUND
// ===================================

const texture = new GradientEquirectTexture();
texture.topColor.set(0xffffff);
texture.bottomColor.set(0x666666);
texture.update();
app.scene.environment = texture;
app.scene.background = texture;

// ===================================
// PHYSICAL SPOTLIGHT
// ===================================

const spotLight = new PhysicalSpotLight(0xffffff);
spotLight.position.set(2, 6.0, 0);
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 5.0;
spotLight.radius = 0.5;

// Spot light shadow settings
spotLight.shadow.mapSize.width = 512;
spotLight.shadow.mapSize.height = 512;
spotLight.shadow.camera.near = 0.1;
spotLight.shadow.camera.far = 10.0;
spotLight.shadow.focus = 1.0;
spotLight.castShadow = true;
app.scene.add(spotLight);

// Spot light target
const targetObject = spotLight.target;
targetObject.position.set(1, 0, 0.05);
app.scene.add(targetObject);

// ===================================
// WHITE CLEARCOAT GROUND
// ===================================

const groundGeo = new THREE.BoxGeometry(100, 0.1, 100);
const groundMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  clearcoat: 1,
  roughness: 0.5,
  metalness: 0
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.set(-1, -2, -1);
ground.frustumCulled = false;
app.scene.add(ground);

// ===================================
// STATE
// ===================================

let currentObjMesh: OBJStructure | null = null;
let groupColorsFolder: Folder | null = null;
let isPathTracing = false;

// ===================================
// UI HELPERS
// ===================================

function notifyPathTracerIfNeeded(): void {
  if (app.renderManager.isPathTracing()) {
    app.renderManager.notifyMaterialsChanged();
    app.renderManager.resetAccumulation();
  }
}

function rebuildGroupColorUI(): void {
  if (!groupColorsFolder || !currentObjMesh) return;

  // Clear existing color inputs
  groupColorsFolder.domElement.querySelectorAll('.cr-color-input').forEach(el => el.remove());

  // Add color pickers for front and back of each group
  for (const groupName of currentObjMesh.groups) {
    const displayName = groupName === 'default' ? 'Default' : `Group ${groupName}`;

    groupColorsFolder.add(new ColorInput(currentObjMesh.getFaceColor(groupName, 'front'), {
      label: `${displayName} Front`,
      onChange: (c: string) => {
        currentObjMesh?.setFaceColor(groupName, 'front', c);
        notifyPathTracerIfNeeded();
      }
    }));
    groupColorsFolder.add(new ColorInput(currentObjMesh.getFaceColor(groupName, 'back'), {
      label: `${displayName} Back`,
      onChange: (c: string) => {
        currentObjMesh?.setFaceColor(groupName, 'back', c);
        notifyPathTracerIfNeeded();
      }
    }));
  }
}

// ===================================
// MESH LOADING AND DISPLAY
// ===================================

function showObjMesh(objString: string): void {
  // Remove existing
  if (currentObjMesh) {
    app.scene.remove(currentObjMesh);
    currentObjMesh.dispose();
    currentObjMesh = null;
  }

  // Create new OBJStructure
  currentObjMesh = OBJStructure.fromOBJ(objString);

  // Position mesh
  currentObjMesh.position.set(0, 1.0, 0);

  app.scene.add(currentObjMesh);

  console.log(`Loaded: ${currentObjMesh.vertexCount} vertices, ${currentObjMesh.faceCount} faces`);
  if (currentObjMesh.groups.length > 0) {
    console.log(`Groups: ${currentObjMesh.groups.join(', ')}`);
  }

  // Update UI with group colors
  rebuildGroupColorUI();

  notifyPathTracerIfNeeded();
}

async function loadObjFile(): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.obj';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (file) {
      const text = await file.text();
      showObjMesh(text);
    }
  };
  input.click();
}

// ===================================
// SAMPLE DATA
// ===================================

const sampleCheckerboardOBJ = `
# Sample checkerboard tetrahedron
# Groups: 1 (warm) and -1 (cool)

v 0 1.633 0
v -1 -0.577 0.707
v 1 -0.577 0.707
v 0 -0.577 -0.943

g 1
f 1 2 3
f 1 4 2

g -1
f 1 3 4
f 2 4 3
`;

function loadSampleMesh(): void {
  showObjMesh(sampleCheckerboardOBJ);
}

// ===================================
// CAMERA
// ===================================

app.camera.position.set(0.1, 10, -0.1);
app.camera.lookAt(0, 0, 0);

// Load sample mesh
loadSampleMesh();

// ===================================
// UI
// ===================================

const panel = new Panel('Mesh Examples');

// Actions
const actionsFolder = new Folder('Actions');

actionsFolder.add(new Button('Load OBJ File', loadObjFile));
actionsFolder.add(new Button('Sample Tetrahedron', loadSampleMesh));

const pathTraceButton = new Button('Start Path Trace', () => {
  isPathTracing = !isPathTracing;
  if (isPathTracing) {
    app.enablePathTracing();
    pathTraceButton.setLabel('Stop Path Trace');
    pathTraceButton.domElement.style.backgroundColor = '#c94444';
    console.log('Path tracing enabled');
  } else {
    app.disablePathTracing();
    pathTraceButton.setLabel('Start Path Trace');
    pathTraceButton.domElement.style.backgroundColor = '#44aa44';
    console.log('WebGL rendering');
  }
});
pathTraceButton.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold;padding:8px 12px';
actionsFolder.add(pathTraceButton);

actionsFolder.add(new Button('Download Image', () => {
  app.renderManager.render(app.scene, app.camera);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  app.renderManager.renderer.domElement.toBlob(blob => blob && saveAs(blob, `mesh-${ts}.png`));
}));

actionsFolder.add(new Button('Reset Accumulation', () => {
  app.renderManager.resetAccumulation();
}));

panel.add(actionsFolder);

// Mesh Appearance
const appearanceFolder = new Folder('Mesh Appearance');
appearanceFolder.add(new Toggle(true, {
  label: 'Show Vertices',
  onChange: (v) => {
    currentObjMesh?.setVerticesVisible(v);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new Toggle(true, {
  label: 'Show Edges',
  onChange: (v) => {
    currentObjMesh?.setEdgesVisible(v);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new Toggle(true, {
  label: 'Show Faces',
  onChange: (v) => {
    currentObjMesh?.setFacesVisible(v);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new Slider(0.04, {
  min: 0.01,
  max: 0.1,
  step: 0.005,
  label: 'Vertex Size',
  onChange: (v: number) => {
    currentObjMesh?.setSphereRadius(v);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new Slider(0.015, {
  min: 0.005,
  max: 0.05,
  step: 0.002,
  label: 'Edge Size',
  onChange: (v: number) => {
    currentObjMesh?.setTubeRadius(v);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new ColorInput('#333333', {
  label: 'Vertex Color',
  onChange: (c: string) => {
    currentObjMesh?.setVertexColor(c);
    notifyPathTracerIfNeeded();
  }
}));
appearanceFolder.add(new ColorInput('#555555', {
  label: 'Edge Color',
  onChange: (c: string) => {
    currentObjMesh?.setEdgeColor(c);
    notifyPathTracerIfNeeded();
  }
}));
panel.add(appearanceFolder);

// Group Colors (dynamically populated)
groupColorsFolder = new Folder('Group Colors');
panel.add(groupColorsFolder);

// Path Tracer settings
const ptFolder = new Folder('Path Tracer');
ptFolder.add(new Slider(30, {
  label: 'Bounces',
  min: 1,
  max: 50,
  step: 1,
  onChange: (v: number) => app.renderManager.setBounces(v)
}));
panel.add(ptFolder);
ptFolder.close();

// Spotlight controls
const lightFolder = new Folder('Spotlight');
lightFolder.add(new Slider(spotLight.intensity, {
  min: 0,
  max: 20,
  step: 0.5,
  label: 'Intensity',
  onChange: (v: number) => {
    spotLight.intensity = v;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
lightFolder.add(new Slider(spotLight.penumbra, {
  min: 0,
  max: 1,
  step: 0.05,
  label: 'Penumbra',
  onChange: (v: number) => {
    spotLight.penumbra = v;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
lightFolder.add(new Slider(spotLight.radius, {
  min: 0,
  max: 2,
  step: 0.1,
  label: 'Radius',
  onChange: (v: number) => {
    spotLight.radius = v;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
panel.add(lightFolder);

// Ground controls
const groundFolder = new Folder('Ground');
groundFolder.add(new Slider(groundMat.roughness, {
  min: 0,
  max: 1,
  step: 0.01,
  label: 'Roughness',
  onChange: (v: number) => {
    groundMat.roughness = v;
    groundMat.needsUpdate = true;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.notifyMaterialsChanged();
      app.renderManager.resetAccumulation();
    }
  }
}));
groundFolder.add(new Slider(groundMat.clearcoat, {
  min: 0,
  max: 1,
  step: 0.01,
  label: 'Clearcoat',
  onChange: (v: number) => {
    groundMat.clearcoat = v;
    groundMat.needsUpdate = true;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.notifyMaterialsChanged();
      app.renderManager.resetAccumulation();
    }
  }
}));
groundFolder.add(new Toggle(true, {
  label: 'Visible',
  onChange: (v) => {
    ground.visible = v;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
panel.add(groundFolder);

panel.mount(document.body);

// Start
app.start();

console.log('Mesh Examples - White Studio');
console.log('Load OBJ files with face groups (g directive) for per-group front/back coloring.');
