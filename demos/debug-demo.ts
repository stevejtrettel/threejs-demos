/**
 * Debug System Demo
 *
 * Demonstrates the DebugManager's performance monitoring and debug visualization tools.
 *
 * Features:
 * - Stats panel: FPS, frame time, draw calls, triangles, memory
 * - Debug helpers: wireframe, grid, axes, normals, bounding boxes
 * - Keyboard shortcuts for all debug tools
 * - Performance profiling
 * - Scene inspection
 */

import { App } from '../src/app/App';
import * as THREE from 'three';

console.log('=== Debug System Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,  // Enables debug keyboard shortcuts
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Setup camera
app.camera.position.set(5, 3, 5);
app.controls.target.set(0, 0, 0);

// Setup simple environment
app.backgrounds.setColor(0x1a1a2e);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
app.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
app.scene.add(directionalLight);

console.log('=== Creating Test Objects ===\n');

// === Create a variety of objects for debugging ===

// Sphere with detailed geometry
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xff6b6b,
  roughness: 0.4,
  metalness: 0.6
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(-2, 1, 0);
sphere.name = 'DetailedSphere';
app.scene.add(sphere);

// Cube with lower poly count
const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const cubeMat = new THREE.MeshStandardMaterial({
  color: 0x4ecdc4,
  roughness: 0.5,
  metalness: 0.5
});
const cube = new THREE.Mesh(cubeGeo, cubeMat);
cube.position.set(0, 0.75, 0);
cube.name = 'SimpleCube';
app.scene.add(cube);

// Torus with many triangles
const torusGeo = new THREE.TorusGeometry(0.8, 0.3, 32, 64);
const torusMat = new THREE.MeshStandardMaterial({
  color: 0xffe66d,
  roughness: 0.2,
  metalness: 0.8
});
const torus = new THREE.Mesh(torusGeo, torusMat);
torus.position.set(2, 1, 0);
torus.name = 'DenseTorus';
app.scene.add(torus);

// Cone
const coneGeo = new THREE.ConeGeometry(0.5, 1.5, 16);
const coneMat = new THREE.MeshStandardMaterial({
  color: 0xa8e6cf,
  roughness: 0.4,
  metalness: 0.3
});
const cone = new THREE.Mesh(coneGeo, coneMat);
cone.position.set(-1, 0.75, -2);
cone.name = 'GeometricCone';
app.scene.add(cone);

// Icosahedron
const icoGeo = new THREE.IcosahedronGeometry(0.8, 1);
const icoMat = new THREE.MeshStandardMaterial({
  color: 0xff6fb5,
  roughness: 0.3,
  metalness: 0.7
});
const ico = new THREE.Mesh(icoGeo, icoMat);
ico.position.set(1, 0.8, -2);
ico.name = 'Icosahedron';
app.scene.add(ico);

// Ground plane
const groundGeo = new THREE.PlaneGeometry(15, 15);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  roughness: 0.9,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.name = 'GroundPlane';
app.scene.add(ground);

console.log('✓ Created 6 objects with varying complexity\n');

// === Demo the debug features ===

console.log('=== Debug Tools Available ===\n');
console.log('KEYBOARD SHORTCUTS:');
console.log('  D - Toggle stats panel (FPS, draw calls, memory)');
console.log('  W - Toggle wireframe mode');
console.log('  G - Toggle grid helper');
console.log('  A - Toggle axes helper');
console.log('  N - Toggle normal helpers');
console.log('  B - Toggle bounding boxes\n');

// Show stats panel by default
app.debug.showStats(true);
console.log('✓ Stats panel enabled (press D to toggle)\n');

console.log('=== Performance Profiling ===\n');

// Demo: Profile geometry creation
const profiledGeometry = app.debug.profile('Create TorusKnot Geometry', () => {
  return new THREE.TorusKnotGeometry(0.5, 0.15, 100, 16);
});

// Demo: Start/end profiling
app.debug.startProfile('Scene Traversal');
let objectCount = 0;
app.scene.traverse(() => {
  objectCount++;
});
app.debug.endProfile('Scene Traversal');
console.log(`  Found ${objectCount} objects in scene\n`);

console.log('=== Scene Inspection ===\n');

// Print scene graph
app.debug.printSceneGraph();
console.log('');

// Log memory usage
app.debug.logMemoryUsage();
console.log('');

// === Animation ===

app.addAnimateCallback((time) => {
  const t = time * 0.001;

  // Rotate objects
  sphere.rotation.y = t * 0.4;
  cube.rotation.x = t * 0.3;
  cube.rotation.y = t * 0.5;
  torus.rotation.x = t * 0.5;
  torus.rotation.y = t * 0.3;
  cone.rotation.y = t * 0.6;
  ico.rotation.x = t * 0.4;
  ico.rotation.y = t * 0.7;

  // Floating animation
  sphere.position.y = 1 + Math.sin(t * 2) * 0.2;
  torus.position.y = 1 + Math.cos(t * 1.5) * 0.15;
  ico.position.y = 0.8 + Math.sin(t * 2.5) * 0.15;
});

// Start rendering
app.start();

console.log('=== Demo Running ===');
console.log('✓ Stats panel shows real-time performance');
console.log('✓ Try the keyboard shortcuts to toggle debug visualizations');
console.log('✓ Watch FPS, draw calls, and triangle counts in the stats panel');
console.log('✓ Press N to see surface normals (green arrows)');
console.log('✓ Press B to see bounding boxes (yellow wireframes)');
console.log('✓ Press W for full wireframe mode\n');

console.log('EXPERIMENT:');
console.log('- Toggle different debug modes and observe the stats');
console.log('- Notice how normals and bounding boxes add draw calls');
console.log('- Wireframe mode is cheap (same geometry, different material)');
console.log('- Stats panel updates in real-time every frame\n');
