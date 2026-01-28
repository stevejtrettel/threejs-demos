/**
 * Boundary Visualizer Demo
 *
 * Load an OBJ file and visualize its boundary loops as colored tubes.
 * Uses extractBoundary to find boundary edges and connects them into
 * closed CatmullRomCurve3 curves rendered with TubeGeometry.
 */

import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import { Toggle } from '@/ui/inputs/Toggle';
import '@/ui/styles/index.css';
import * as THREE from 'three';

import { loadGroupedOBJFile, extractBoundary } from '@/math';
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
    tubeRadius: 0.02,
    tubeSegments: 64,
    radialSegments: 8,
    showSurface: true,
    showBoundaries: true,
    surfaceOpacity: 0.7,
};

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

    // Extract and visualize boundaries
    const boundaries = extractBoundary(result);
    console.log(`Found ${boundaries.length} boundary component(s)`);

    // Scale boundaries to match the surface (OBJSurface centers and scales to unit box)
    // We need to apply the same transformation
    const scaledBoundaries = scaleBoundariesToMatch(result.vertices, boundaries);

    createBoundaryTubes(scaledBoundaries);

    // Update info
    updateInfo(result.vertices.length, result.faces.length, boundaries.length);
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

// ===================================
// REBUILD TUBES (when settings change)
// ===================================

let lastBoundaries: THREE.Vector3[][] = [];

function rebuildTubes(): void {
    createBoundaryTubes(lastBoundaries);
}

// Modified load function to store boundaries
const originalLoadAndVisualize = loadAndVisualize;
async function loadAndVisualizeWithCache(): Promise<void> {
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

    currentSurface.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshPhysicalMaterial) {
            obj.material.transparent = true;
            obj.material.opacity = settings.surfaceOpacity;
        }
    });

    app.scene.add(currentSurface);

    // Extract and visualize boundaries
    const boundaries = extractBoundary(result);
    console.log(`Found ${boundaries.length} boundary component(s)`);

    lastBoundaries = scaleBoundariesToMatch(result.vertices, boundaries);
    createBoundaryTubes(lastBoundaries);

    updateInfo(result.vertices.length, result.faces.length, boundaries.length);
}

// ===================================
// UI
// ===================================

const panel = new Panel({ title: 'Boundary Visualizer', container: app.container });

// Info display
let infoElement: HTMLElement | null = null;

function updateInfo(vertices: number, faces: number, boundaries: number): void {
    if (infoElement) {
        infoElement.textContent = `Vertices: ${vertices} | Faces: ${faces} | Boundaries: ${boundaries}`;
    }
}

// Load folder
const loadFolder = new Folder({ title: 'Load', parent: panel, open: true });

new Button({
    title: 'Load OBJ',
    parent: loadFolder,
    onClick: loadAndVisualizeWithCache
});

// Create info display
const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'padding: 8px 12px; color: #aaa; font-size: 11px;';
infoDiv.textContent = 'No mesh loaded';
infoElement = infoDiv;
loadFolder.element.appendChild(infoDiv);

// Display folder
const displayFolder = new Folder({ title: 'Display', parent: panel, open: true });

new Toggle({
    title: 'Show Surface',
    parent: displayFolder,
    value: settings.showSurface,
    onChange: (v) => {
        settings.showSurface = v;
        if (currentSurface) currentSurface.visible = v;
    }
});

new Toggle({
    title: 'Show Boundaries',
    parent: displayFolder,
    value: settings.showBoundaries,
    onChange: (v) => {
        settings.showBoundaries = v;
        boundaryGroup.visible = v;
    }
});

new Slider({
    title: 'Surface Opacity',
    parent: displayFolder,
    value: settings.surfaceOpacity,
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
});

// Tube settings folder
const tubeFolder = new Folder({ title: 'Tube Settings', parent: panel, open: false });

new Slider({
    title: 'Tube Radius',
    parent: tubeFolder,
    value: settings.tubeRadius,
    min: 0.005,
    max: 0.1,
    step: 0.005,
    onChange: (v) => {
        settings.tubeRadius = v;
        rebuildTubes();
    }
});

new Slider({
    title: 'Tube Segments',
    parent: tubeFolder,
    value: settings.tubeSegments,
    min: 8,
    max: 128,
    step: 8,
    onChange: (v) => {
        settings.tubeSegments = v;
        rebuildTubes();
    }
});

new Slider({
    title: 'Radial Segments',
    parent: tubeFolder,
    value: settings.radialSegments,
    min: 4,
    max: 16,
    step: 1,
    onChange: (v) => {
        settings.radialSegments = v;
        rebuildTubes();
    }
});

// ===================================
// START
// ===================================

app.start();

console.log('Boundary Visualizer ready. Click "Load OBJ" to load a mesh.');
