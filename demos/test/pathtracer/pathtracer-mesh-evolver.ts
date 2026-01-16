/**
 * Path Traced Mesh Evolver Scene
 *
 * A white studio scene for rendering mesh evolver outputs with
 * beautiful global illumination via GPU path tracing.
 *
 * Features:
 * - Large white studio with soft lighting
 * - Bright quad light (RectAreaLight) on ceiling
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

// Import new path-tracer-compatible mesh visualization (merged geometry, not instanced)
import { parseOBJ, loadOBJFile, type ParsedMesh } from '@/math/mesh/parseOBJ';
import { MeshVisualizer } from '@/math/mesh/MeshVisualizer';

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
// WHITE STUDIO GEOMETRY
// ===================================

// Studio dimensions - larger room so camera fits inside
const studioWidth = 14;
const studioHeight = 10;
const studioDepth = 14;

// White studio material
const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
});

// Create the white studio
function createStudio() {
    const group = new THREE.Group();

    // Floor
    const floorGeo = new THREE.PlaneGeometry(studioWidth, studioDepth);
    const floor = new THREE.Mesh(floorGeo, whiteMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    group.add(floor);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(studioWidth, studioDepth);
    const ceiling = new THREE.Mesh(ceilingGeo, whiteMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = studioHeight;
    group.add(ceiling);

    // Back wall
    const backWallGeo = new THREE.PlaneGeometry(studioWidth, studioHeight);
    const backWall = new THREE.Mesh(backWallGeo, whiteMat);
    backWall.position.z = -studioDepth / 2;
    backWall.position.y = studioHeight / 2;
    group.add(backWall);

    // Left wall
    const leftWallGeo = new THREE.PlaneGeometry(studioDepth, studioHeight);
    const leftWall = new THREE.Mesh(leftWallGeo, whiteMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -studioWidth / 2;
    leftWall.position.y = studioHeight / 2;
    group.add(leftWall);

    // Right wall
    const rightWallGeo = new THREE.PlaneGeometry(studioDepth, studioHeight);
    const rightWall = new THREE.Mesh(rightWallGeo, whiteMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = studioWidth / 2;
    rightWall.position.y = studioHeight / 2;
    group.add(rightWall);

    // Front wall (behind camera)
    const frontWallGeo = new THREE.PlaneGeometry(studioWidth, studioHeight);
    const frontWall = new THREE.Mesh(frontWallGeo, whiteMat);
    frontWall.rotation.y = Math.PI;  // Face inward
    frontWall.position.z = studioDepth / 2;
    frontWall.position.y = studioHeight / 2;
    group.add(frontWall);

    return group;
}

// Create and add studio
const studio = createStudio();
app.scene.add(studio);

// ===================================
// QUAD LIGHT (RectAreaLight)
// ===================================

// Large bright area light on the ceiling
const lightWidth = 6;
const lightHeight = 6;
const rectLight = new THREE.RectAreaLight(0xffffff, 25, lightWidth, lightHeight);
rectLight.position.set(0, studioHeight - 0.01, 0); // Just below ceiling
rectLight.rotation.x = Math.PI / 2; // Point downward
app.scene.add(rectLight);

// Visible light panel (emissive plane)
const lightPanelGeo = new THREE.PlaneGeometry(lightWidth, lightHeight);
const lightPanelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 5,
    side: THREE.DoubleSide
});
const lightPanel = new THREE.Mesh(lightPanelGeo, lightPanelMat);
lightPanel.position.copy(rectLight.position);
lightPanel.rotation.x = -Math.PI / 2;
app.scene.add(lightPanel);

// Subtle ambient for WebGL preview
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
app.scene.add(ambientLight);

// ===================================
// MESH EVOLVER VISUALIZATION
// ===================================

// Current visualizer (uses merged geometry for path tracer compatibility)
let visualizer: MeshVisualizer | null = null;

// Scale, position, and rotation settings
const meshSettings = {
    scale: 1.0,
    positionY: 2.5,  // Object sits on a pedestal height
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0
};

/**
 * Display a parsed mesh using MeshVisualizer
 */
function showMesh(parsed: ParsedMesh) {
    // Remove existing visualizer
    if (visualizer) {
        app.scene.remove(visualizer);
        visualizer.dispose();
        visualizer = null;
    }

    // Create new visualizer with merged geometry (path tracer compatible)
    visualizer = new MeshVisualizer(parsed, {
        sphereRadius: 0.06,
        tubeRadius: 0.025,
        vertexColor: 0x222222,    // Dark vertices
        edgeColor: 0x3366aa,      // Blue edges
        faceColor: 0xffcc88,      // Warm gold faces
        faceOpacity: 0.95,
        showVertices: true,
        showEdges: true,
        showFaces: true,
    });

    // Center and scale the mesh
    const bbox = new THREE.Box3().setFromObject(visualizer);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Scale to fit nicely in the Cornell box (about 2 units)
    const targetSize = 2.0;
    const scale = targetSize / maxDim * meshSettings.scale;

    visualizer.scale.setScalar(scale);
    visualizer.position.set(
        -center.x * scale,
        meshSettings.positionY - center.y * scale,
        -center.z * scale
    );
    visualizer.rotation.set(
        meshSettings.rotationX,
        meshSettings.rotationY,
        meshSettings.rotationZ
    );

    app.scene.add(visualizer);

    // Notify pathtracer of scene change
    if (app.renderManager.isPathTracing()) {
        app.renderManager.notifyMaterialsChanged();
        app.renderManager.resetAccumulation();
    }

    console.log(`Loaded mesh: ${parsed.vertices.length} vertices, ${parsed.faces.length} faces`);
}

/**
 * Load and display an OBJ file as a mesh evolver visualization
 */
function loadAndDisplayOBJ(objText: string) {
    try {
        const parsed = parseOBJ(objText);
        showMesh(parsed);
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

// Camera inside the studio, looking at the object
app.camera.position.set(0, 4, 6);
app.camera.lookAt(0, 2.5, 0);

// ===================================
// FILE INPUT FOR OBJ LOADING
// ===================================

// Use the built-in loadOBJFile picker
async function loadFromFilePicker() {
    const parsed = await loadOBJFile();
    if (parsed) {
        showMesh(parsed);
    }
}

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

lightFolder.add(new Slider(25, {
    label: 'Intensity',
    min: 0,
    max: 80,
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

lightFolder.add(new Slider(6, {
    label: 'Size',
    min: 1,
    max: 10,
    step: 0.5,
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

meshFolder.add(new Button('Load OBJ File', loadFromFilePicker));

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
        if (visualizer) {
            visualizer.scale.setScalar(value);
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

// Rotation sliders
meshFolder.add(new Slider(0, {
    label: 'Rotate X',
    min: -Math.PI,
    max: Math.PI,
    step: 0.05,
    onChange: (value) => {
        meshSettings.rotationX = value;
        if (visualizer) {
            visualizer.rotation.x = value;
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

meshFolder.add(new Slider(0, {
    label: 'Rotate Y',
    min: -Math.PI,
    max: Math.PI,
    step: 0.05,
    onChange: (value) => {
        meshSettings.rotationY = value;
        if (visualizer) {
            visualizer.rotation.y = value;
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

meshFolder.add(new Slider(0, {
    label: 'Rotate Z',
    min: -Math.PI,
    max: Math.PI,
    step: 0.05,
    onChange: (value) => {
        meshSettings.rotationZ = value;
        if (visualizer) {
            visualizer.rotation.z = value;
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
  <strong>White Studio + Mesh Evolver</strong><br/><br/>

  Clean white studio with:<br/>
  - Large soft quad light<br/>
  - Mesh evolver OBJ visualization<br/><br/>

  <strong>Mesh Display:</strong><br/>
  - Gold surface<br/>
  - Blue tube edges<br/>
  - Dark vertex spheres<br/><br/>

  Enable path tracing for<br/>
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
