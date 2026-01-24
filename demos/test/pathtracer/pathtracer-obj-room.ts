/**
 * Path Tracer OBJ Room
 *
 * A nice studio room environment for path tracing loaded OBJ meshes.
 * Features:
 * - Soft room lighting with emissive walls
 * - Reflective floor
 * - OBJ file loading (from file or presets)
 * - Mesh visualization with spheres/tubes/faces
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import '@/ui/styles/index.css';
import * as THREE from 'three';
import { OBJStructure } from '@/math/mesh/OBJStructure';

// Import assets directly - Vite will only bundle what's imported
import cubeObj from '@assets/models/cube.obj?raw';
import icosahedronObj from '@assets/models/icosahedron.obj?raw';

// Create app
const app = new App({
  debug: true,
  antialias: true,
  pathTracerDefaults: {
    bounces: 8,
    samples: 1
  }
});

// ===================================
// CREATE STUDIO ROOM ENVIRONMENT
// ===================================

function createRoomEnvironment() {
  const envScene = new THREE.Scene();

  // Room dimensions
  const roomWidth = 12;
  const roomHeight = 8;
  const roomDepth = 12;

  // Off-white matte walls
  const wallColor = 0xf5f2ed;

  // Main room (inverted box)
  const roomGeo = new THREE.BoxGeometry(roomWidth, roomHeight, roomDepth);
  const roomMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    side: THREE.BackSide,
    roughness: 0.95,
    metalness: 0.0
  });
  const room = new THREE.Mesh(roomGeo, roomMat);
  room.position.y = roomHeight / 2;
  envScene.add(room);

  // Ceiling light panel (soft box)
  const lightPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
      side: THREE.DoubleSide
    })
  );
  lightPanel.position.set(0, roomHeight - 0.1, 0);
  lightPanel.rotation.x = Math.PI / 2;
  envScene.add(lightPanel);

  // Key light (main)
  const keyLight = new THREE.PointLight(0xffffff, 150);
  keyLight.position.set(3, 5, 3);
  envScene.add(keyLight);

  // Fill light (softer, from left)
  const fillLight = new THREE.PointLight(0xffffff, 60);
  fillLight.position.set(-4, 3, 2);
  envScene.add(fillLight);

  // Rim light (from behind)
  const rimLight = new THREE.PointLight(0xffffff, 40);
  rimLight.position.set(0, 4, -4);
  envScene.add(rimLight);

  // Bake to environment maps
  app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,
    asEnvironment: true,
    asBackground: true,
    intensity: 1.0,
    includeLights: true
  });
}

createRoomEnvironment();

// ===================================
// FLOOR (in main scene)
// ===================================

const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0xe8e4df,  // Light warm gray to match walls
  roughness: 0.85,
  metalness: 0.0
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.frustumCulled = false;
app.scene.add(floor);

// ===================================
// MESH VISUALIZATION
// ===================================

let visualizer: OBJStructure | null = null;

// Visualization options
const vizOptions = {
  sphereRadius: 0.06,
  tubeRadius: 0.025,
  showVertices: true,
  showEdges: true,
  showFaces: true
};

function showMesh(objString: string): void {
  // Remove existing
  if (visualizer) {
    app.scene.remove(visualizer);
    visualizer.dispose();
    visualizer = null;
  }

  // Create new visualizer (auto-centers and scales)
  visualizer = OBJStructure.fromOBJ(objString, {
    sphereRadius: vizOptions.sphereRadius,
    tubeRadius: vizOptions.tubeRadius,
    vertexColor: '#444444',
    edgeColor: '#5588cc',
    defaultFaceColors: { front: '#eecc88', back: '#bb9955' },
    showVertices: vizOptions.showVertices,
    showEdges: vizOptions.showEdges,
    showFaces: vizOptions.showFaces,
  });

  // Position above floor
  visualizer.position.y = 1.2;

  app.scene.add(visualizer);

  console.log(`Loaded: ${visualizer.vertexCount} vertices, ${visualizer.faceCount} faces`);

  // Reset path tracer
  if (app.renderManager.isPathTracing()) {
    app.renderManager.resetAccumulation();
  }
}

async function loadMeshFromURL(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    showMesh(text);
  } catch (error) {
    console.error('Failed to load OBJ:', error);
  }
}

async function loadMeshFromFile(): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.obj';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (file) {
      const text = await file.text();
      showMesh(text);
    }
  };
  input.click();
}

// ===================================
// CAMERA
// ===================================

app.camera.position.set(5, 3, 6);
app.camera.lookAt(0, 1, 0);

// Load default mesh
showMesh(icosahedronObj);

// ===================================
// UI
// ===================================

const panel = new Panel('OBJ Room Viewer');

// Model loading
const modelFolder = new Folder('Model');
modelFolder.add(new Button('Load File...', loadMeshFromFile));
modelFolder.add(new Button('Cube', () => showMesh(cubeObj)));
modelFolder.add(new Button('Icosahedron', () => showMesh(icosahedronObj)));
panel.add(modelFolder);

// Visibility
const visFolder = new Folder('Display');
visFolder.add(new Toggle(vizOptions.showVertices, {
  label: 'Vertices',
  onChange: (v) => {
    vizOptions.showVertices = v;
    visualizer?.setVerticesVisible(v);
  }
}));
visFolder.add(new Toggle(vizOptions.showEdges, {
  label: 'Edges',
  onChange: (v) => {
    vizOptions.showEdges = v;
    visualizer?.setEdgesVisible(v);
  }
}));
visFolder.add(new Toggle(vizOptions.showFaces, {
  label: 'Faces',
  onChange: (v) => {
    vizOptions.showFaces = v;
    visualizer?.setFacesVisible(v);
  }
}));
panel.add(visFolder);

// Rendering
const renderFolder = new Folder('Rendering');
renderFolder.add(new Toggle(false, {
  label: 'Path Tracing',
  onChange: (enabled) => {
    if (enabled) {
      app.enablePathTracing();
      console.log('Path tracing enabled - let it converge for best quality');
    } else {
      app.disablePathTracing();
      console.log('WebGL rendering');
    }
  }
}));
renderFolder.add(new Button('Reset PT', () => {
  app.renderManager.resetAccumulation();
}));
panel.add(renderFolder);

// Floor
const floorFolder = new Folder('Floor');
floorFolder.add(new Slider(0.15, {
  min: 0,
  max: 1,
  step: 0.01,
  label: 'Roughness',
  onChange: (v: number) => {
    floorMat.roughness = v;
    floorMat.needsUpdate = true;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
floorFolder.add(new Toggle(true, {
  label: 'Visible',
  onChange: (v) => {
    floor.visible = v;
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  }
}));
panel.add(floorFolder);

panel.mount(document.body);

// Start
app.start();

console.log('OBJ Room Viewer');
console.log('Load an OBJ file and path trace it in a studio environment');
