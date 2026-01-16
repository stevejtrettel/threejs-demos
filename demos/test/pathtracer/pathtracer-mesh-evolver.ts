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
import { ColorInput } from '@/ui/inputs/ColorInput';
import '@/ui/styles/index.css';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { PhysicalCamera } from 'three-gpu-pathtracer';
import { saveAs } from 'file-saver';

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
let currentParsedMesh: ParsedMesh | null = null;

// Helper to reload mesh with current settings (for color/visibility changes)
function reloadCurrentMesh() {
    if (currentParsedMesh) {
        showMesh(currentParsedMesh);
    }
}

// Mesh transform and appearance settings
const meshSettings = {
    // Transform
    scale: 1.0,
    positionY: 2.5,  // Object sits on a pedestal height
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    // Appearance
    showVertices: true,
    showEdges: true,
    showFaces: true,
    vertexColor: '#222222',
    edgeColor: '#3366aa',
    faceColor: '#ffcc88'
};

/**
 * Display a parsed mesh using MeshVisualizer
 */
function showMesh(parsed: ParsedMesh) {
    // Store for later reloading
    currentParsedMesh = parsed;

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
        vertexColor: meshSettings.vertexColor,
        edgeColor: meshSettings.edgeColor,
        faceColor: meshSettings.faceColor,
        faceOpacity: 0.95,
        showVertices: meshSettings.showVertices,
        showEdges: meshSettings.showEdges,
        showFaces: meshSettings.showFaces,
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

/**
 * Create a torus mesh
 */
function createTorus(majorRadius: number = 1.0, minorRadius: number = 0.4, majorSegments: number = 24, minorSegments: number = 12) {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    // Generate vertices
    for (let i = 0; i < majorSegments; i++) {
        const theta = (i / majorSegments) * Math.PI * 2;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        for (let j = 0; j < minorSegments; j++) {
            const phi = (j / minorSegments) * Math.PI * 2;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);

            const x = (majorRadius + minorRadius * cosPhi) * cosTheta;
            const y = minorRadius * sinPhi;
            const z = (majorRadius + minorRadius * cosPhi) * sinTheta;

            vertices.push([x, y, z]);
        }
    }

    // Generate faces (quads split into triangles)
    for (let i = 0; i < majorSegments; i++) {
        const nextI = (i + 1) % majorSegments;
        for (let j = 0; j < minorSegments; j++) {
            const nextJ = (j + 1) % minorSegments;

            const v0 = i * minorSegments + j;
            const v1 = nextI * minorSegments + j;
            const v2 = nextI * minorSegments + nextJ;
            const v3 = i * minorSegments + nextJ;

            // Two triangles per quad
            faces.push([v0, v1, v2]);
            faces.push([v0, v2, v3]);
        }
    }

    // Generate OBJ format
    let objText = '# Torus\n';
    for (const [x, y, z] of vertices) {
        objText += `v ${x} ${y} ${z}\n`;
    }
    for (const [a, b, c] of faces) {
        objText += `f ${a + 1} ${b + 1} ${c + 1}\n`;
    }

    return objText;
}

// Load torus as default mesh
loadAndDisplayOBJ(createTorus());

// ===================================
// CAMERA SETUP (using PhysicalCamera for DOF support)
// ===================================

// Create a PhysicalCamera for DOF support in path tracing
// PhysicalCamera extends PerspectiveCamera with fStop, focusDistance, etc.
const physicalCamera = new PhysicalCamera(
    50,  // fov
    window.innerWidth / window.innerHeight,  // aspect
    0.1,  // near
    1000  // far
);
physicalCamera.position.set(0, 4, 6);
physicalCamera.lookAt(0, 2.5, 0);

// Default DOF settings (DOF disabled by default - very high fStop)
physicalCamera.focusDistance = 5;
physicalCamera.fStop = 10000;  // Effectively disabled until DOF toggle is enabled
physicalCamera.apertureBlades = 0;

// Replace the app's camera with our PhysicalCamera
// This is needed for the path tracer to recognize DOF settings
(app.cameraManager as any).camera = physicalCamera;
(app.controls.controls as any).object = physicalCamera;  // OrbitControls.object
(app.layout as any).camera = physicalCamera;

// Debug: verify camera is PhysicalCamera
console.log('Camera is PhysicalCamera:', physicalCamera.constructor.name);

// ===================================
// FOCUS PLANE HELPER
// ===================================

// Visual indicator showing where the focus plane is
const focusPlaneSettings = {
    visible: false,
    distance: 5.0
};

// Create a ring/disc to show the focal plane
const focusPlaneGeometry = new THREE.RingGeometry(0.3, 2.5, 64);
const focusPlaneMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false
});
const focusPlaneHelper = new THREE.Mesh(focusPlaneGeometry, focusPlaneMaterial);
focusPlaneHelper.visible = false;
app.scene.add(focusPlaneHelper);

// Update focus plane position to be at focusDistance from camera
function updateFocusPlane() {
    if (!focusPlaneSettings.visible) {
        focusPlaneHelper.visible = false;
        return;
    }

    // Hide during path tracing (it would render in the image)
    if (app.renderManager.isPathTracing()) {
        focusPlaneHelper.visible = false;
        return;
    }

    focusPlaneHelper.visible = true;

    // Get camera direction
    const direction = new THREE.Vector3();
    app.camera.getWorldDirection(direction);

    // Position at focus distance from camera
    focusPlaneHelper.position.copy(app.camera.position);
    focusPlaneHelper.position.addScaledVector(direction, focusPlaneSettings.distance);

    // Orient perpendicular to camera view (face the camera)
    focusPlaneHelper.quaternion.copy(app.camera.quaternion);
}

// Update focus plane on each frame
app.addAnimateCallback(() => {
    updateFocusPlane();
});

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
// DOF HELPER - Direct access to path tracer internals
// ===================================

// Apply DOF settings directly to path tracer's internal uniform
// This bypasses the instanceof PhysicalCamera check which can fail
// due to module duplication issues
function applyDOFToPathTracer() {
    const pt = (app.renderManager as any).pathTracer;
    if (!pt) return;

    // Access the internal _pathTracer and its material
    const material = pt._pathTracer?.material;
    if (!material?.uniforms?.physicalCamera?.value) {
        console.warn('Could not access path tracer physicalCamera uniform');
        return;
    }

    const uniform = material.uniforms.physicalCamera.value;

    // Calculate bokehSize from camera settings
    // bokehSize = focalLength / fStop (in mm)
    // Manual focal length calculation (getFocalLength might be unreliable)
    const fov = physicalCamera.fov;
    const filmGauge = physicalCamera.filmGauge || 35; // mm
    const focalLength = filmGauge / (2 * Math.tan(fov * Math.PI / 360));

    // bokehSize in mm, boosted for testing
    const bokehSize = dofEnabled ? (focalLength / physicalCamera.fStop) * 10 : 0;

    console.log('Focal length calc:', { fov, filmGauge, focalLength, fStop: physicalCamera.fStop });

    uniform.bokehSize = bokehSize;
    uniform.focusDistance = physicalCamera.focusDistance;
    uniform.apertureBlades = physicalCamera.apertureBlades;
    uniform.apertureRotation = 0;
    uniform.anamorphicRatio = 1;

    // Update the FEATURE_DOF define based on bokehSize
    material.setDefine('FEATURE_DOF', bokehSize > 0 ? 1 : 0);

    console.log('DOF applied:', { bokehSize, focusDistance: uniform.focusDistance, fStop: physicalCamera.fStop });

    app.renderManager.resetAccumulation();
}

// ===================================
// UI PANEL
// ===================================

const panel = new Panel('Path Tracer Studio');

// ─────────────────────────────────────
// TOP-LEVEL ACTIONS (always visible)
// ─────────────────────────────────────

const actionsFolder = new Folder('Actions');

actionsFolder.add(new Button('Load OBJ File', loadFromFilePicker));

// Prominent Path Tracing button with color state
let isPathTracing = false;
const pathTraceButton = new Button('▶ Start Path Trace', () => {
    isPathTracing = !isPathTracing;
    if (isPathTracing) {
        app.enablePathTracing();
        pathTraceButton.setLabel('■ Stop Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#c94444';
        pathTraceButton.domElement.style.color = '#ffffff';

        // Force DOF settings directly on path tracer internal uniform
        // (bypasses instanceof check that may fail due to module duplication)
        applyDOFToPathTracer();
    } else {
        app.disablePathTracing();
        pathTraceButton.setLabel('▶ Start Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#44aa44';
        pathTraceButton.domElement.style.color = '#ffffff';
    }
});
// Initial green styling
pathTraceButton.domElement.style.backgroundColor = '#44aa44';
pathTraceButton.domElement.style.color = '#ffffff';
pathTraceButton.domElement.style.fontWeight = 'bold';
pathTraceButton.domElement.style.padding = '8px 12px';
actionsFolder.add(pathTraceButton);

actionsFolder.add(new Button('Download Image', () => {
    app.renderManager.render(app.scene, app.camera);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    app.renderManager.renderer.domElement.toBlob((blob) => {
        if (blob) {
            saveAs(blob, `render-${timestamp}.png`);
        }
    });
}));

panel.add(actionsFolder);

// ─────────────────────────────────────
// CAMERA (DOF)
// ─────────────────────────────────────

const cameraFolder = new Folder('Camera');

// Track if DOF is enabled (we'll set fStop to Infinity to disable)
let dofEnabled = false;
let savedFStop = 2.8;

cameraFolder.add(new Toggle(false, {
    label: 'Depth of Field',
    onChange: (enabled) => {
        dofEnabled = enabled;
        if (enabled) {
            physicalCamera.fStop = savedFStop;
        } else {
            physicalCamera.fStop = 10000;
        }
        if (app.renderManager.isPathTracing()) {
            applyDOFToPathTracer();
        }
    }
}));

cameraFolder.add(new Toggle(false, {
    label: 'Show Focus Plane',
    onChange: (visible) => {
        focusPlaneSettings.visible = visible;
        updateFocusPlane();
    }
}));

cameraFolder.add(new Slider(5.0, {
    label: 'Focus Distance',
    min: 0.5,
    max: 15,
    step: 0.1,
    onChange: (value) => {
        physicalCamera.focusDistance = value;
        focusPlaneSettings.distance = value;
        updateFocusPlane();
        if (app.renderManager.isPathTracing()) {
            applyDOFToPathTracer();
        }
    }
}));

cameraFolder.add(new Slider(2.8, {
    label: 'f-Stop',
    min: 0.5,
    max: 16,
    step: 0.1,
    onChange: (value) => {
        savedFStop = value;
        if (dofEnabled) {
            physicalCamera.fStop = value;
            if (app.renderManager.isPathTracing()) {
                applyDOFToPathTracer();
            }
        }
    }
}));

cameraFolder.add(new Slider(0, {
    label: 'Aperture Blades',
    min: 0,
    max: 8,
    step: 1,
    onChange: (value) => {
        physicalCamera.apertureBlades = value;
        if (app.renderManager.isPathTracing()) {
            applyDOFToPathTracer();
        }
    }
}));

panel.add(cameraFolder);
cameraFolder.close();

// ─────────────────────────────────────
// MESH TRANSFORM
// ─────────────────────────────────────

const transformFolder = new Folder('Mesh Transform');

transformFolder.add(new Slider(1.0, {
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

transformFolder.add(new Slider(0, {
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

transformFolder.add(new Slider(0, {
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

transformFolder.add(new Slider(0, {
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

panel.add(transformFolder);
transformFolder.close();

// ─────────────────────────────────────
// MESH APPEARANCE
// ─────────────────────────────────────

const appearanceFolder = new Folder('Mesh Appearance');

appearanceFolder.add(new Toggle(true, {
    label: 'Show Vertices',
    onChange: (visible) => {
        meshSettings.showVertices = visible;
        if (visualizer) {
            visualizer.setVerticesVisible(visible);
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

appearanceFolder.add(new Toggle(true, {
    label: 'Show Edges',
    onChange: (visible) => {
        meshSettings.showEdges = visible;
        if (visualizer) {
            visualizer.setEdgesVisible(visible);
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

appearanceFolder.add(new Toggle(true, {
    label: 'Show Faces',
    onChange: (visible) => {
        meshSettings.showFaces = visible;
        if (visualizer) {
            visualizer.setFacesVisible(visible);
            if (app.renderManager.isPathTracing()) {
                app.renderManager.resetAccumulation();
            }
        }
    }
}));

appearanceFolder.add(new ColorInput(meshSettings.vertexColor, {
    label: 'Vertex Color',
    onChange: (color) => {
        meshSettings.vertexColor = color;
        reloadCurrentMesh();
    }
}));

appearanceFolder.add(new ColorInput(meshSettings.edgeColor, {
    label: 'Edge Color',
    onChange: (color) => {
        meshSettings.edgeColor = color;
        reloadCurrentMesh();
    }
}));

appearanceFolder.add(new ColorInput(meshSettings.faceColor, {
    label: 'Face Color',
    onChange: (color) => {
        meshSettings.faceColor = color;
        reloadCurrentMesh();
    }
}));

panel.add(appearanceFolder);
appearanceFolder.close();

// ─────────────────────────────────────
// LIGHTING
// ─────────────────────────────────────

const lightingFolder = new Folder('Lighting');

lightingFolder.add(new Slider(25, {
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

lightingFolder.add(new Slider(6, {
    label: 'Light Size',
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

panel.add(lightingFolder);
lightingFolder.close();

// ─────────────────────────────────────
// PATH TRACER SETTINGS
// ─────────────────────────────────────

const pathTracerFolder = new Folder('Path Tracer');

pathTracerFolder.add(new Slider(8, {
    label: 'Bounces',
    min: 1,
    max: 16,
    step: 1,
    onChange: (value) => {
        app.renderManager.setBounces(value);
    }
}));

pathTracerFolder.add(new Button('Reset Accumulation', () => {
    app.renderManager.resetAccumulation();
}));

panel.add(pathTracerFolder);
pathTracerFolder.close();

// ─────────────────────────────────────
// SAMPLE MESHES
// ─────────────────────────────────────

const samplesFolder = new Folder('Sample Meshes');

samplesFolder.add(new Button('Torus', () => {
    loadAndDisplayOBJ(createTorus());
}));

samplesFolder.add(new Button('Icosahedron', () => {
    loadAndDisplayOBJ(createSampleMesh());
}));

samplesFolder.add(new Button('Subdivided Sphere', () => {
    loadAndDisplayOBJ(createSubdividedIcosahedron(2));
}));

panel.add(samplesFolder);
samplesFolder.close();

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();

console.log('Path Tracer Studio');
console.log('Load OBJ files and render with GPU path tracing.');
