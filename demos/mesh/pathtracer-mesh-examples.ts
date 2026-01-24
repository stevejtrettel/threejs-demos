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
  GradientEquirectTexture,
  PhysicalSpotLight,
} from 'three-gpu-pathtracer';
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

let meshGroup: THREE.Group | null = null;
let currentMesh: GroupedMesh | null = null;

const groupMaterials: Map<string, THREE.MeshPhysicalMaterial> = new Map();

const vizOptions = {
  sphereRadius: 0.04,
  tubeRadius: 0.015,
  showVertices: true,
  showEdges: true,
  showFaces: true
};

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

  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1 });
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

  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.2 });
  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;
  return mesh;
}

function buildFaceMeshForGroup(
  vertices: THREE.Vector3[],
  faces: GroupedFace[],
  color: number
): { mesh: THREE.Mesh; material: THREE.MeshPhysicalMaterial } {
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

  const material = new THREE.MeshPhysicalMaterial({
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
      (v.y - center.y) * scale + 1.0,
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
    const facesByGroup = new Map<string, GroupedFace[]>();
    for (const face of mesh.faces) {
      const key = face.group ?? 'default';
      if (!facesByGroup.has(key)) {
        facesByGroup.set(key, []);
      }
      facesByGroup.get(key)!.push(face);
    }

    for (const [groupName, faces] of facesByGroup) {
      const color = getGroupColor(groupName === 'default' ? null : groupName);
      const { mesh: faceMesh, material } = buildFaceMeshForGroup(centeredVertices, faces, color);
      faceMesh.name = `faces-${groupName}`;
      meshGroup.add(faceMesh);
      groupMaterials.set(groupName, material);
    }
  }

  app.scene.add(meshGroup);

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

app.camera.position.set(0.1, 10, -0.1);
app.camera.lookAt(0, 0, 0);

// Load sample mesh
loadSampleMesh();

// ===================================
// UI
// ===================================

const panel = new Panel('Mesh Examples');

// Model loading
const modelFolder = new Folder('Model');
modelFolder.add(new Button('Load OBJ File...', loadGroupedFile));
modelFolder.add(new Button('Sample Tetrahedron', loadSampleMesh));
panel.add(modelFolder);

// Helper functions
function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

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
console.log('Load OBJ files with face groups (g directive) for per-group coloring.');
