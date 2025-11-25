/**
 * Reactive Geodesics Demo
 *
 * Demonstrates reactive dependency tracking:
 * - Multiple geodesics radiating from a common point
 * - Geodesics have fixed length and automatically recompute when surface changes
 * - Torus parameters animate, causing all geodesics to update
 * - Shows how mathematical objects can depend on and react to each other
 */

import { App } from '@/app/App';
import { Torus, SurfaceMesh } from '@/math';
import { GeodesicTrail } from '@/math/geodesics/GeodesicTrail';
import * as THREE from 'three';

console.log('=== Reactive Geodesics Demo ===\n');

// Create app
const app = new App({
  antialias: true,
  debug: true
});

// Setup scene
app.camera.position.set(5, 4, 8);
app.controls.target.set(0, 0, 0);
app.lights.set('three-point');
app.backgrounds.setColor(0x0a0a1e);

// Create torus with initial parameters
const torus = new Torus({
  R: 2.5,    // Major radius
  r: 0.8     // Minor radius
});

console.log('✓ Created Torus primitive');
console.log(`  - R (major radius): ${torus.R}`);
console.log(`  - r (minor radius): ${torus.r}`);

// Create semi-transparent surface mesh
const mesh = new SurfaceMesh(torus, {
  color: 0x2244aa,
  roughness: 0.4,
  metalness: 0.2,
  transmission: 0.3,  // Semi-transparent to see geodesics inside
  uSegments: 64,
  vSegments: 32
});

app.scene.add(mesh);

console.log('\n✓ Created SurfaceMesh');

// Create multiple geodesics radiating from the same point
const numGeodesics = 12;
const geodesics: GeodesicTrail[] = [];

const startPos: [number, number] = [0, 0];  // Starting position in (u, v)
const speed = 1.5;  // Initial speed magnitude

for (let i = 0; i < numGeodesics; i++) {
  const angle = (i / numGeodesics) * Math.PI * 2;

  // Create velocity vector pointing in different directions
  const velocity: [number, number] = [
    speed * Math.cos(angle),
    speed * Math.sin(angle)
  ];

  // Color based on angle (rainbow)
  const hue = i / numGeodesics;
  const color = new THREE.Color().setHSL(hue, 0.8, 0.6);

  const geodesic = new GeodesicTrail(torus, {
    initialPosition: startPos,
    initialVelocity: velocity,
    color: color.getHex(),
    lineWidth: 2,
    stepSize: 0.01,
    fixedSteps: 200  // Fixed length - will recompute when surface changes!
  });

  mesh.add(geodesic);  // Add as child of mesh so it inherits rotation!
  geodesics.push(geodesic);
}

console.log(`\n✓ Created ${numGeodesics} geodesics`);
console.log('  - All start from same point with different directions');
console.log('  - Fixed length: 200 integration steps');
console.log('  - Subscribed to surface parameter changes');

// Add marker at starting point
const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  depthTest: false
});
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
const startPoint = torus.evaluate(startPos[0], startPos[1]);
marker.position.copy(startPoint);
mesh.add(marker);  // Add as child of mesh so it inherits rotation!

console.log('\n=== Interactive Demo ===');
console.log('Watch as the torus morphs:');
console.log('  - Surface parameters change');
console.log('  - Geodesics automatically recompute');
console.log('  - All curves update together in real-time!');
console.log('\nTry in console:');
console.log('  torus.params.set("R", 3)  // Change major radius');
console.log('  torus.params.set("r", 1.2) // Change minor radius\n');

// Animate torus parameters to demonstrate reactivity
let animationEnabled = true;

app.addAnimateCallback((time) => {
  if (!animationEnabled) return;

  // Slowly rotate the view
  mesh.rotation.y = time * 0.15;

  // Animate major radius R - period ~5 seconds
  const newR = 2.5 + Math.sin(time * 1.2) * 0.7;
  torus.params.set('R', newR);

  // Animate minor radius r - period ~7 seconds for interesting phase
  const newR_minor = 0.8 + Math.sin(time * 0.9) * 0.3;
  torus.params.set('r', newR_minor);

  // Update marker position in local coordinates (it's a child of mesh)
  // The marker will inherit the mesh rotation automatically
  const newStartPoint = torus.evaluate(startPos[0], startPos[1]);
  marker.position.copy(newStartPoint);

  // Rotate marker for visibility (in local space)
  marker.rotation.x = time * 2;
  marker.rotation.y = time * 3;
});

// Start rendering
app.start();

console.log('\n✓ Demo running!');
console.log('  - Torus parameters are morphing');
console.log('  - Geodesics recompute automatically');
console.log('  - This demonstrates reactive dependency tracking!\n');

// Expose to console for experimentation
(window as any).torus = torus;
(window as any).mesh = mesh;
(window as any).geodesics = geodesics;
(window as any).toggleAnimation = () => {
  animationEnabled = !animationEnabled;
  console.log(`Animation ${animationEnabled ? 'enabled' : 'disabled'}`);
};
