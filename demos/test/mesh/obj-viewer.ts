/**
 * OBJ Viewer Demo
 *
 * Load an OBJ file and visualize it with:
 * - Spheres at vertices
 * - Tubes on edges
 * - Face surface mesh
 *
 * Supports path tracing for photorealistic rendering.
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import '@/ui/styles/index.css';
import { parseOBJ } from '@/mesh/parseOBJ';
import { MeshVisualizer } from '@/mesh/MeshVisualizer';

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
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: true,
  intensity: 1.0
});

// Current visualizer
let visualizer: MeshVisualizer | null = null;

// Load OBJ and create visualizer
async function loadMesh(url: string): Promise<void> {
  // Remove existing visualizer
  if (visualizer) {
    app.scene.remove(visualizer);
    visualizer.dispose();
    visualizer = null;
  }

  try {
    const response = await fetch(url);
    const text = await response.text();
    const parsed = parseOBJ(text);

    console.log(`Loaded: ${parsed.vertices.length} vertices, ${parsed.faces.length} faces`);

    visualizer = new MeshVisualizer(parsed, {
      sphereRadius: 0.08,
      tubeRadius: 0.03,
      vertexColor: 0x333333,
      edgeColor: 0x4488cc,
      faceColor: 0xffcc88,
      faceOpacity: 0.9,
      showVertices: true,
      showEdges: true,
      showFaces: true,
    });

    app.scene.add(visualizer);

    // Reset path tracer if active
    if (app.renderManager.isPathTracing()) {
      app.renderManager.resetAccumulation();
    }
  } catch (error) {
    console.error('Failed to load OBJ:', error);
  }
}

// Position camera
app.camera.position.set(4, 3, 5);
app.camera.lookAt(0, 0, 0);

// Load default mesh
loadMesh('/assets/models/icosahedron.obj');

// Create UI
const panel = new Panel('OBJ Viewer');

// Model selection
const modelFolder = new Folder('Model');
modelFolder.add(new Button('Cube', () => loadMesh('/assets/models/cube.obj')));
modelFolder.add(new Button('Icosahedron', () => loadMesh('/assets/models/icosahedron.obj')));
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
