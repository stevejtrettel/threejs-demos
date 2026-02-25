/**
 * OBJ Viewer Demo
 *
 * Load an OBJ file and visualize it with:
 * - Spheres at vertices
 * - Tubes on edges
 * - Face surface mesh (front/back colors)
 *
 * Supports path tracing for photorealistic rendering.
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import '@/ui/styles/index.css';
import { OBJStructure } from '@/math/mesh/OBJStructure';

// Import assets directly - Vite will only bundle what's imported
import studioHdr from '@assets/hdri/studio.hdr';
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

// Load HDRI for nice lighting
app.backgrounds.loadHDR(studioHdr, {
  asEnvironment: true,
  asBackground: true,
  intensity: 1.0
});

// Current visualizer
let visualizer: OBJStructure | null = null;

// Create visualizer from OBJ string
function showMesh(objString: string): void {
  // Remove existing visualizer
  if (visualizer) {
    app.scene.remove(visualizer);
    visualizer.dispose();
    visualizer = null;
  }

  visualizer = OBJStructure.fromOBJ(objString, {
    sphereRadius: 0.08,
    tubeRadius: 0.03,
    vertexColor: '#333333',
    edgeColor: '#4488cc',
    defaultFaceColors: { front: '#ffcc88', back: '#cc9955' },
    showVertices: true,
    showEdges: true,
    showFaces: true,
  });

  console.log(`Loaded: ${visualizer.vertexCount} vertices, ${visualizer.faceCount} faces`);

  app.scene.add(visualizer);

  // Reset path tracer if active
  if (app.renderManager.isPathTracing()) {
    app.renderManager.resetAccumulation();
  }
}

// Load OBJ from URL
async function loadMeshFromURL(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    showMesh(text);
  } catch (error) {
    console.error('Failed to load OBJ:', error);
  }
}

// Load OBJ from file picker
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

// Position camera
app.camera.position.set(4, 3, 5);
app.camera.lookAt(0, 0, 0);

// Load default mesh
showMesh(icosahedronObj);

// Create UI
const panel = new Panel('OBJ Viewer');

// Model selection
const modelFolder = new Folder('Model');
modelFolder.add(new Button('Load File...', loadMeshFromFile));
modelFolder.add(new Button('Cube', () => showMesh(cubeObj)));
modelFolder.add(new Button('Icosahedron', () => showMesh(icosahedronObj)));
panel.add(modelFolder);

// Visibility toggles
const visFolder = new Folder('Visibility');
visFolder.add(new Toggle(true, {
  label: 'Vertices',
  onChange: (v) => visualizer?.setVerticesVisible(v)
}));
visFolder.add(new Toggle(true, {
  label: 'Edges',
  onChange: (v) => visualizer?.setEdgesVisible(v)
}));
visFolder.add(new Toggle(true, {
  label: 'Faces',
  onChange: (v) => visualizer?.setFacesVisible(v)
}));
panel.add(visFolder);

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
      console.log('WebGL rendering enabled');
    }
  }
}));
renderFolder.add(new Button('Reset PT', () => {
  app.renderManager.resetAccumulation();
}));
panel.add(renderFolder);

panel.mount(document.body);

// Start
app.start();

console.log('OBJ Viewer Demo');
console.log('Use the UI to switch models and toggle visibility');
console.log('Enable path tracing for photorealistic rendering');
