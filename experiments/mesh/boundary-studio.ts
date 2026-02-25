/**
 * Boundary Studio - Path Traced Mesh with Boundary Curves
 *
 * Combines OBJStructure mesh visualization with boundary loop extraction
 * and smooth tube rendering. Features:
 * - Full mesh structure (vertices, edges, faces)
 * - Boundary curves as smooth tubes
 * - Curve smoothing controls
 * - Three-point lighting with path tracing
 * - Gradient environment background
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

import { OBJStructure } from '@/math/mesh/OBJStructure';
import { parseGroupedOBJ, extractBoundary, smoothBoundary } from '@/math';

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
    color: 0x5ca3b5,
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
    keyDir: new THREE.Vector3(-10, 0, 0).normalize(),
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
// MESH & BOUNDARY STATE
// ===================================

let currentObjMesh: OBJStructure | null = null;
let boundaryGroup: THREE.Group = new THREE.Group();
boundaryGroup.name = 'boundaries';
app.scene.add(boundaryGroup);

let groupColorsFolder: Folder | null = null;
let rawBoundaries: THREE.Vector3[][] = [];

const meshSettings = {
    scale: 1.0,
    positionY: 1.2,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
};

const boundarySettings = {
    showBoundaries: true,
    tubeRadius: 0.03,
    tubeSegments: 1024,
    radialSegments: 8,
    boundaryColor: '#ff6644',
    // Smoothing
    smoothingEnabled: true,
    smoothingIterations: 5,
    smoothingFactor: 0.5,
    resampleCount: 0,
};

// ===================================
// BOUNDARY HELPERS
// ===================================

function generateBoundaryColors(count: number): THREE.Color[] {
    const colors: THREE.Color[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const hue = (i * 0.618033988749895) % 1;
        color.setHSL(hue, 0.85, 0.5);
        colors.push(color.clone());
    }
    return colors;
}

function getSmoothedBoundaries(): THREE.Vector3[][] {
    if (!boundarySettings.smoothingEnabled) {
        return rawBoundaries.map(loop => loop.map(p => p.clone()));
    }

    return rawBoundaries.map(loop => {
        const numSamples = boundarySettings.resampleCount > 0 ? boundarySettings.resampleCount : undefined;
        return smoothBoundary(
            loop,
            numSamples,
            boundarySettings.smoothingIterations,
            boundarySettings.smoothingFactor,
            true
        );
    });
}

function createBoundaryTubes(): void {
    // Clear existing
    while (boundaryGroup.children.length > 0) {
        const child = boundaryGroup.children[0];
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
                child.material.dispose();
            }
        }
        boundaryGroup.remove(child);
    }

    const boundaries = getSmoothedBoundaries();
    if (boundaries.length === 0) return;

    for (let i = 0; i < boundaries.length; i++) {
        const loop = boundaries[i];
        if (loop.length < 2) continue;

        const curve = new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.5);

        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            boundarySettings.tubeSegments,
            boundarySettings.tubeRadius,
            boundarySettings.radialSegments,
            true
        );

        const tubeMaterial = new THREE.MeshPhysicalMaterial({
            color: boundarySettings.boundaryColor,
            roughness: 0.3,
            metalness: 0.3,
            clearcoat: 0.8,
        });

        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tubeMesh.name = `boundary-${i}`;
        boundaryGroup.add(tubeMesh);
    }

    // Apply mesh transform to boundary group
    boundaryGroup.scale.setScalar(meshSettings.scale);
    boundaryGroup.position.set(0, meshSettings.positionY, 0);
    boundaryGroup.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);

    notifyPathTracerIfNeeded();
}

function rebuildBoundaries(): void {
    createBoundaryTubes();
}

// ===================================
// UI HELPERS
// ===================================

function rebuildGroupColorUI() {
    if (!groupColorsFolder || !currentObjMesh) return;

    groupColorsFolder.domElement.querySelectorAll('.cr-color-input').forEach(el => el.remove());

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
    // Remove existing mesh
    if (currentObjMesh) {
        app.scene.remove(currentObjMesh);
        currentObjMesh.dispose();
        currentObjMesh = null;
    }

    // Parse OBJ
    const parsed = parseGroupedOBJ(objString);

    // Create OBJStructure
    currentObjMesh = new OBJStructure(parsed);

    // Apply transform
    currentObjMesh.scale.setScalar(meshSettings.scale);
    currentObjMesh.position.set(0, meshSettings.positionY, 0);
    currentObjMesh.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);

    app.scene.add(currentObjMesh);

    // Extract boundaries
    const boundaries = extractBoundary(parsed);
    console.log(`Loaded: ${parsed.vertices.length} vertices, ${parsed.faces.length} faces, ${boundaries.length} boundary loops`);

    // Store raw boundaries (already in normalized coordinates from OBJStructure)
    // We need to compute the same transform OBJStructure uses
    rawBoundaries = scaleBoundariesToMatch(parsed.vertices, boundaries);

    // Create boundary tubes
    createBoundaryTubes();

    // Update spotlight targets
    const meshCenter = new THREE.Vector3(0, meshSettings.positionY, 0);
    keyLight.target.position.copy(meshCenter);
    fillLight.target.position.copy(meshCenter);
    rimLight.target.position.copy(meshCenter);

    // Update UI
    rebuildGroupColorUI();
    notifyPathTracerIfNeeded();
}

function scaleBoundariesToMatch(
    originalVertices: THREE.Vector3[],
    boundaries: THREE.Vector3[][]
): THREE.Vector3[][] {
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    for (const v of originalVertices) {
        min.min(v);
        max.max(v);
    }

    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const size = new THREE.Vector3().subVectors(max, min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2.0 / maxDim : 1.0;

    return boundaries.map(loop =>
        loop.map(v => new THREE.Vector3(
            (v.x - center.x) * scale,
            (v.y - center.y) * scale,
            (v.z - center.z) * scale
        ))
    );
}

function updateMeshTransform() {
    if (currentObjMesh) {
        currentObjMesh.scale.setScalar(meshSettings.scale);
        currentObjMesh.position.set(0, meshSettings.positionY, 0);
        currentObjMesh.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);
    }
    boundaryGroup.scale.setScalar(meshSettings.scale);
    boundaryGroup.position.set(0, meshSettings.positionY, 0);
    boundaryGroup.rotation.set(meshSettings.rotationX, meshSettings.rotationY, meshSettings.rotationZ);
    notifyPathTracerIfNeeded();
}

// ===================================
// SAMPLE DATA - Disk with hole (annulus)
// ===================================

function createAnnulus(innerRadius = 0.3, outerRadius = 1.0, segments = 32): string {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    // Inner ring vertices
    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push([
            innerRadius * Math.cos(theta),
            0,
            innerRadius * Math.sin(theta)
        ]);
    }

    // Outer ring vertices
    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push([
            outerRadius * Math.cos(theta),
            0,
            outerRadius * Math.sin(theta)
        ]);
    }

    // Faces connecting inner and outer rings
    for (let i = 0; i < segments; i++) {
        const inner0 = i;
        const inner1 = (i + 1) % segments;
        const outer0 = segments + i;
        const outer1 = segments + ((i + 1) % segments);
        faces.push([inner0, outer0, outer1, inner1]);
    }

    let obj = '# Annulus (disk with hole) - has 2 boundary loops\n';
    vertices.forEach(([x, y, z]) => obj += `v ${x} ${y} ${z}\n`);
    faces.forEach(f => obj += `f ${f.map(i => i + 1).join(' ')}\n`);
    return obj;
}

// Load default mesh
showObjMesh(createAnnulus());

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
// UI PANEL
// ===================================

const panel = new Panel('Boundary Studio');

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
    app.renderManager.renderer.domElement.toBlob(blob => blob && saveAs(blob, `boundary-studio-${ts}.png`));
}));

panel.add(actionsFolder);

// Mesh Transform
const transformFolder = new Folder('Mesh Transform');
transformFolder.add(new Slider(1.0, { label: 'Scale', min: 0.2, max: 3.0, step: 0.1, onChange: v => {
    meshSettings.scale = v;
    updateMeshTransform();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate X', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationX = v;
    updateMeshTransform();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationY = v;
    updateMeshTransform();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Z', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationZ = v;
    updateMeshTransform();
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

// Boundary Curves
const boundaryFolder = new Folder('Boundary Curves');
boundaryFolder.add(new Toggle(boundarySettings.showBoundaries, { label: 'Show Boundaries', onChange: v => {
    boundarySettings.showBoundaries = v;
    boundaryGroup.visible = v;
    notifyPathTracerIfNeeded();
}}));
boundaryFolder.add(new Slider(boundarySettings.tubeRadius, { label: 'Tube Radius', min: 0.01, max: 0.1, step: 0.005, onChange: v => {
    boundarySettings.tubeRadius = v;
    rebuildBoundaries();
}}));
boundaryFolder.add(new Slider(boundarySettings.tubeSegments, { label: 'Tube Segments', min: 128, max: 4096, step: 128, onChange: v => {
    boundarySettings.tubeSegments = v;
    rebuildBoundaries();
}}));
boundaryFolder.add(new Slider(boundarySettings.radialSegments, { label: 'Radial Segments', min: 4, max: 16, step: 1, onChange: v => {
    boundarySettings.radialSegments = v;
    rebuildBoundaries();
}}));
boundaryFolder.add(new ColorInput(boundarySettings.boundaryColor, { label: 'Boundary Color', onChange: c => {
    boundarySettings.boundaryColor = c;
    // Update all boundary tube materials
    boundaryGroup.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhysicalMaterial) {
            obj.material.color.set(c);
        }
    });
    notifyPathTracerIfNeeded();
}}));
panel.add(boundaryFolder);

// Smoothing
const smoothingFolder = new Folder('Smoothing');
smoothingFolder.add(new Toggle(boundarySettings.smoothingEnabled, { label: 'Enable Smoothing', onChange: v => {
    boundarySettings.smoothingEnabled = v;
    rebuildBoundaries();
}}));
smoothingFolder.add(new Slider(boundarySettings.smoothingIterations, { label: 'Iterations', min: 0, max: 20, step: 1, onChange: v => {
    boundarySettings.smoothingIterations = v;
    rebuildBoundaries();
}}));
smoothingFolder.add(new Slider(boundarySettings.smoothingFactor, { label: 'Smooth Factor', min: 0.1, max: 0.9, step: 0.05, onChange: v => {
    boundarySettings.smoothingFactor = v;
    rebuildBoundaries();
}}));
smoothingFolder.add(new Slider(boundarySettings.resampleCount, { label: 'Resample Count', min: 0, max: 2048, step: 32, onChange: v => {
    boundarySettings.resampleCount = v;
    rebuildBoundaries();
}}));
panel.add(smoothingFolder);

// Group Colors
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
lightingFolder.add(new Slider(10, { label: 'Intensity', min: 0, max: 30, step: 0.5, onChange: v => {
    lightRig.intensity = v;
    updateLightIntensities();
    notifyPathTracerIfNeeded();
}}));
lightingFolder.close();
panel.add(lightingFolder);

// Floor & Wall
const floorFolder = new Folder('Floor & Wall');
floorFolder.add(new Toggle(true, { label: 'Show Floor & Wall', onChange: v => {
    floor.visible = v;
    backWall.visible = v;
    notifyPathTracerIfNeeded();
}}));
floorFolder.add(new ColorInput('#5ca3b5', { label: 'Color', onChange: c => {
    floorMat.color.set(c);
    notifyPathTracerIfNeeded();
}}));
floorFolder.close();
panel.add(floorFolder);

// Path Tracer
const ptFolder = new Folder('Path Tracer');
ptFolder.add(new Slider(10, { label: 'Bounces', min: 1, max: 20, step: 1, onChange: v => app.renderManager.setBounces(v) }));
ptFolder.add(new Button('Reset Accumulation', () => app.renderManager.resetAccumulation()));
ptFolder.close();
panel.add(ptFolder);

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();
console.log('Boundary Studio - Mesh + Boundary Curves with Path Tracing');
