/**
 * Boundary Visualizer Demo
 *
 * Load an OBJ file and visualize its boundary loops as colored tubes.
 * Uses extractBoundary to find boundary edges and connects them into
 * closed CatmullRomCurve3 curves rendered with TubeGeometry.
 *
 * Includes curve smoothing options to reduce noise in extracted boundaries.
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import { Toggle } from '@/ui/inputs/Toggle';
import '@/ui/styles/index.css';
import * as THREE from 'three';

import { loadGroupedOBJFile, extractBoundary, smoothBoundary } from '@/math';
import { OBJSurface } from '@/math/mesh/OBJSurface';

// ===================================
// APP SETUP
// ===================================

const app = new App({
    debug: true,
    antialias: true,
});

app.scene.background = new THREE.Color(0x1a1a2e);

// ===================================
// LIGHTING
// ===================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
app.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
app.scene.add(directionalLight);

const backLight = new THREE.DirectionalLight(0x6688ff, 0.3);
backLight.position.set(-5, 5, -5);
app.scene.add(backLight);

// ===================================
// STATE
// ===================================

let currentSurface: OBJSurface | null = null;
let boundaryGroup: THREE.Group = new THREE.Group();
boundaryGroup.name = 'boundaries';
app.scene.add(boundaryGroup);

// Settings
const settings = {
    // Tube settings
    tubeRadius: 0.02,
    tubeSegments: 64,
    radialSegments: 8,
    // Display settings
    showSurface: true,
    showBoundaries: true,
    surfaceOpacity: 0.7,
    // Smoothing settings
    smoothingEnabled: true,
    smoothingIterations: 3,
    smoothingFactor: 0.5,
    resampleCount: 0, // 0 = use original count
};

// Raw boundaries (before smoothing)
let rawBoundaries: THREE.Vector3[][] = [];

// Color palette for boundary loops (golden ratio distribution)
function generateBoundaryColors(count: number): THREE.Color[] {
    const colors: THREE.Color[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const hue = (i * 0.618033988749895) % 1;
        color.setHSL(hue, 0.8, 0.55);
        colors.push(color.clone());
    }
    return colors;
}

// ===================================
// SMOOTHING
// ===================================

function getSmoothedBoundaries(): THREE.Vector3[][] {
    if (!settings.smoothingEnabled) {
        return rawBoundaries.map(loop => loop.map(p => p.clone()));
    }

    return rawBoundaries.map(loop => {
        const numSamples = settings.resampleCount > 0 ? settings.resampleCount : undefined;
        return smoothBoundary(
            loop,
            numSamples,
            settings.smoothingIterations,
            settings.smoothingFactor,
            true // closed
        );
    });
}

// ===================================
// BOUNDARY TUBE CREATION
// ===================================

function createBoundaryTubes(boundaries: THREE.Vector3[][]): void {
    // Clear existing boundary tubes
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

    if (boundaries.length === 0) {
        console.log('No boundaries found (mesh is closed)');
        return;
    }

    const colors = generateBoundaryColors(boundaries.length);

    for (let i = 0; i < boundaries.length; i++) {
        const loop = boundaries[i];

        if (loop.length < 2) continue;

        // Create a closed CatmullRomCurve3 from the boundary points
        const curve = new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.5);

        // Create tube geometry
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            settings.tubeSegments,
            settings.tubeRadius,
            settings.radialSegments,
            true // closed
        );

        const tubeMaterial = new THREE.MeshPhysicalMaterial({
            color: colors[i],
            roughness: 0.3,
            metalness: 0.2,
            clearcoat: 0.5,
        });

        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tubeMesh.name = `boundary-${i}`;
        boundaryGroup.add(tubeMesh);
    }

    console.log(`Created ${boundaries.length} boundary tube(s)`);
}

// Scale boundary points to match OBJSurface's centering and scaling
function scaleBoundariesToMatch(
    originalVertices: THREE.Vector3[],
    boundaries: THREE.Vector3[][]
): THREE.Vector3[][] {
    // Compute the same transform that OBJSurface applies
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

    // Apply transform to boundary points
    return boundaries.map(loop =>
        loop.map(v => new THREE.Vector3(
            (v.x - center.x) * scale,
            (v.y - center.y) * scale,
            (v.z - center.z) * scale
        ))
    );
}

function rebuildTubes(): void {
    const smoothed = getSmoothedBoundaries();
    createBoundaryTubes(smoothed);
}

// ===================================
// OBJ LOADING
// ===================================

async function loadAndVisualize(): Promise<void> {
    const result = await loadGroupedOBJFile();
    if (!result) return;

    // Remove old surface
    if (currentSurface) {
        app.scene.remove(currentSurface);
        currentSurface.dispose();
        currentSurface = null;
    }

    // Create new surface
    currentSurface = new OBJSurface(result, {
        defaultColor: '#888899',
        roughness: 0.5,
        metalness: 0.0,
        clearcoat: 0.1,
        side: THREE.DoubleSide,
    });
    currentSurface.visible = settings.showSurface;

    // Make surface semi-transparent so boundaries are visible
    currentSurface.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhysicalMaterial) {
            obj.material.transparent = true;
            obj.material.opacity = settings.surfaceOpacity;
        }
    });

    app.scene.add(currentSurface);

    // Extract boundaries
    const boundaries = extractBoundary(result);
    console.log(`Found ${boundaries.length} boundary component(s)`);

    // Scale and store raw boundaries
    rawBoundaries = scaleBoundariesToMatch(result.vertices, boundaries);

    // Log boundary point counts
    for (let i = 0; i < rawBoundaries.length; i++) {
        console.log(`  Boundary ${i}: ${rawBoundaries[i].length} points`);
    }

    // Create tubes with smoothing applied
    rebuildTubes();

    // Update info display
    updateInfo(result.vertices.length, result.faces.length, boundaries.length);
}

// ===================================
// UI
// ===================================

const panel = new Panel('Boundary Visualizer');

// Info display element
let infoElement: HTMLElement | null = null;

function updateInfo(vertices: number, faces: number, boundaries: number): void {
    if (infoElement) {
        infoElement.textContent = `Vertices: ${vertices} | Faces: ${faces} | Boundaries: ${boundaries}`;
    }
}

// Load folder
const loadFolder = new Folder('Load');

loadFolder.add(new Button('Load OBJ File', loadAndVisualize));

// Create info display and add to folder's content
const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'padding: 8px 12px; color: #aaa; font-size: 11px;';
infoDiv.textContent = 'No mesh loaded';
infoElement = infoDiv;

panel.add(loadFolder);

// Display folder
const displayFolder = new Folder('Display');

displayFolder.add(new Toggle(settings.showSurface, {
    label: 'Show Surface',
    onChange: (v) => {
        settings.showSurface = v;
        if (currentSurface) currentSurface.visible = v;
    }
}));

displayFolder.add(new Toggle(settings.showBoundaries, {
    label: 'Show Boundaries',
    onChange: (v) => {
        settings.showBoundaries = v;
        boundaryGroup.visible = v;
    }
}));

displayFolder.add(new Slider(settings.surfaceOpacity, {
    label: 'Surface Opacity',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    onChange: (v) => {
        settings.surfaceOpacity = v;
        if (currentSurface) {
            currentSurface.traverse((obj) => {
                if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhysicalMaterial) {
                    obj.material.opacity = v;
                }
            });
        }
    }
}));

panel.add(displayFolder);

// Smoothing folder
const smoothingFolder = new Folder('Smoothing');

smoothingFolder.add(new Toggle(settings.smoothingEnabled, {
    label: 'Enable Smoothing',
    onChange: (v) => {
        settings.smoothingEnabled = v;
        rebuildTubes();
    }
}));

smoothingFolder.add(new Slider(settings.smoothingIterations, {
    label: 'Iterations',
    min: 0,
    max: 20,
    step: 1,
    onChange: (v) => {
        settings.smoothingIterations = v;
        rebuildTubes();
    }
}));

smoothingFolder.add(new Slider(settings.smoothingFactor, {
    label: 'Smooth Factor',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    onChange: (v) => {
        settings.smoothingFactor = v;
        rebuildTubes();
    }
}));

smoothingFolder.add(new Slider(settings.resampleCount, {
    label: 'Resample Count',
    min: 0,
    max: 500,
    step: 10,
    onChange: (v) => {
        settings.resampleCount = v;
        rebuildTubes();
    }
}));

panel.add(smoothingFolder);

// Tube settings folder
const tubeFolder = new Folder('Tube Settings');

tubeFolder.add(new Slider(settings.tubeRadius, {
    label: 'Tube Radius',
    min: 0.005,
    max: 0.1,
    step: 0.005,
    onChange: (v) => {
        settings.tubeRadius = v;
        rebuildTubes();
    }
}));

tubeFolder.add(new Slider(settings.tubeSegments, {
    label: 'Tube Segments',
    min: 8,
    max: 128,
    step: 8,
    onChange: (v) => {
        settings.tubeSegments = v;
        rebuildTubes();
    }
}));

tubeFolder.add(new Slider(settings.radialSegments, {
    label: 'Radial Segments',
    min: 4,
    max: 16,
    step: 1,
    onChange: (v) => {
        settings.radialSegments = v;
        rebuildTubes();
    }
}));

tubeFolder.close();
panel.add(tubeFolder);

panel.mount(document.body);

// ===================================
// START
// ===================================

app.start();

console.log('Boundary Visualizer ready. Click "Load OBJ File" to load a mesh.');
