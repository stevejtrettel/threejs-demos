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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  parseGroupedOBJ,
  loadGroupedOBJFile,
  extractEdges,
  type GroupedMesh,
  type GroupedFace,
} from '@/math/mesh/parseOBJ';

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

// Container for all mesh parts
let meshGroup: THREE.Group | null = null;
let currentMesh: GroupedMesh | null = null;

// Materials for each group (keyed by group name)
const groupMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();

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
// MESH BUILDING UTILITIES
// ===================================

function buildVertexSpheres(vertices: THREE.Vector3[], radius: number, color: number): THREE.Mesh {
  const template = new THREE.SphereGeometry(radius, 12, 12);
  const geometries: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();

  for (const v of vertices) {
    const geo = template.clone();
    matrix.makeTranslation(v.x, v.y, v.z);
    geo.applyMatrix4(matrix);
    geometries.push(geo);
  }

  const merged = mergeGeometries(geometries, false);
  template.dispose();
  geometries.forEach(g => g.dispose());

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 });
  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;
  return mesh;
}

function buildEdgeTubes(vertices: THREE.Vector3[], edges: [number, number][], radius: number, color: number): THREE.Mesh {
  const template = new THREE.CylinderGeometry(radius, radius, 1, 8, 1);
  const geometries: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  for (const [a, b] of edges) {
    start.copy(vertices[a]);
    end.copy(vertices[b]);
    mid.addVectors(start, end).multiplyScalar(0.5);
    dir.subVectors(end, start);
    const length = dir.length();
    dir.normalize();
    quat.setFromUnitVectors(up, dir);
    scale.set(1, length, 1);
    matrix.compose(mid, quat, scale);

    const geo = template.clone();
    geo.applyMatrix4(matrix);
    geometries.push(geo);
  }

  const merged = mergeGeometries(geometries, false);
  template.dispose();
  geometries.forEach(g => g.dispose());

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;
  return mesh;
}

function buildFaceMeshForGroup(
  vertices: THREE.Vector3[],
  faces: GroupedFace[],
  color: number
): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const positions: number[] = [];

  for (const face of faces) {
    const indices = face.indices;
    // Fan triangulation
    for (let i = 1; i < indices.length - 1; i++) {
      const v0 = vertices[indices[0]];
      const v1 = vertices[indices[i]];
      const v2 = vertices[indices[i + 1]];
      positions.push(v0.x, v0.y, v0.z);
      positions.push(v1.x, v1.y, v1.z);
      positions.push(v2.x, v2.y, v2.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.0
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, material };
}

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

function getGroupColor(groupName: string | null): number {
  if (groupName !== null && groupName in groupColors) {
    return groupColors[groupName];
  }
  return groupColors['default'];
}

function showGroupedMesh(mesh: GroupedMesh): void {
  // Remove existing
  if (meshGroup) {
    app.scene.remove(meshGroup);
    meshGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
    meshGroup = null;
  }
  groupMaterials.clear();

  currentMesh = mesh;

  console.log(`Loaded: ${mesh.vertices.length} vertices, ${mesh.faces.length} faces`);
  console.log(`Groups: ${mesh.groups.join(', ') || 'none'}`);

  // Center and scale vertices
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

  // Create group container
  meshGroup = new THREE.Group();

  // Build vertices
  if (vizOptions.showVertices) {
    const vertexMesh = buildVertexSpheres(centeredVertices, vizOptions.sphereRadius, 0x333333);
    vertexMesh.name = 'vertices';
    meshGroup.add(vertexMesh);
  }

  // Build edges
  if (vizOptions.showEdges) {
    const edges = extractEdges(mesh.faces);
    const edgeMesh = buildEdgeTubes(centeredVertices, edges, vizOptions.tubeRadius, 0x555555);
    edgeMesh.name = 'edges';
    meshGroup.add(edgeMesh);
  }

  // Build faces - separate mesh per group
  if (vizOptions.showFaces) {
    // Group faces by their group name
    const facesByGroup = new Map<string, GroupedFace[]>();
    for (const face of mesh.faces) {
      const key = face.group ?? 'default';
      if (!facesByGroup.has(key)) {
        facesByGroup.set(key, []);
      }
      facesByGroup.get(key)!.push(face);
    }

    // Create mesh for each group
    for (const [groupName, faces] of facesByGroup) {
      const color = getGroupColor(groupName === 'default' ? null : groupName);
      const { mesh: faceMesh, material } = buildFaceMeshForGroup(centeredVertices, faces, color);
      faceMesh.name = `faces-${groupName}`;
      meshGroup.add(faceMesh);
      groupMaterials.set(groupName, material);
    }
  }

  app.scene.add(meshGroup);

  // Notify path tracer of material changes
  if (app.renderManager.isPathTracing()) {
    app.renderManager.notifyMaterialsChanged();
    app.renderManager.resetAccumulation();
  }
}

function updateGroupColor(groupName: string, color: number): void {
  const material = groupMaterials.get(groupName);
  if (material) {
    material.color.setHex(color);
    if (app.renderManager.isPathTracing()) {
      app.renderManager.notifyMaterialsChanged();
      app.renderManager.resetAccumulation();
    }
  }
}

function reloadMesh(): void {
  if (currentMesh) {
    showGroupedMesh(currentMesh);
  }
}

async function loadGroupedFile(): Promise<void> {
  const mesh = await loadGroupedOBJFile();
  if (mesh) {
    showGroupedMesh(mesh);
  }
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
  const mesh = parseGroupedOBJ(sampleCheckerboardOBJ);
  showGroupedMesh(mesh);
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
    updateGroupColor('1', groupColors['1']);
  }
}));
colorFolder.add(new ColorInput(hexToString(groupColors['-1']), {
  label: 'Group -1',
  onChange: (c: string) => {
    groupColors['-1'] = stringToHex(c);
    updateGroupColor('-1', groupColors['-1']);
  }
}));
colorFolder.add(new ColorInput(hexToString(groupColors['default']), {
  label: 'Default',
  onChange: (c: string) => {
    groupColors['default'] = stringToHex(c);
    updateGroupColor('default', groupColors['default']);
  }
}));
panel.add(colorFolder);

// Display
const displayFolder = new Folder('Display');
displayFolder.add(new Toggle(vizOptions.showVertices, {
  label: 'Vertices',
  onChange: (v) => {
    vizOptions.showVertices = v;
    reloadMesh();
  }
}));
displayFolder.add(new Toggle(vizOptions.showEdges, {
  label: 'Edges',
  onChange: (v) => {
    vizOptions.showEdges = v;
    reloadMesh();
  }
}));
displayFolder.add(new Toggle(vizOptions.showFaces, {
  label: 'Faces',
  onChange: (v) => {
    vizOptions.showFaces = v;
    reloadMesh();
  }
}));
displayFolder.add(new Slider(vizOptions.sphereRadius, {
  min: 0.01,
  max: 0.1,
  step: 0.005,
  label: 'Vertex Size',
  onChange: (v: number) => {
    vizOptions.sphereRadius = v;
    reloadMesh();
  }
}));
displayFolder.add(new Slider(vizOptions.tubeRadius, {
  min: 0.005,
  max: 0.05,
  step: 0.002,
  label: 'Edge Size',
  onChange: (v: number) => {
    vizOptions.tubeRadius = v;
    reloadMesh();
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
      app.renderManager.notifyMaterialsChanged();
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
