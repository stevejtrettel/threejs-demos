/**
 * Path Traced Mesh Studio Scene
 *
 * A professional studio setup for rendering mesh evolver outputs
 * with dramatic colored lighting and gradient backgrounds.
 *
 * Features:
 * - Three-point lighting system with colored PhysicalSpotLights
 * - Reflective floor with adjustable properties
 * - Gradient environment background
 * - Full control over light positions and colors
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
import { PhysicalCamera, PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { saveAs } from 'file-saver';

import { parseOBJ, loadOBJFile, type ParsedMesh } from '@/math/mesh/parseOBJ';
import { MeshVisualizer } from '@/math/mesh/MeshVisualizer';

// ===================================
// APP SETUP
// ===================================

const app = new App({
    debug: true,
    antialias: true,
    pathTracerDefaults: {
        bounces: 10,
        samples: 1
    }
});

// ===================================
// GRADIENT ENVIRONMENT
// ===================================

const gradientTexture = new GradientEquirectTexture();
gradientTexture.topColor.set(0xffffff);  // White
gradientTexture.bottomColor.set(0xe8e8e8);  // Slight gray at horizon
gradientTexture.update();
app.scene.environment = gradientTexture;
app.scene.background = gradientTexture;

// ===================================
// STUDIO FLOOR
// ===================================

const floorMat = new THREE.MeshPhysicalMaterial({
    color: 0xfafafa,  // Off-white
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
});

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    floorMat
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
app.scene.add(floor);

// ===================================
// THREE-POINT LIGHTING SYSTEM
// ===================================

// Helper to create a spotlight with standard settings
function createSpotlight(color: number, intensity: number, position: THREE.Vector3): PhysicalSpotLight {
    const light = new PhysicalSpotLight(color);
    light.position.copy(position);
    light.angle = Math.PI / 4;
    light.decay = 0;
    light.penumbra = 0.8;
    light.distance = 0;
    light.intensity = intensity;
    light.radius = 0.25;

    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 30.0;
    light.castShadow = true;

    light.target.position.set(0, 2, 0);

    return light;
}

// Key light - warm white from upper left front
const keyLight = createSpotlight(0xfff5e6, 10, new THREE.Vector3(-5, 8, 4));
app.scene.add(keyLight);
app.scene.add(keyLight.target);

// Fill light - cool white from right
const fillLight = createSpotlight(0xe6f0ff, 6, new THREE.Vector3(6, 5, 3));
fillLight.angle = Math.PI / 3;
app.scene.add(fillLight);
app.scene.add(fillLight.target);

// Rim/back light - slight magenta tint from behind
const rimLight = createSpotlight(0xffe6f0, 8, new THREE.Vector3(0, 6, -5));
rimLight.angle = Math.PI / 3;
app.scene.add(rimLight);
app.scene.add(rimLight.target);

// Preview lights for WebGL mode (disabled during path tracing)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
app.scene.add(ambientLight);

const previewLight = new THREE.DirectionalLight(0xffffff, 0.8);
previewLight.position.set(3, 6, 4);
app.scene.add(previewLight);

// ===================================
// MESH VISUALIZATION
// ===================================

let visualizer: MeshVisualizer | null = null;
let currentParsedMesh: ParsedMesh | null = null;

const meshSettings = {
    scale: 1.0,
    positionY: 2.0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    showVertices: true,
    showEdges: true,
    showFaces: true,
    vertexColor: '#1a1a1a',
    edgeColor: '#4488cc',
    faceColor: '#ddaa77'
};

function reloadCurrentMesh() {
    if (currentParsedMesh) {
        showMesh(currentParsedMesh);
    }
}

function showMesh(parsed: ParsedMesh) {
    currentParsedMesh = parsed;

    if (visualizer) {
        app.scene.remove(visualizer);
        visualizer.dispose();
        visualizer = null;
    }

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

    // Center and scale
    const bbox = new THREE.Box3().setFromObject(visualizer);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (2.0 / maxDim) * meshSettings.scale;

    visualizer.scale.setScalar(scale);
    visualizer.position.set(
        -center.x * scale,
        meshSettings.positionY - center.y * scale,
        -center.z * scale
    );
    visualizer.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);

    app.scene.add(visualizer);

    // Update spotlight targets to point at mesh center
    const meshCenter = new THREE.Vector3(0, meshSettings.positionY, 0);
    keyLight.target.position.copy(meshCenter);
    fillLight.target.position.copy(meshCenter);
    rimLight.target.position.copy(meshCenter);

    if (app.renderManager.isPathTracing()) {
        app.renderManager.notifyMaterialsChanged();
        app.renderManager.resetAccumulation();
    }

    console.log(`Loaded mesh: ${parsed.vertices.length} vertices, ${parsed.faces.length} faces`);
}

function createTorus(majorRadius = 1.0, minorRadius = 0.4, majorSegments = 24, minorSegments = 12): string {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    for (let i = 0; i < majorSegments; i++) {
        const theta = (i / majorSegments) * Math.PI * 2;
        for (let j = 0; j < minorSegments; j++) {
            const phi = (j / minorSegments) * Math.PI * 2;
            vertices.push([
                (majorRadius + minorRadius * Math.cos(phi)) * Math.cos(theta),
                minorRadius * Math.sin(phi),
                (majorRadius + minorRadius * Math.cos(phi)) * Math.sin(theta)
            ]);
        }
    }

    for (let i = 0; i < majorSegments; i++) {
        for (let j = 0; j < minorSegments; j++) {
            const v0 = i * minorSegments + j;
            const v1 = ((i + 1) % majorSegments) * minorSegments + j;
            const v2 = ((i + 1) % majorSegments) * minorSegments + ((j + 1) % minorSegments);
            const v3 = i * minorSegments + ((j + 1) % minorSegments);
            faces.push([v0, v1, v2], [v0, v2, v3]);
        }
    }

    let obj = '# Torus\n';
    vertices.forEach(([x, y, z]) => obj += `v ${x} ${y} ${z}\n`);
    faces.forEach(([a, b, c]) => obj += `f ${a + 1} ${b + 1} ${c + 1}\n`);
    return obj;
}

// Load default mesh
showMesh(parseOBJ(createTorus()));

// ===================================
// PHYSICAL CAMERA
// ===================================

const physicalCamera = new PhysicalCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
physicalCamera.position.set(0, 3.5, 7);
physicalCamera.lookAt(0, 2, 0);

(app.cameraManager as any).camera = physicalCamera;
(app.controls.controls as any).object = physicalCamera;
(app.layout as any).camera = physicalCamera;

// ===================================
// FOCUS PLANE HELPER
// ===================================

const focusPlaneHelper = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 2.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
);
focusPlaneHelper.visible = false;
app.scene.add(focusPlaneHelper);

let showFocusPlane = false;
let focusDistance = 6.0;

app.addAnimateCallback(() => {
    if (!showFocusPlane || app.renderManager.isPathTracing()) {
        focusPlaneHelper.visible = false;
        return;
    }
    focusPlaneHelper.visible = true;
    const dir = new THREE.Vector3();
    app.camera.getWorldDirection(dir);
    focusPlaneHelper.position.copy(app.camera.position).addScaledVector(dir, focusDistance);
    focusPlaneHelper.quaternion.copy(app.camera.quaternion);
});

// ===================================
// UI PANEL
// ===================================

const panel = new Panel('Studio');

// Actions
const actionsFolder = new Folder('Actions');

actionsFolder.add(new Button('Load OBJ File', async () => {
    const parsed = await loadOBJFile();
    if (parsed) showMesh(parsed);
}));

let isPathTracing = false;
const pathTraceButton = new Button('▶ Start Path Trace', () => {
    isPathTracing = !isPathTracing;
    if (isPathTracing) {
        previewLight.intensity = 0;
        ambientLight.intensity = 0;
        app.enablePathTracing();
        pathTraceButton.setLabel('■ Stop Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#c94444';
    } else {
        app.disablePathTracing();
        previewLight.intensity = 0.8;
        ambientLight.intensity = 0.15;
        pathTraceButton.setLabel('▶ Start Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#44aa44';
    }
});
pathTraceButton.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold;padding:8px 12px';
actionsFolder.add(pathTraceButton);

actionsFolder.add(new Button('Download Image', () => {
    app.renderManager.render(app.scene, app.camera);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    app.renderManager.renderer.domElement.toBlob(blob => blob && saveAs(blob, `studio-${ts}.png`));
}));

panel.add(actionsFolder);

// Camera
app.renderManager.setDOFEnabled(true);
app.renderManager.setFStop(16);

const cameraFolder = new Folder('Camera');
cameraFolder.add(new Slider(50, { label: 'FOV', min: 20, max: 90, step: 1, onChange: v => {
    app.camera.fov = v;
    (app.camera as any).updateProjectionMatrix();
    if (app.renderManager.isPathTracing()) app.renderManager.resetAccumulation();
}}));
cameraFolder.add(new Slider(6.0, { label: 'Focus Distance', min: 0.5, max: 15, step: 0.1, onChange: v => {
    focusDistance = v;
    app.renderManager.setFocusDistance(v);
}}));
cameraFolder.add(new Slider(16, { label: 'f-Stop', min: 0.5, max: 16, step: 0.1, onChange: v => app.renderManager.setFStop(v) }));
cameraFolder.add(new Toggle(false, { label: 'Show Focus Plane', onChange: v => showFocusPlane = v }));
panel.add(cameraFolder);
cameraFolder.close();

// Mesh Transform
const transformFolder = new Folder('Mesh Transform');
transformFolder.add(new Slider(1.0, { label: 'Scale', min: 0.2, max: 3.0, step: 0.1, onChange: v => {
    meshSettings.scale = v;
    reloadCurrentMesh();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate X', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationX = v;
    if (visualizer) { visualizer.rotation.x = v; if (app.renderManager.isPathTracing()) app.renderManager.resetAccumulation(); }
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationY = v;
    if (visualizer) { visualizer.rotation.y = v; if (app.renderManager.isPathTracing()) app.renderManager.resetAccumulation(); }
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Z', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationZ = v;
    if (visualizer) { visualizer.rotation.z = v; if (app.renderManager.isPathTracing()) app.renderManager.resetAccumulation(); }
}}));
panel.add(transformFolder);
transformFolder.close();

// Mesh Appearance
const appearanceFolder = new Folder('Mesh Appearance');
appearanceFolder.add(new Toggle(true, { label: 'Show Vertices', onChange: v => { meshSettings.showVertices = v; reloadCurrentMesh(); }}));
appearanceFolder.add(new Toggle(true, { label: 'Show Edges', onChange: v => { meshSettings.showEdges = v; reloadCurrentMesh(); }}));
appearanceFolder.add(new Toggle(true, { label: 'Show Faces', onChange: v => { meshSettings.showFaces = v; reloadCurrentMesh(); }}));
appearanceFolder.add(new ColorInput(meshSettings.vertexColor, { label: 'Vertex Color', onChange: c => { meshSettings.vertexColor = c; reloadCurrentMesh(); }}));
appearanceFolder.add(new ColorInput(meshSettings.edgeColor, { label: 'Edge Color', onChange: c => { meshSettings.edgeColor = c; reloadCurrentMesh(); }}));
appearanceFolder.add(new ColorInput(meshSettings.faceColor, { label: 'Face Color', onChange: c => { meshSettings.faceColor = c; reloadCurrentMesh(); }}));
panel.add(appearanceFolder);
appearanceFolder.close();

// Lighting - Key Light
const keyLightFolder = new Folder('Key Light (Warm)');
keyLightFolder.add(new ColorInput('#fff5e6', { label: 'Color', onChange: c => {
    keyLight.color.set(c);
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
keyLightFolder.add(new Slider(10, { label: 'Intensity', min: 0, max: 30, step: 0.5, onChange: v => {
    keyLight.intensity = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
keyLightFolder.add(new Slider(-5, { label: 'X Position', min: -10, max: 10, step: 0.5, onChange: v => {
    keyLight.position.x = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
keyLightFolder.add(new Slider(8, { label: 'Y Position', min: 2, max: 15, step: 0.5, onChange: v => {
    keyLight.position.y = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
panel.add(keyLightFolder);

// Lighting - Fill Light
const fillLightFolder = new Folder('Fill Light (Cool)');
fillLightFolder.add(new ColorInput('#e6f0ff', { label: 'Color', onChange: c => {
    fillLight.color.set(c);
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
fillLightFolder.add(new Slider(6, { label: 'Intensity', min: 0, max: 30, step: 0.5, onChange: v => {
    fillLight.intensity = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
panel.add(fillLightFolder);
fillLightFolder.close();

// Lighting - Rim Light
const rimLightFolder = new Folder('Rim Light (Accent)');
rimLightFolder.add(new ColorInput('#ffe6f0', { label: 'Color', onChange: c => {
    rimLight.color.set(c);
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
rimLightFolder.add(new Slider(8, { label: 'Intensity', min: 0, max: 30, step: 0.5, onChange: v => {
    rimLight.intensity = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
panel.add(rimLightFolder);
rimLightFolder.close();

// Floor
const floorFolder = new Folder('Floor');
floorFolder.add(new ColorInput('#fafafa', { label: 'Color', onChange: c => {
    floorMat.color.set(c);
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
floorFolder.add(new Slider(0.4, { label: 'Roughness', min: 0, max: 1, step: 0.05, onChange: v => {
    floorMat.roughness = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
floorFolder.add(new Slider(0.2, { label: 'Clearcoat', min: 0, max: 1, step: 0.05, onChange: v => {
    floorMat.clearcoat = v;
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
panel.add(floorFolder);
floorFolder.close();

// Environment
const envFolder = new Folder('Environment');
envFolder.add(new ColorInput('#ffffff', { label: 'Sky Color', onChange: c => {
    gradientTexture.topColor.set(c);
    gradientTexture.update();
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
envFolder.add(new ColorInput('#e8e8e8', { label: 'Horizon Color', onChange: c => {
    gradientTexture.bottomColor.set(c);
    gradientTexture.update();
    if (app.renderManager.isPathTracing()) { app.renderManager.notifyMaterialsChanged(); app.renderManager.resetAccumulation(); }
}}));
panel.add(envFolder);
envFolder.close();

// Path Tracer
const ptFolder = new Folder('Path Tracer');
ptFolder.add(new Slider(10, { label: 'Bounces', min: 1, max: 20, step: 1, onChange: v => app.renderManager.setBounces(v) }));
ptFolder.add(new Button('Reset Accumulation', () => app.renderManager.resetAccumulation()));
panel.add(ptFolder);
ptFolder.close();

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();
console.log('Studio Path Tracer - Three-point lighting with colored spotlights');
