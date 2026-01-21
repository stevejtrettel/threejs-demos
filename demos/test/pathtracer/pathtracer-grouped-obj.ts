/**
 * Path Tracer Grouped OBJ Viewer
 *
 * Demonstrates loading OBJ files with face groups and per-group coloring.
 * Ideal for mesh embeddings with checkerboard coloring (+1/-1 groups).
 *
 * Features:
 * - Load OBJ files with face groups (g directive)
 * - Custom color mapping for groups via UI
 * - Path tracing with soft studio lighting
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
  parseGroupedOBJ,
  loadGroupedOBJFile,
  groupColorsFromMap,
  generateGroupPalette,
  type GroupedMesh,
} from '@/math/mesh/parseOBJ';
import { MeshVisualizer } from '@/math/mesh/MeshVisualizer';

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

  const roomWidth = 12;
  const roomHeight = 8;
  const roomDepth = 12;
  const wallColor = 0xf5f2ed;

  // Room
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

  // Ceiling light
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

  // Three-point lighting
  const keyLight = new THREE.PointLight(0xffffff, 150);
  keyLight.position.set(3, 5, 3);
  envScene.add(keyLight);

  const fillLight = new THREE.PointLight(0xffffff, 60);
  fillLight.position.set(-4, 3, 2);
  envScene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffffff, 40);
  rimLight.position.set(0, 4, -4);
  envScene.add(rimLight);

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
// FLOOR
// ===================================

const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0xe8e4df,
  roughness: 0.85,
  metalness: 0.0
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.frustumCulled = false;
app.scene.add(floor);

// ===================================
// STATE
// ===================================

let visualizer: MeshVisualizer | null = null;
let currentMesh: GroupedMesh | null = null;
let currentFaceColors: (number | THREE.Color)[] = [];

// Visualization options
const vizOptions = {
  sphereRadius: 0.04,
  tubeRadius: 0.015,
  showVertices: true,
  showEdges: true,
  showFaces: true
};

// Group colors (customizable)
const groupColors: Record<string, number> = {
  '1': 0xffe9ad,    // warm cream
  '-1': 0xadd8e6,   // light blue
  'default': 0xcccccc
};

// ===================================
// MESH LOADING AND DISPLAY
// ===================================

function computeBounds(vertices: THREE.Vector3[]) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  for (const v of vertices) {
    min.min(v);
    max.max(v);
  }

  return {
    min,
    max,
    size: new THREE.Vector3().subVectors(max, min),
    center: new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5)
  };
}

function showGroupedMesh(mesh: GroupedMesh, faceColors: (number | THREE.Color)[]): void {
  // Remove existing
  if (visualizer) {
    app.scene.remove(visualizer);
    visualizer.dispose();
    visualizer = null;
  }

  currentMesh = mesh;
  currentFaceColors = faceColors;

  console.log(`Loaded: ${mesh.vertices.length} vertices, ${mesh.faces.length} faces`);
  console.log(`Groups: ${mesh.groups.join(', ') || 'none'}`);
  console.log(`Materials: ${mesh.materials.join(', ') || 'none'}`);

  // Center and scale
  const bounds = computeBounds(mesh.vertices);
  const center = bounds.center;
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
  const scale = 2.5 / maxDim;

  const centeredVertices = mesh.vertices.map(v =>
    new THREE.Vector3(
      (v.x - center.x) * scale,
      (v.y - center.y) * scale + 1.2,
      (v.z - center.z) * scale
    )
  );

  // Convert to simple mesh format
  const simpleMesh = {
    vertices: centeredVertices,
    faces: mesh.faces.map(f => f.indices)
  };

  visualizer = new MeshVisualizer(simpleMesh, {
    sphereRadius: vizOptions.sphereRadius,
    tubeRadius: vizOptions.tubeRadius,
    sphereSegments: 12,
    tubeSegments: 8,
    vertexColor: 0x333333,
    edgeColor: 0x555555,
    faceColors: faceColors,
    faceOpacity: 1.0,
    showVertices: vizOptions.showVertices,
    showEdges: vizOptions.showEdges,
    showFaces: vizOptions.showFaces,
  });

  app.scene.add(visualizer);

  if (app.renderManager.isPathTracing()) {
    app.renderManager.resetAccumulation();
  }
}

function updateColors(): void {
  if (!currentMesh || !visualizer) return;

  // Regenerate colors with current groupColors
  const newColors = groupColorsFromMap(currentMesh.faces, groupColors);
  currentFaceColors = newColors;

  // Update visualizer
  visualizer.setFaceColors(newColors);

  if (app.renderManager.isPathTracing()) {
    app.renderManager.resetAccumulation();
  }
}

async function loadGroupedFile(): Promise<void> {
  const mesh = await loadGroupedOBJFile();

  if (mesh) {
    // Build color map, auto-generating for unknown groups
    let colorMap = { ...groupColors };
    const unknownGroups = mesh.groups.filter(g => !(g in colorMap));
    if (unknownGroups.length > 0) {
      const generated = generateGroupPalette(unknownGroups);
      colorMap = { ...colorMap, ...generated };
    }

    const faceColors = groupColorsFromMap(mesh.faces, colorMap);
    showGroupedMesh(mesh, faceColors);
  }
}

// ===================================
// SAMPLE DATA
// ===================================

// Example checkerboard mesh (tetrahedron with alternating faces)
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
  const mesh = parseGroupedOBJ(sampleCheckerboardOBJ);

  // Generate colors, including auto-palette for any unknown groups
  let colorMap = { ...groupColors };
  const unknownGroups = mesh.groups.filter(g => !(g in colorMap));
  if (unknownGroups.length > 0) {
    const generatedPalette = generateGroupPalette(unknownGroups);
    colorMap = { ...colorMap, ...generatedPalette };
  }

  const faceColors = groupColorsFromMap(mesh.faces, colorMap);
  showGroupedMesh(mesh, faceColors);
}

// ===================================
// CAMERA
// ===================================

app.camera.position.set(4, 2.5, 5);
app.camera.lookAt(0, 1, 0);

// Load sample mesh
loadSampleMesh();

// ===================================
// UI
// ===================================

const panel = new Panel('Grouped OBJ Viewer');

// Model loading
const modelFolder = new Folder('Model');
modelFolder.add(new Button('Load OBJ File...', loadGroupedFile));
modelFolder.add(new Button('Sample Tetrahedron', loadSampleMesh));
panel.add(modelFolder);

// Helper to convert hex number to CSS color string
function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

// Helper to convert CSS color string to hex number
function stringToHex(str: string): number {
  return parseInt(str.slice(1), 16);
}

// Group colors
const colorFolder = new Folder('Group Colors');
colorFolder.add(new ColorInput(hexToString(groupColors['1']), {
  label: 'Group +1',
  onChange: (c: string) => {
    groupColors['1'] = stringToHex(c);
    updateColors();
  }
}));
colorFolder.add(new ColorInput(hexToString(groupColors['-1']), {
  label: 'Group -1',
  onChange: (c: string) => {
    groupColors['-1'] = stringToHex(c);
    updateColors();
  }
}));
colorFolder.add(new ColorInput(hexToString(groupColors['default']), {
  label: 'Default',
  onChange: (c: string) => {
    groupColors['default'] = stringToHex(c);
    updateColors();
  }
}));
panel.add(colorFolder);

// Display
const displayFolder = new Folder('Display');
displayFolder.add(new Toggle(vizOptions.showVertices, {
  label: 'Vertices',
  onChange: (v) => {
    vizOptions.showVertices = v;
    visualizer?.setVerticesVisible(v);
  }
}));
displayFolder.add(new Toggle(vizOptions.showEdges, {
  label: 'Edges',
  onChange: (v) => {
    vizOptions.showEdges = v;
    visualizer?.setEdgesVisible(v);
  }
}));
displayFolder.add(new Toggle(vizOptions.showFaces, {
  label: 'Faces',
  onChange: (v) => {
    vizOptions.showFaces = v;
    visualizer?.setFacesVisible(v);
  }
}));
displayFolder.add(new Slider(vizOptions.sphereRadius, {
  min: 0.01,
  max: 0.1,
  step: 0.005,
  label: 'Vertex Size',
  onChange: (v: number) => {
    vizOptions.sphereRadius = v;
    // Would need to rebuild mesh to change this
  }
}));
panel.add(displayFolder);

// Rendering
const renderFolder = new Folder('Rendering');
renderFolder.add(new Toggle(false, {
  label: 'Path Tracing',
  onChange: (enabled) => {
    if (enabled) {
      app.enablePathTracing();
      console.log('Path tracing enabled');
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

console.log('Grouped OBJ Viewer');
console.log('Load OBJ files with face groups (g directive) for per-group coloring.');
