/**
 * Path Traced Mesh Evolver Scene
 *
 * A Cornell box-style scene for rendering mesh evolver outputs with
 * beautiful global illumination via GPU path tracing.
 *
 * Features:
 * - Cornell box with colored walls
 * - Quad light (RectAreaLight) on ceiling
 * - OBJ file loading for mesh evolver outputs
 * - Surface + tube edges + sphere vertices visualization
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import '@/ui/styles/index.css';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// Initialize RectAreaLight support for WebGL
RectAreaLightUniformsLib.init();

// Import mesh evolver visualization classes
// @ts-ignore - Legacy JS module without type declarations
import { loadOBJ } from '../../../legacy/mesh-embedding/utils/objs.js';
// @ts-ignore - Legacy JS module without type declarations
import TopologyView from '../../../legacy/mesh-embedding/Visualizer/TopologyView.js';

// ===================================
// APP SETUP
// ===================================

const app = new App({
    debug: true,
    antialias: true,
    pathTracerDefaults: {
        bounces: 8,
        samples: 1
    }
});

// ===================================
// CORNELL BOX GEOMETRY
// ===================================

// Box dimensions
const boxWidth = 6;
const boxHeight = 6;
const boxDepth = 6;

// Create individual walls as separate planes for proper normals and materials
function createCornellBox() {
    const group = new THREE.Group();

    // Common material settings
    const wallSettings = {
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide  // Visible from both sides
    };

    // Floor (white)
    const floorGeo = new THREE.PlaneGeometry(boxWidth, boxDepth);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        ...wallSettings
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    group.add(floor);

    // Ceiling (white)
    const ceilingGeo = new THREE.PlaneGeometry(boxWidth, boxDepth);
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        ...wallSettings
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = boxHeight;
    group.add(ceiling);

    // Back wall (white)
    const backWallGeo = new THREE.PlaneGeometry(boxWidth, boxHeight);
    const backWallMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        ...wallSettings
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.z = -boxDepth / 2;
    backWall.position.y = boxHeight / 2;
    group.add(backWall);

    // Left wall (red)
    const leftWallGeo = new THREE.PlaneGeometry(boxDepth, boxHeight);
    const leftWallMat = new THREE.MeshStandardMaterial({
        color: 0xcc3333,
        ...wallSettings
    });
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -boxWidth / 2;
    leftWall.position.y = boxHeight / 2;
    group.add(leftWall);

    // Right wall (green)
    const rightWallGeo = new THREE.PlaneGeometry(boxDepth, boxHeight);
    const rightWallMat = new THREE.MeshStandardMaterial({
        color: 0x33cc33,
        ...wallSettings
    });
    const rightWall = new THREE.Mesh(rightWallGeo, rightWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = boxWidth / 2;
    rightWall.position.y = boxHeight / 2;
    group.add(rightWall);

    return group;
}

// Create and add Cornell box
const cornellBox = createCornellBox();
app.scene.add(cornellBox);

// ===================================
// QUAD LIGHT (RectAreaLight)
// ===================================

// Create a rectangular area light on the ceiling
const lightWidth = 2;
const lightHeight = 2;
const rectLight = new THREE.RectAreaLight(0xffffff, 15, lightWidth, lightHeight);
rectLight.position.set(0, boxHeight - 0.01, 0); // Just below ceiling
rectLight.rotation.x = Math.PI / 2; // Point downward
app.scene.add(rectLight);

// Add a visible light panel (emissive plane)
const lightPanelGeo = new THREE.PlaneGeometry(lightWidth, lightHeight);
const lightPanelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 3,
    side: THREE.DoubleSide
});
const lightPanel = new THREE.Mesh(lightPanelGeo, lightPanelMat);
lightPanel.position.copy(rectLight.position);
lightPanel.rotation.x = -Math.PI / 2;
app.scene.add(lightPanel);

// Add subtle ambient light for WebGL preview (path tracer ignores this for GI)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
app.scene.add(ambientLight);

// ===================================
// MESH EVOLVER VISUALIZATION
// ===================================

// Container for the mesh visualization
let currentMeshView: THREE.Group | null = null;

// Default colors for visualization
const meshColors = {
    vertex: 0x222222,  // Dark vertices
    edge: 0x3366aa,    // Blue edges
    face: 0xffcc88     // Warm gold faces
};

// Scale and position settings
const meshSettings = {
    scale: 1.0,
    positionY: 1.5  // Center height in box
};

/**
 * Load and display an OBJ file as a mesh evolver visualization
 */
function loadAndDisplayOBJ(objText: string) {
    // Remove previous mesh
    if (currentMeshView) {
        app.scene.remove(currentMeshView);
        currentMeshView = null;
    }

    try {
        // Parse OBJ and create embedding
        const embedding = loadOBJ(objText);

        // Create topology view (faces + edges + vertices)
        const meshView = new TopologyView(embedding, meshColors);

        // Center and scale the mesh
        const bbox = new THREE.Box3().setFromObject(meshView);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Scale to fit nicely in the Cornell box (about 2 units)
        const targetSize = 2.0;
        const scale = targetSize / maxDim * meshSettings.scale;

        meshView.scale.setScalar(scale);
        meshView.position.set(
            -center.x * scale,
            meshSettings.positionY - center.y * scale,
            -center.z * scale
        );

        app.scene.add(meshView);
        currentMeshView = meshView;

        // Notify pathtracer of scene change
        if (app.renderManager.isPathTracing()) {
            app.renderManager.notifyMaterialsChanged();
            app.renderManager.resetAccumulation();
        }

        console.log(`Loaded mesh: ${embedding.topology.vertices.length} vertices, ${embedding.topology.faces.length} faces`);

    } catch (error) {
        console.error('Failed to load OBJ:', error);
    }
}

/**
 * Create a sample mesh (icosahedron) for demonstration
 */
function createSampleMesh() {
    // Create an icosahedron as a sample mesh
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

    // Icosahedron vertices
    const vertices = [
        [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
        [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
        [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ];

    // Icosahedron faces (triangles, 0-indexed)
    const faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    // Generate OBJ format
    let objText = '# Sample Icosahedron\n';
    for (const [x, y, z] of vertices) {
        objText += `v ${x} ${y} ${z}\n`;
    }
    for (const [a, b, c] of faces) {
        objText += `f ${a + 1} ${b + 1} ${c + 1}\n`; // OBJ is 1-indexed
    }

    return objText;
}

/**
 * Create a more complex sample mesh (subdivided icosahedron)
 */
function createSubdividedIcosahedron(subdivisions: number = 1) {
    const phi = (1 + Math.sqrt(5)) / 2;

    // Start with icosahedron
    let vertices: number[][] = [
        [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
        [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
        [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ];

    let faces: number[][] = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    // Subdivide
    for (let s = 0; s < subdivisions; s++) {
        const newFaces: number[][] = [];
        const midpointCache: Map<string, number> = new Map();

        const getMidpoint = (i1: number, i2: number): number => {
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            if (midpointCache.has(key)) {
                return midpointCache.get(key)!;
            }
            const v1 = vertices[i1];
            const v2 = vertices[i2];
            const mid = [
                (v1[0] + v2[0]) / 2,
                (v1[1] + v2[1]) / 2,
                (v1[2] + v2[2]) / 2
            ];
            // Normalize to sphere
            const len = Math.sqrt(mid[0] * mid[0] + mid[1] * mid[1] + mid[2] * mid[2]);
            mid[0] *= phi / len;
            mid[1] *= phi / len;
            mid[2] *= phi / len;
            const idx = vertices.length;
            vertices.push(mid);
            midpointCache.set(key, idx);
            return idx;
        };

        for (const [a, b, c] of faces) {
            const ab = getMidpoint(a, b);
            const bc = getMidpoint(b, c);
            const ca = getMidpoint(c, a);
            newFaces.push([a, ab, ca]);
            newFaces.push([b, bc, ab]);
            newFaces.push([c, ca, bc]);
            newFaces.push([ab, bc, ca]);
        }
        faces = newFaces;
    }

    // Generate OBJ format
    let objText = `# Subdivided Icosahedron (${subdivisions} subdivisions)\n`;
    for (const [x, y, z] of vertices) {
        objText += `v ${x} ${y} ${z}\n`;
    }
    for (const [a, b, c] of faces) {
        objText += `f ${a + 1} ${b + 1} ${c + 1}\n`;
    }

    return objText;
}

// Load sample mesh on start
loadAndDisplayOBJ(createSubdividedIcosahedron(2));

// ===================================
// CAMERA SETUP
// ===================================

app.camera.position.set(0, boxHeight / 2, boxDepth * 1.2);
app.camera.lookAt(0, boxHeight / 2, 0);

// ===================================
// FILE INPUT FOR OBJ LOADING
// ===================================

// Create hidden file input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.obj';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            loadAndDisplayOBJ(text);
        };
        reader.readAsText(file);
    }
});

// ===================================
// UI PANEL
// ===================================

const panel = new Panel('Mesh Evolver Path Tracer');

// Rendering controls
const renderFolder = new Folder('Rendering');

renderFolder.add(new Toggle(false, {
    label: 'Path Tracing',
    onChange: (enabled) => {
        if (enabled) {
            app.enablePathTracing();
            console.log('Path tracing enabled - samples will accumulate');
        } else {
            app.disablePathTracing();
            console.log('WebGL rendering enabled');
        }
    }
}));

renderFolder.add(new Button('Reset Accumulation', () => {
    app.renderManager.resetAccumulation();
}));

panel.add(renderFolder);

// Light controls
const lightFolder = new Folder('Quad Light');

lightFolder.add(new Slider(15, {
    label: 'Intensity',
    min: 0,
    max: 50,
    step: 1,
    onChange: (value) => {
        rectLight.intensity = value;
        lightPanelMat.emissiveIntensity = value / 5;
        if (app.renderManager.isPathTracing()) {
            app.renderManager.notifyMaterialsChanged();
            app.renderManager.resetAccumulation();
        }
    }
}));

lightFolder.add(new Slider(2, {
    label: 'Size',
    min: 0.5,
    max: 4,
    step: 0.1,
    onChange: (value) => {
        rectLight.width = value;
        rectLight.height = value;
        lightPanel.scale.set(value / lightWidth, value / lightHeight, 1);
        if (app.renderManager.isPathTracing()) {
            app.renderManager.notifyMaterialsChanged();
            app.renderManager.resetAccumulation();
        }
    }
}));

panel.add(lightFolder);

// Mesh controls
const meshFolder = new Folder('Mesh');

meshFolder.add(new Button('Load OBJ File', () => {
    fileInput.click();
}));

meshFolder.add(new Button('Sample: Icosahedron', () => {
    loadAndDisplayOBJ(createSampleMesh());
}));

meshFolder.add(new Button('Sample: Subdivided Sphere', () => {
    loadAndDisplayOBJ(createSubdividedIcosahedron(2));
}));

meshFolder.add(new Slider(1.0, {
    label: 'Scale',
    min: 0.2,
    max: 3.0,
    step: 0.1,
    onChange: (value) => {
        meshSettings.scale = value;
        if (currentMeshView) {
            // Reload to apply new scale
            // For now, just scale directly
            currentMeshView.scale.setScalar(value);
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

panel.add(meshFolder);

// Info
const infoFolder = new Folder('About');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 11px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>Cornell Box + Mesh Evolver</strong><br/><br/>

  Classic Cornell box scene with:<br/>
  - Red/green walls for color bleeding<br/>
  - Quad light on ceiling<br/>
  - Mesh evolver OBJ visualization<br/><br/>

  <strong>Mesh Display:</strong><br/>
  - Gold surface (semi-transparent)<br/>
  - Blue tube edges<br/>
  - Dark vertex spheres<br/><br/>

  Enable path tracing to see<br/>
  beautiful global illumination!
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();

console.log('Cornell Box + Mesh Evolver Path Tracer');
console.log('');
console.log('Load your mesh evolver OBJ files or use the sample meshes.');
console.log('Enable Path Tracing for photorealistic rendering.');
