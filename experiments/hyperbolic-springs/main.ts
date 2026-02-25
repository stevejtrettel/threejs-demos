import * as THREE from 'three';
import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import { ColorInput } from '@/ui/inputs/ColorInput';
import '@/ui/styles/index.css';
import { PhysicalCamera, PhysicalSpotLight, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { saveAs } from 'file-saver';

// ===================================
// TYPES
// ===================================

interface SpringData {
    i: number;
    j: number;
    rest: number;
    length: number;
}

interface MeshData {
    vertices: [number, number, number][];
    springs: SpringData[];
    sigma: number;
}

// ===================================
// STRAIN COLOR
// ===================================

function strainColor(x: number, sigma: number): THREE.Color {
    const a = Math.abs(x) / Math.max(1e-12, sigma);
    let t = 1 - Math.exp(-Math.pow(a, 1.3));
    t = Math.min(1, Math.max(0, t));
    const hue = (1 / 3) * (1 - t);
    const color = new THREE.Color();
    color.setHSL(hue, 0.95, 0.5);
    return color;
}

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
// NETWORK STATE
// ===================================

const networkGroup = new THREE.Group();
networkGroup.position.set(0, 1.2, 0);
app.scene.add(networkGroup);

const meshSettings = {
    scale: 1.0,
    positionY: 1.2,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    vertexRadius: 0.05,
    springRadius: 0.03,
    vertexColor: '#333333',
    showVertices: true,
    showSprings: true,
};

let currentData: MeshData | null = null;
let vertexMeshes: THREE.Mesh[] = [];
let springMeshes: THREE.Mesh[] = [];

// ===================================
// HELPERS
// ===================================

function notifyPathTracerIfNeeded() {
    if (app.renderManager.isPathTracing()) {
        app.renderManager.notifyMaterialsChanged();
        app.renderManager.resetAccumulation();
    }
}

function rebuildNetwork() {
    if (!currentData) return;

    // Clear
    networkGroup.clear();
    vertexMeshes = [];
    springMeshes = [];

    const { vertices, springs, sigma } = currentData;

    // Vertex spheres
    const sphereGeo = new THREE.SphereGeometry(meshSettings.vertexRadius, 12, 8);
    const sphereMat = new THREE.MeshPhysicalMaterial({
        color: meshSettings.vertexColor,
        roughness: 0.6,
        metalness: 0.1,
    });

    if (meshSettings.showVertices) {
        for (const [x, y, z] of vertices) {
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.set(x, y, z);
            networkGroup.add(sphere);
            vertexMeshes.push(sphere);
        }
    }

    // Spring cylinders
    if (meshSettings.showSprings) {
        const cylGeo = new THREE.CylinderGeometry(meshSettings.springRadius, meshSettings.springRadius, 1, 8, 1);
        cylGeo.rotateX(Math.PI / 2);

        const zAxis = new THREE.Vector3(0, 0, 1);
        const tmpA = new THREE.Vector3();
        const tmpB = new THREE.Vector3();
        const dir = new THREE.Vector3();
        const mid = new THREE.Vector3();
        const quat = new THREE.Quaternion();

        for (const spring of springs) {
            const [ax, ay, az] = vertices[spring.i];
            const [bx, by, bz] = vertices[spring.j];
            tmpA.set(ax, ay, az);
            tmpB.set(bx, by, bz);

            dir.subVectors(tmpB, tmpA);
            const len = dir.length();
            dir.normalize();

            mid.addVectors(tmpA, tmpB).multiplyScalar(0.5);
            quat.setFromUnitVectors(zAxis, dir);

            const strain = spring.length - spring.rest;
            const color = strainColor(strain, sigma);
            const mat = new THREE.MeshPhysicalMaterial({
                color,
                roughness: 0.4,
                metalness: 0.05,
            });

            const cyl = new THREE.Mesh(cylGeo, mat);
            cyl.position.copy(mid);
            cyl.quaternion.copy(quat);
            cyl.scale.set(1, 1, len);
            networkGroup.add(cyl);
            springMeshes.push(cyl);
        }
    }

    notifyPathTracerIfNeeded();
}

function showSpringNetwork(data: MeshData) {
    currentData = data;
    rebuildNetwork();

    // Update spotlight targets
    const meshCenter = new THREE.Vector3(0, meshSettings.positionY, 0);
    keyLight.target.position.copy(meshCenter);
    fillLight.target.position.copy(meshCenter);
    rimLight.target.position.copy(meshCenter);

    console.log(`Loaded: ${data.vertices.length} vertices, ${data.springs.length} springs`);
}

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

const panel = new Panel('Hyperbolic Springs');

// Actions
const actionsFolder = new Folder('Actions');

actionsFolder.add(new Button('Load JSON File', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
            const text = await file.text();
            const data: MeshData = JSON.parse(text);
            showSpringNetwork(data);
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
    app.renderManager.renderer.domElement.toBlob(blob => blob && saveAs(blob, `hyperbolic-springs-${ts}.png`));
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

// Network Transform
const transformFolder = new Folder('Transform');
transformFolder.add(new Slider(1.0, { label: 'Scale', min: 0.1, max: 5.0, step: 0.1, onChange: v => {
    meshSettings.scale = v;
    networkGroup.scale.setScalar(v);
    notifyPathTracerIfNeeded();
}}));
transformFolder.add(new Slider(1.2, { label: 'Height', min: -3, max: 5, step: 0.1, onChange: v => {
    meshSettings.positionY = v;
    networkGroup.position.y = v;
    notifyPathTracerIfNeeded();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate X', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationX = v;
    networkGroup.rotation.x = v;
    notifyPathTracerIfNeeded();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationY = v;
    networkGroup.rotation.y = v;
    notifyPathTracerIfNeeded();
}}));
transformFolder.add(new Slider(0, { label: 'Rotate Z', min: -Math.PI, max: Math.PI, step: 0.05, onChange: v => {
    meshSettings.rotationZ = v;
    networkGroup.rotation.z = v;
    notifyPathTracerIfNeeded();
}}));
panel.add(transformFolder);
transformFolder.close();

// Appearance
const appearanceFolder = new Folder('Appearance');
appearanceFolder.add(new Toggle(true, { label: 'Show Vertices', onChange: v => {
    meshSettings.showVertices = v;
    rebuildNetwork();
}}));
appearanceFolder.add(new Toggle(true, { label: 'Show Springs', onChange: v => {
    meshSettings.showSprings = v;
    rebuildNetwork();
}}));
appearanceFolder.add(new Slider(0.05, { label: 'Vertex Radius', min: 0.01, max: 0.15, step: 0.005, onChange: v => {
    meshSettings.vertexRadius = v;
    rebuildNetwork();
}}));
appearanceFolder.add(new Slider(0.03, { label: 'Spring Radius', min: 0.005, max: 0.08, step: 0.002, onChange: v => {
    meshSettings.springRadius = v;
    rebuildNetwork();
}}));
appearanceFolder.add(new ColorInput('#333333', { label: 'Vertex Color', onChange: c => {
    meshSettings.vertexColor = c;
    rebuildNetwork();
}}));
panel.add(appearanceFolder);

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
