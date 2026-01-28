/**
 * Interactive Multi-Mesh Surface Studio
 *
 * Load multiple OBJ files and manipulate them via UI.
 * Uses OBJSurfaceDoubleSide for independent front/back face colors.
 *
 * Features:
 * - Load multiple meshes via file picker
 * - Select meshes from the list with visual highlighting
 * - Per-mesh transform controls (position, rotation, scale)
 * - Per-group front/back face color controls
 * - Path tracing support
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

import { OBJSurfaceDoubleSide, type FaceColors } from '@/math/mesh/OBJSurfaceDoubleSide';

// ===================================
// TYPES
// ===================================

interface MeshInstance {
    id: string;
    name: string;
    mesh: OBJSurfaceDoubleSide;
    settings: {
        positionX: number;
        positionY: number;
        positionZ: number;
        rotationX: number;
        rotationY: number;
        rotationZ: number;
        scale: number;
        groupColors: Record<string, FaceColors>;
    };
}

// ===================================
// STATE
// ===================================

const meshInstances: Map<string, MeshInstance> = new Map();
let selectedMeshId: string | null = null;
let nextMeshId = 1;

// Selection highlight
let selectionBox: THREE.BoxHelper | null = null;

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
    distance: 6,
    height: 7,
    spread: Math.PI / 4,
    intensity: 10,
};

const keyLight = createSpotlight(0xffddaa, 12, new THREE.Vector3(-5, 8, 4));
app.scene.add(keyLight);
app.scene.add(keyLight.target);

const fillLight = createSpotlight(0xaaccff, 8, new THREE.Vector3(6, 5, 3));
app.scene.add(fillLight);
app.scene.add(fillLight.target);

const rimLight = createSpotlight(0xffaacc, 10, new THREE.Vector3(0, 6, -5));
app.scene.add(rimLight);
app.scene.add(rimLight.target);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
app.scene.add(ambientLight);

const previewLight = new THREE.DirectionalLight(0xffffff, 0.8);
previewLight.position.set(3, 6, 4);
app.scene.add(previewLight);

// ===================================
// HELPERS
// ===================================

function notifyPathTracerIfNeeded(): void {
    if (app.renderManager.isPathTracing()) {
        app.renderManager.notifyMaterialsChanged();
        app.renderManager.resetAccumulation();
    }
}

function generateMeshId(): string {
    return `mesh_${nextMeshId++}`;
}

// Calculate grid position for new meshes
function getNextPosition(): THREE.Vector3 {
    const count = meshInstances.size;
    const gridSize = 3;
    const cols = Math.ceil(Math.sqrt(count + 1));
    const row = Math.floor(count / cols);
    const col = count % cols;

    const offsetX = (cols - 1) * gridSize / 2;
    const offsetZ = (Math.ceil((count + 1) / cols) - 1) * gridSize / 2;

    return new THREE.Vector3(
        col * gridSize - offsetX,
        1.2,
        row * gridSize - offsetZ
    );
}

// ===================================
// MESH MANAGEMENT
// ===================================

function addMesh(objString: string, name: string): MeshInstance {
    const id = generateMeshId();
    const mesh = OBJSurfaceDoubleSide.fromOBJ(objString);
    const position = getNextPosition();

    // Initialize group colors from the mesh's defaults
    const groupColors: Record<string, FaceColors> = {};
    for (const group of mesh.groups) {
        groupColors[group] = {
            front: mesh.getGroupColor(group, 'front'),
            back: mesh.getGroupColor(group, 'back'),
        };
    }

    const instance: MeshInstance = {
        id,
        name,
        mesh,
        settings: {
            positionX: position.x,
            positionY: position.y,
            positionZ: position.z,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 1.0,
            groupColors,
        }
    };

    mesh.position.copy(position);
    mesh.scale.setScalar(1.0);

    meshInstances.set(id, instance);
    app.scene.add(mesh);

    console.log(`Added mesh: ${name} (${mesh.vertexCount} vertices, ${mesh.faceCount} faces)`);

    notifyPathTracerIfNeeded();
    rebuildMeshListUI();

    return instance;
}

function removeMesh(id: string): void {
    const instance = meshInstances.get(id);
    if (!instance) return;

    if (selectedMeshId === id) {
        selectMesh(null);
    }

    app.scene.remove(instance.mesh);
    instance.mesh.dispose();

    meshInstances.delete(id);

    notifyPathTracerIfNeeded();
    rebuildMeshListUI();
}

function removeAllMeshes(): void {
    const ids = Array.from(meshInstances.keys());
    for (const id of ids) {
        removeMesh(id);
    }
}

// ===================================
// SELECTION
// ===================================

function selectMesh(id: string | null): void {
    if (selectionBox) {
        app.scene.remove(selectionBox);
        selectionBox.dispose();
        selectionBox = null;
    }

    selectedMeshId = id;

    if (id) {
        const instance = meshInstances.get(id);
        if (instance) {
            selectionBox = new THREE.BoxHelper(instance.mesh, 0xffff00);
            app.scene.add(selectionBox);
        }
    }

    rebuildSelectedMeshUI();
}

app.addAnimateCallback(() => {
    if (selectionBox && selectedMeshId) {
        const instance = meshInstances.get(selectedMeshId);
        if (instance) {
            selectionBox.update();
        }
    }
});

// ===================================
// FILE LOADING
// ===================================

function openFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.multiple = true;
    input.onchange = async () => {
        const files = input.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const text = await file.text();
            const name = file.name.replace('.obj', '');
            addMesh(text, name);
        }
    };
    input.click();
}

// ===================================
// PHYSICAL CAMERA
// ===================================

const physicalCamera = new PhysicalCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
physicalCamera.position.set(0, 4, 8);
physicalCamera.lookAt(0, 1.2, 0);

(app.cameraManager as any).camera = physicalCamera;
(app.controls.controls as any).object = physicalCamera;
(app.layout as any).camera = physicalCamera;

// ===================================
// UI PANEL
// ===================================

const panel = new Panel('Surface Studio');

// Actions
const actionsFolder = new Folder('Actions');

actionsFolder.add(new Button('Add Meshes...', openFilePicker));

actionsFolder.add(new Button('Clear All', () => {
    if (meshInstances.size === 0) return;
    if (confirm(`Remove all ${meshInstances.size} meshes?`)) {
        removeAllMeshes();
    }
}));

let isPathTracing = false;
const pathTraceButton = new Button('Start Path Trace', () => {
    isPathTracing = !isPathTracing;
    if (isPathTracing) {
        previewLight.intensity = 0;
        ambientLight.intensity = 0;
        app.enablePathTracing();
        pathTraceButton.setLabel('Stop Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#c94444';
    } else {
        app.disablePathTracing();
        previewLight.intensity = 0.8;
        ambientLight.intensity = 0.15;
        pathTraceButton.setLabel('Start Path Trace');
        pathTraceButton.domElement.style.backgroundColor = '#44aa44';
    }
});
pathTraceButton.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold;padding:8px 12px';
actionsFolder.add(pathTraceButton);

actionsFolder.add(new Button('Download Image', () => {
    app.renderManager.render(app.scene, app.camera);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    app.renderManager.renderer.domElement.toBlob(blob => blob && saveAs(blob, `surface-studio-${ts}.png`));
}));

panel.add(actionsFolder);

// Mesh List
const meshListFolder = new Folder('Loaded Meshes');
panel.add(meshListFolder);

function rebuildMeshListUI(): void {
    const content = meshListFolder.domElement.querySelector('.cr-folder-content');
    if (!content) return;

    content.querySelectorAll('[data-mesh-item]').forEach(el => el.remove());

    if (meshInstances.size === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.setAttribute('data-mesh-item', 'empty');
        emptyMsg.style.cssText = 'padding:8px;color:#888;font-style:italic;';
        emptyMsg.textContent = 'No meshes loaded';
        content.appendChild(emptyMsg);
        return;
    }

    for (const [id, instance] of meshInstances) {
        const item = document.createElement('div');
        item.setAttribute('data-mesh-item', id);
        item.style.cssText = `
            display:flex;
            align-items:center;
            gap:8px;
            padding:6px 8px;
            border-bottom:1px solid #333;
            background:${selectedMeshId === id ? '#3a5a8a' : 'transparent'};
            cursor:pointer;
        `;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = instance.name;
        nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nameSpan.onclick = () => selectMesh(id);
        item.appendChild(nameSpan);

        const visBtn = document.createElement('button');
        visBtn.textContent = instance.mesh.visible ? 'V' : '-';
        visBtn.style.cssText = 'background:#555;color:#fff;border:none;cursor:pointer;font-size:12px;padding:2px 6px;border-radius:3px;';
        visBtn.title = 'Toggle visibility';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            instance.mesh.visible = !instance.mesh.visible;
            visBtn.textContent = instance.mesh.visible ? 'V' : '-';
            notifyPathTracerIfNeeded();
        };
        item.appendChild(visBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'X';
        delBtn.style.cssText = 'background:#c44;color:#fff;border:none;cursor:pointer;padding:2px 6px;border-radius:3px;font-size:12px;';
        delBtn.title = 'Remove mesh';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeMesh(id);
        };
        item.appendChild(delBtn);

        content.appendChild(item);
    }
}

// Selected Mesh Controls
const selectedMeshFolder = new Folder('Selected Mesh');
panel.add(selectedMeshFolder);

let transformFolder: Folder | null = null;
let colorsFolder: Folder | null = null;

function rebuildSelectedMeshUI(): void {
    const content = selectedMeshFolder.domElement.querySelector('.cr-folder-content');
    if (!content) return;

    content.innerHTML = '';
    transformFolder = null;
    colorsFolder = null;

    rebuildMeshListUI();

    if (!selectedMeshId) {
        const msg = document.createElement('div');
        msg.style.cssText = 'padding:8px;color:#888;font-style:italic;';
        msg.textContent = 'Click a mesh to select it';
        content.appendChild(msg);
        return;
    }

    const instance = meshInstances.get(selectedMeshId);
    if (!instance) return;

    const settings = instance.settings;
    const mesh = instance.mesh;

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'padding:8px;font-weight:bold;border-bottom:1px solid #444;';
    title.textContent = instance.name;
    content.appendChild(title);

    // Transform folder
    transformFolder = new Folder('Transform');

    transformFolder.add(new Slider(settings.positionX, {
        label: 'Position X', min: -10, max: 10, step: 0.1,
        onChange: v => { settings.positionX = v; mesh.position.x = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.positionY, {
        label: 'Position Y', min: 0, max: 5, step: 0.1,
        onChange: v => { settings.positionY = v; mesh.position.y = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.positionZ, {
        label: 'Position Z', min: -10, max: 10, step: 0.1,
        onChange: v => { settings.positionZ = v; mesh.position.z = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.rotationX, {
        label: 'Rotate X', min: -Math.PI, max: Math.PI, step: 0.05,
        onChange: v => { settings.rotationX = v; mesh.rotation.x = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.rotationY, {
        label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.05,
        onChange: v => { settings.rotationY = v; mesh.rotation.y = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.rotationZ, {
        label: 'Rotate Z', min: -Math.PI, max: Math.PI, step: 0.05,
        onChange: v => { settings.rotationZ = v; mesh.rotation.z = v; notifyPathTracerIfNeeded(); }
    }));
    transformFolder.add(new Slider(settings.scale, {
        label: 'Scale', min: 0.1, max: 3, step: 0.1,
        onChange: v => { settings.scale = v; mesh.scale.setScalar(v); notifyPathTracerIfNeeded(); }
    }));

    content.appendChild(transformFolder.domElement);

    // Colors folder (per-group, front/back)
    colorsFolder = new Folder('Face Colors');

    for (const groupName of mesh.groups) {
        const displayName = groupName === 'default' ? 'Default' : `Group ${groupName}`;
        const colors = settings.groupColors[groupName] ?? {
            front: mesh.getGroupColor(groupName, 'front'),
            back: mesh.getGroupColor(groupName, 'back'),
        };

        colorsFolder.add(new ColorInput(colors.front, {
            label: `${displayName} Front`,
            onChange: c => {
                settings.groupColors[groupName].front = c;
                mesh.setGroupColor(groupName, 'front', c);
                notifyPathTracerIfNeeded();
            }
        }));

        colorsFolder.add(new ColorInput(colors.back, {
            label: `${displayName} Back`,
            onChange: c => {
                settings.groupColors[groupName].back = c;
                mesh.setGroupColor(groupName, 'back', c);
                notifyPathTracerIfNeeded();
            }
        }));
    }

    content.appendChild(colorsFolder.domElement);
}

// Initial UI state
rebuildMeshListUI();
rebuildSelectedMeshUI();

// Lighting folder
const lightingFolder = new Folder('Lighting');
lightingFolder.add(new Slider(lightRig.intensity, {
    label: 'Intensity', min: 0, max: 30, step: 0.5,
    onChange: v => {
        lightRig.intensity = v;
        keyLight.intensity = v * 1.2;
        fillLight.intensity = v * 0.8;
        rimLight.intensity = v;
        notifyPathTracerIfNeeded();
    }
}));
lightingFolder.add(new ColorInput('#ffddaa', {
    label: 'Key (Warm)',
    onChange: c => { keyLight.color.set(c); notifyPathTracerIfNeeded(); }
}));
lightingFolder.add(new ColorInput('#aaccff', {
    label: 'Fill (Cool)',
    onChange: c => { fillLight.color.set(c); notifyPathTracerIfNeeded(); }
}));
lightingFolder.add(new ColorInput('#ffaacc', {
    label: 'Rim (Accent)',
    onChange: c => { rimLight.color.set(c); notifyPathTracerIfNeeded(); }
}));
panel.add(lightingFolder);
lightingFolder.close();

// Floor & Wall
const floorFolder = new Folder('Floor & Wall');
floorFolder.add(new Toggle(true, {
    label: 'Show Floor & Wall',
    onChange: v => { floor.visible = v; backWall.visible = v; notifyPathTracerIfNeeded(); }
}));
floorFolder.add(new ColorInput('#5ca3b5', {
    label: 'Color',
    onChange: c => { floorMat.color.set(c); notifyPathTracerIfNeeded(); }
}));
floorFolder.add(new Slider(0.4, {
    label: 'Roughness', min: 0, max: 1, step: 0.05,
    onChange: v => { floorMat.roughness = v; notifyPathTracerIfNeeded(); }
}));
panel.add(floorFolder);
floorFolder.close();

// Environment
const envFolder = new Folder('Environment');
envFolder.add(new ColorInput('#555566', {
    label: 'Sky Color',
    onChange: c => { envTexture.topColor.set(c); envTexture.update(); notifyPathTracerIfNeeded(); }
}));
envFolder.add(new ColorInput('#888888', {
    label: 'Horizon Color',
    onChange: c => { envTexture.bottomColor.set(c); envTexture.update(); notifyPathTracerIfNeeded(); }
}));
panel.add(envFolder);
envFolder.close();

// Path Tracer settings
const ptFolder = new Folder('Path Tracer');
ptFolder.add(new Slider(10, {
    label: 'Bounces', min: 1, max: 20, step: 1,
    onChange: v => app.renderManager.setBounces(v)
}));
ptFolder.add(new Button('Reset Accumulation', () => app.renderManager.resetAccumulation()));
panel.add(ptFolder);
ptFolder.close();

// Camera
app.renderManager.setDOFEnabled(true);
app.renderManager.setFStop(16);

const cameraFolder = new Folder('Camera');
cameraFolder.add(new Slider(50, {
    label: 'FOV', min: 20, max: 90, step: 1,
    onChange: v => {
        app.camera.fov = v;
        (app.camera as any).updateProjectionMatrix();
        if (app.renderManager.isPathTracing()) app.renderManager.resetAccumulation();
    }
}));
cameraFolder.add(new Slider(8, {
    label: 'Focus Distance', min: 0.5, max: 20, step: 0.1,
    onChange: v => app.renderManager.setFocusDistance(v)
}));
cameraFolder.add(new Slider(16, {
    label: 'f-Stop', min: 0.5, max: 16, step: 0.1,
    onChange: v => app.renderManager.setFStop(v)
}));
panel.add(cameraFolder);
cameraFolder.close();

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();
console.log('Surface Studio - Load OBJ files and click to select');