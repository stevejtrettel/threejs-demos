/**
 * Selection System Demo
 *
 * Demonstrates the SelectionManager for picking and selecting 3D objects.
 *
 * Features:
 * - Click to select objects
 * - Yellow wireframe highlight on selected object
 * - Hover detection with cursor change
 * - Console logging of selection events
 * - Object properties displayed in console
 */

import { App } from '@/app/App';
import * as THREE from 'three';

console.log('=== Selection System Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Setup camera
app.camera.position.set(0, 3, 10);
app.controls.target.set(0, 1.5, 0);

// Setup environment
app.backgrounds.setColor(0x1a1a1a);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
app.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 5);
app.scene.add(directionalLight);

console.log('=== Creating Selectable Objects ===\n');

// === Create a variety of objects to select ===

// Sphere
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xff6b6b,
  roughness: 0.3,
  metalness: 0.7
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(-3, 1, 0);
sphere.name = 'Red Sphere';
(sphere as any).description = 'A shiny red metallic sphere';
(sphere as any).onClick = (result: any) => {
  console.log(`🎯 ${sphere.name} was clicked!`);
  console.log(`   Clicked at local point: (${result.point.x.toFixed(2)}, ${result.point.y.toFixed(2)}, ${result.point.z.toFixed(2)})`);
};
app.scene.add(sphere);

// Cube
const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const cubeMat = new THREE.MeshStandardMaterial({
  color: 0x4ecdc4,
  roughness: 0.5,
  metalness: 0.5
});
const cube = new THREE.Mesh(cubeGeo, cubeMat);
cube.position.set(0, 1.5, 0);
cube.name = 'Cyan Cube';
(cube as any).description = 'A semi-metallic cyan cube';
(cube as any).onHover = (result: any) => {
  console.log(`👆 Hovering over ${cube.name}`);
};
(cube as any).onClick = (result: any) => {
  console.log(`🎯 ${cube.name} clicked! Starting rotation animation...`);
  // Example: Could trigger an animation here
};
app.scene.add(cube);

// Torus
const torusGeo = new THREE.TorusGeometry(1, 0.4, 16, 100);
const torusMat = new THREE.MeshStandardMaterial({
  color: 0xffe66d,
  roughness: 0.2,
  metalness: 0.8
});
const torus = new THREE.Mesh(torusGeo, torusMat);
torus.position.set(3, 1, 0);
torus.name = 'Yellow Torus';
(torus as any).description = 'A golden metallic torus';
app.scene.add(torus);

// Cone
const coneGeo = new THREE.ConeGeometry(0.8, 2, 32);
const coneMat = new THREE.MeshStandardMaterial({
  color: 0xa8e6cf,
  roughness: 0.4,
  metalness: 0.3
});
const cone = new THREE.Mesh(coneGeo, coneMat);
cone.position.set(-1.5, 1, -2);
cone.name = 'Green Cone';
(cone as any).description = 'A pale green cone';
app.scene.add(cone);

// Octahedron
const octaGeo = new THREE.OctahedronGeometry(1);
const octaMat = new THREE.MeshStandardMaterial({
  color: 0xff6fb5,
  roughness: 0.3,
  metalness: 0.6
});
const octa = new THREE.Mesh(octaGeo, octaMat);
octa.position.set(1.5, 1, -2);
octa.name = 'Pink Octahedron';
(octa as any).description = 'A vibrant pink octahedron';
app.scene.add(octa);

// Ground plane (not selectable - we'll ignore it)
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  roughness: 0.9,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.name = 'Ground';
app.scene.add(ground);

console.log('✓ Created 5 selectable objects');
console.log('  - Red Sphere');
console.log('  - Cyan Cube');
console.log('  - Yellow Torus');
console.log('  - Green Cone');
console.log('  - Pink Octahedron\n');

// === Setup Selection System ===

console.log('=== Enabling Selection System ===\n');

// Ignore the ground plane (don't want to select it)
app.selection.addIgnored(ground);

// Enable selection
app.selection.enable();

console.log('✓ Selection enabled');
console.log('  - Click objects to select them');
console.log('  - Selected objects get yellow wireframe highlight');
console.log('  - Hover over objects to see cursor change\n');

// === Selection Event Handlers ===

// Handle selection changes
app.selection.onSelectionChange((object) => {
  if (object) {
    console.log('=== Object Selected ===');
    console.log(`Name: ${object.name || 'Unnamed'}`);
    console.log(`Type: ${object.type}`);
    console.log(`Position: (${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})`);

    // Show custom properties if they exist
    if ((object as any).description) {
      console.log(`Description: ${(object as any).description}`);
    }

    // Show material info for meshes
    if (object instanceof THREE.Mesh) {
      const mat = object.material as THREE.MeshStandardMaterial;
      if (mat.color) {
        console.log(`Color: #${mat.color.getHexString()}`);
      }
      if (mat.roughness !== undefined) {
        console.log(`Roughness: ${mat.roughness}`);
      }
      if (mat.metalness !== undefined) {
        console.log(`Metalness: ${mat.metalness}`);
      }
    }
    console.log('');
  } else {
    console.log('=== Selection Cleared ===\n');
  }
});

// Handle clicks
app.selection.onObjectClick((result) => {
  if (result) {
    console.log(`✓ Clicked at world position: (${result.point.x.toFixed(2)}, ${result.point.y.toFixed(2)}, ${result.point.z.toFixed(2)})`);
  } else {
    console.log('✓ Clicked on empty space');
  }
});

// Handle hover (only log when hovering starts)
let lastHovered: THREE.Object3D | null = null;
app.selection.onObjectHover((result) => {
  const currentHovered = result ? result.object : null;

  if (currentHovered !== lastHovered) {
    if (currentHovered) {
      console.log(`~ Hovering: ${currentHovered.name || 'Unnamed object'}`);
    }
    lastHovered = currentHovered;
  }
});

// === Animation ===

app.addAnimateCallback((time) => {
  const t = time * 0.001;

  // Rotate objects slowly
  sphere.rotation.y = t * 0.5;
  cube.rotation.x = t * 0.3;
  cube.rotation.y = t * 0.5;
  torus.rotation.x = t * 0.4;
  torus.rotation.y = t * 0.3;
  cone.rotation.y = t * 0.5;
  octa.rotation.x = t * 0.4;
  octa.rotation.y = t * 0.6;

  // Update highlight position if object is selected and rotating
  app.selection.updateHighlight();
});

// Start rendering
app.start();

console.log('=== Demo Running ===');
console.log('✓ Click on any colored shape to select it');
console.log('✓ Selected object will be highlighted with yellow wireframe');
console.log('✓ Click empty space to deselect');
console.log('✓ Hover over objects to see them detected');
console.log('✓ Press D for debug stats\n');

console.log('=== Per-Object Callbacks ===');
console.log('✓ Red Sphere has custom onClick handler');
console.log('✓ Cyan Cube has both onClick and onHover handlers');
console.log('  - Click sphere/cube to see their custom messages!');
console.log('  - Hover cube to see hover detection\n');
