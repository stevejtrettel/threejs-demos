/**
 * Path Traced Mesh Studio Scene
 *
 * A professional studio setup for rendering mesh evolver outputs
 * with dramatic colored lighting and gradient backgrounds.
 *
 * Features:
 * - Support for grouped OBJ files with per-group coloring
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

import { GroupedOBJMesh } from '@/math/mesh/GroupedOBJMesh';

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

const envTexture = new GradientEquirectTexture();
envTexture.topColor.set(0x555566);
envTexture.bottomColor.set(0x888888);
envTexture.update();
app.scene.environment = envTexture;
app.scene.background = envTexture;

// ===================================
// STUDIO FLOOR
// ===================================

const floorMat = new THREE.MeshPhysicalMaterial({
    color: 0xfafafa,
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

const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 20),
    floorMat
);
backWall.position.set(0, 10, -15);
app.scene.add(backWall);

// ===================================
// THREE-POINT LIGHTING SYSTEM
// ===================================

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
    light.target.position.set(0, 1.2, 0);
    return light;
}

const lightRig = {
    keyDir: new THREE.Vector3(-1, 0, 0.8).normalize(),
    fillDir: new THREE.Vector3(1, 0, 0.6).normalize(),
    rimDir: new THREE.Vector3(0, 0, -1).normalize(),
    distance: 6,
    height: 7,
    spread: Math.PI / 4,
    intensity: 10,
};

function updateLightPositions() {
    const d = lightRig.distance;
    const h = lightRig.height;
    keyLight.position.set(lightRig.keyDir.x * d, h, lightRig.keyDir.z * d);
    fillLight.position.set(lightRig.fillDir.x * d, h - 1, lightRig.fillDir.z * d);
    rimLight.position.set(lightRig.rimDir.x * d, h - 1, lightRig.rimDir.z * d);
}

function updateLightAngles() {
    keyLight.angle = lightRig.spread;
    fillLight.angle = lightRig.spread;
    rimLight.angle = lightRig.spread;
}

function updateLightIntensities() {
    keyLight.intensity = lightRig.intensity * 1.2;
    fillLight.intensity = lightRig.intensity * 0.8;
    rimLight.intensity = lightRig.intensity;
}

const keyLight = createSpotlight(0xffddaa, 12, new THREE.Vector3(-5, 8, 4));
app.scene.add(keyLight);
app.scene.add(keyLight.target);

const fillLight = createSpotlight(0xaaccff, 8, new THREE.Vector3(6, 5, 3));
app.scene.add(fillLight);
app.scene.add(fillLight.target);

const rimLight = createSpotlight(0xffaacc, 10, new THREE.Vector3(0, 6, -5));
app.scene.add(rimLight);
app.scene.add(rimLight.target);

updateLightPositions();
updateLightAngles();
updateLightIntensities();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
app.scene.add(ambientLight);

const previewLight = new THREE.DirectionalLight(0xffffff, 0.8);
previewLight.position.set(3, 6, 4);
app.scene.add(previewLight);

// ===================================
// MESH STATE
// ===================================

let currentObjMesh: GroupedOBJMesh | null = null;
let groupColorsFolder: Folder | null = null;

const meshSettings = {
    scale: 1.0,
    positionY: 1.2,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
};

// ===================================
// UI HELPERS
// ===================================

function rebuildGroupColorUI() {
    if (!groupColorsFolder || !currentObjMesh) return;

    // Clear existing color inputs
    groupColorsFolder.domElement.querySelectorAll('.cr-color-input').forEach(el => el.remove());

    // Add color pickers for front and back of each group
    for (const groupName of currentObjMesh.groups) {
        const displayName = groupName === 'default' ? 'Default' : `Group ${groupName}`;

        groupColorsFolder.add(new ColorInput(currentObjMesh.getFaceColor(groupName, 'front'), {
            label: `${displayName} Front`,
            onChange: (c: string) => {
                currentObjMesh?.setFaceColor(groupName, 'front', c);
                notifyPathTracerIfNeeded();
            }
        }));
        groupColorsFolder.add(new ColorInput(currentObjMesh.getFaceColor(groupName, 'back'), {
            label: `${displayName} Back`,
            onChange: (c: string) => {
                currentObjMesh?.setFaceColor(groupName, 'back', c);
                notifyPathTracerIfNeeded();
            }
        }));
    }
}

function notifyPathTracerIfNeeded() {
    if (app.renderManager.isPathTracing()) {
        app.renderManager.notifyMaterialsChanged();
        app.renderManager.resetAccumulation();
    }
}

// ===================================
// MESH DISPLAY
// ===================================

function showObjMesh(objString: string): void {
    // Remove existing
    if (currentObjMesh) {
        app.scene.remove(currentObjMesh);
        currentObjMesh.dispose();
        currentObjMesh = null;
    }

    // Create new GroupedOBJMesh
    currentObjMesh = GroupedOBJMesh.fromOBJ(objString);

    // Apply transform
    currentObjMesh.scale.setScalar(meshSettings.scale);
    currentObjMesh.position.set(0, meshSettings.positionY, 0);
    currentObjMesh.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);

    app.scene.add(currentObjMesh);

    console.log(`Loaded: ${currentObjMesh.vertexCount} vertices, ${currentObjMesh.faceCount} faces`);
    if (currentObjMesh.groups.length > 0) {
        console.log(`Groups: ${currentObjMesh.groups.join(', ')}`);
    }

    // Update spotlight targets
    const meshCenter = new THREE.Vector3(0, meshSettings.positionY, 0);
    keyLight.target.position.copy(meshCenter);
    fillLight.target.position.copy(meshCenter);
    rimLight.target.position.copy(meshCenter);

    // Update UI with group colors
    rebuildGroupColorUI();

    notifyPathTracerIfNeeded();
}

// ===================================
// SAMPLE DATA
// ===================================

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
showObjMesh(createTorus());

// ===================================
// PHYSICAL CAMERA
// ===================================

const physicalCamera = new PhysicalCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
physicalCamera.position.set(0, 2.5, 5);
physicalCamera.lookAt(0, 1.2, 0);

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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
            const text = await file.text();
            showObjMesh(text);
        }
    };
    input.click();
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
    if (currentObjMesh) {
        currentObjMesh.scale.setScalar(v);
        notifyPathTracerIfNeeded();
    }
}}));
transformFolder.add(new Slider(0, { label: 'Rotate X', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationX = v;
    if (currentObjMesh) { currentObjMesh.rotation.x = v; notifyPathTracerIfNeeded(); }
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationY = v;
    if (currentObjMesh) { currentObjMesh.rotation.y = v; notifyPathTracerIfNeeded(); }
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Z', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationZ = v;
    if (currentObjMesh) { currentObjMesh.rotation.z = v; notifyPathTracerIfNeeded(); }
}}));
panel.add(transformFolder);
transformFolder.close();

// Mesh Appearance
const appearanceFolder = new Folder('Mesh Appearance');
appearanceFolder.add(new Toggle(true, { label: 'Show Vertices', onChange: v => {
    currentObjMesh?.setVerticesVisible(v);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new Toggle(true, { label: 'Show Edges', onChange: v => {
    currentObjMesh?.setEdgesVisible(v);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new Toggle(true, { label: 'Show Faces', onChange: v => {
    currentObjMesh?.setFacesVisible(v);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new Slider(0.06, { label: 'Vertex Radius', min: 0.01, max: 0.15, step: 0.005, onChange: v => {
    currentObjMesh?.setSphereRadius(v);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new Slider(0.025, { label: 'Edge Radius', min: 0.005, max: 0.08, step: 0.002, onChange: v => {
    currentObjMesh?.setTubeRadius(v);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new ColorInput('#1a1a1a', { label: 'Vertex Color', onChange: c => {
    currentObjMesh?.setVertexColor(c);
    notifyPathTracerIfNeeded();
}}));
appearanceFolder.add(new ColorInput('#4488cc', { label: 'Edge Color', onChange: c => {
    currentObjMesh?.setEdgeColor(c);
    notifyPathTracerIfNeeded();
}}));
panel.add(appearanceFolder);

// Create the Group Colors folder and trigger initial population
groupColorsFolder = new Folder('Group Colors');
panel.add(groupColorsFolder);
rebuildGroupColorUI();

// Lighting
const lightingFolder = new Folder('Lighting');
lightingFolder.add(new Slider(6, { label: 'Distance', min: 2, max: 12, step: 0.5, onChange: v => {
    lightRig.distance = v;
    updateLightPositions();
    notifyPathTracerIfNeeded();
}}));
lightingFolder.add(new Slider(Math.PI / 4, { label: 'Spread', min: 0.1, max: Math.PI / 2, step: 0.05, onChange: v => {
    lightRig.spread = v;
    updateLightAngles();
    notifyPathTracerIfNeeded();
}}));
lightingFolder.add(new Slider(10, { label: 'Intensity', min: 0, max: 30, step: 0.5, onChange: v => {
    lightRig.intensity = v;
    updateLightIntensities();
    notifyPathTracerIfNeeded();
}}));
lightingFolder.add(new ColorInput('#ffddaa', { label: 'Key (Warm)', onChange: c => {
    keyLight.color.set(c);
    notifyPathTracerIfNeeded();
}}));
lightingFolder.add(new ColorInput('#aaccff', { label: 'Fill (Cool)', onChange: c => {
    fillLight.color.set(c);
    notifyPathTracerIfNeeded();
}}));
lightingFolder.add(new ColorInput('#ffaacc', { label: 'Rim (Accent)', onChange: c => {
    rimLight.color.set(c);
    notifyPathTracerIfNeeded();
}}));
panel.add(lightingFolder);

// Floor & Wall
const floorFolder = new Folder('Floor & Wall');
floorFolder.add(new Toggle(true, { label: 'Show Floor & Wall', onChange: v => {
    floor.visible = v;
    backWall.visible = v;
    notifyPathTracerIfNeeded();
}}));
floorFolder.add(new Slider(0, { label: 'Floor Height', min: -3, max: 3, step: 0.1, onChange: v => {
    floor.position.y = v;
    notifyPathTracerIfNeeded();
}}));
floorFolder.add(new ColorInput('#fafafa', { label: 'Color', onChange: c => {
    floorMat.color.set(c);
    notifyPathTracerIfNeeded();
}}));
floorFolder.add(new Slider(0.4, { label: 'Roughness', min: 0, max: 1, step: 0.05, onChange: v => {
    floorMat.roughness = v;
    notifyPathTracerIfNeeded();
}}));
floorFolder.add(new Slider(0.2, { label: 'Clearcoat', min: 0, max: 1, step: 0.05, onChange: v => {
    floorMat.clearcoat = v;
    notifyPathTracerIfNeeded();
}}));
panel.add(floorFolder);
floorFolder.close();

// Environment
const envFolder = new Folder('Environment');
envFolder.add(new ColorInput('#555566', { label: 'Sky Color', onChange: c => {
    envTexture.topColor.set(c);
    envTexture.update();
    notifyPathTracerIfNeeded();
}}));
envFolder.add(new ColorInput('#888888', { label: 'Horizon Color', onChange: c => {
    envTexture.bottomColor.set(c);
    envTexture.update();
    notifyPathTracerIfNeeded();
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
console.log('Studio Path Tracer - Using GroupedOBJMesh for grouped OBJ files');
