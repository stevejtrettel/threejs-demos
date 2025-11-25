/**
 * Function Graph with Reactive Geodesics Demo
 *
 * Demonstrates:
 * - FunctionGraph surface from a scalar field f: R² → R
 * - RippleFunction with animated parameters
 * - Geodesics on a function graph that recompute when f changes
 * - Multi-level dependency chain: geodesics → surface → function
 */

import { App } from '@/app/App';
import { RippleFunction, FunctionGraph, SurfaceMesh } from '@/math';
import { GeodesicTrail } from '@/math/geodesics/GeodesicTrail';
import { Lights } from '@/scene';
import * as THREE from 'three';

console.log('=== Function Graph with Geodesics Demo ===\n');

// Create app
const app = new App({
  antialias: true,
  debug: true
});

// Setup scene
app.camera.position.set(6, 8, 6);
app.controls.target.set(0, 0, 0);
app.scene.add(Lights.threePoint());
app.backgrounds.setColor(0x0a0a1a);

// Create ripple function with reactive parameters
const ripple = new RippleFunction({
  amplitude: 0.8,
  frequency: 2.5,
  phase: 0,
  decay: 0.2  // Ripples decay away from origin
});

console.log('✓ Created RippleFunction');
console.log(`  - amplitude: ${ripple.amplitude}`);
console.log(`  - frequency: ${ripple.frequency}`);
console.log(`  - decay: ${ripple.decay}`);

// Create function graph surface z = f(x,y)
const surface = new FunctionGraph(ripple, {
  xyScale: 1,
  zScale: 1
});

console.log('\n✓ Created FunctionGraph surface');
console.log('  - Subscribed to ripple parameter changes');

// Create mesh visualization
const mesh = new SurfaceMesh(surface, {
  color: 0x3366ff,
  roughness: 0.3,
  metalness: 0.2,
  transmission: 0.4,  // Semi-transparent
  uSegments: 80,
  vSegments: 80
});

app.scene.add(mesh);

console.log('\n✓ Created SurfaceMesh');

// Create geodesics radiating from an off-center point
const numGeodesics = 16;
const geodesics: GeodesicTrail[] = [];

// Start at an off-center location to see asymmetric geodesic behavior
const startPos: [number, number] = [-1.2, 0.5];
const speed = 1.2;

for (let i = 0; i < numGeodesics; i++) {
  const angle = (i / numGeodesics) * Math.PI * 2;

  const velocity: [number, number] = [
    speed * Math.cos(angle),
    speed * Math.sin(angle)
  ];

  // Color gradient
  const hue = i / numGeodesics;
  const color = new THREE.Color().setHSL(hue, 0.9, 0.6);

  const geodesic = new GeodesicTrail(surface, {
    initialPosition: startPos,
    initialVelocity: velocity,
    color: color.getHex(),
    lineWidth: 2,
    stepSize: 0.02,
    fixedSteps: 120  // Fixed length - recomputes when surface changes!
  });

  mesh.add(geodesic);
  geodesics.push(geodesic);
}

console.log(`\n✓ Created ${numGeodesics} geodesics`);
console.log(`  - All start from (${startPos[0]}, ${startPos[1]})`);
console.log('  - Subscribed to surface parameter changes');
console.log('  - Will recompute when ripple function changes!');

// Add marker at starting point
const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  depthTest: false
});
const marker = new THREE.Mesh(markerGeometry, markerMaterial);
const startPoint = surface.evaluate(startPos[0], startPos[1]);
marker.position.copy(startPoint);
mesh.add(marker);

// Add grid helper at z=0
const gridHelper = new THREE.GridHelper(6, 30, 0x444444, 0x222222);
app.scene.add(gridHelper);

console.log('\n=== Multi-Level Reactivity ===');
console.log('Dependency chain:');
console.log('  Geodesics → Surface → Function');
console.log('\nWhen function parameters change:');
console.log('  1. Function notifies Surface');
console.log('  2. Surface rebuilds geometry');
console.log('  3. Surface notifies Geodesics');
console.log('  4. Geodesics recompute paths');
console.log('\nTry in console:');
console.log('  ripple.params.set("amplitude", 1.5)');
console.log('  ripple.params.set("frequency", 3.5)');
console.log('  ripple.params.set("decay", 0.5)\n');

// Animate function parameters
let animationEnabled = true;

app.addAnimateCallback((time) => {
  if (!animationEnabled) return;

  // Rotate view slowly
  mesh.rotation.z = time * 0.1;

  // Animate ripple amplitude - period ~6 seconds
  const newAmplitude = 0.8 + Math.sin(time * 1.0) * 0.4;
  ripple.params.set('amplitude', newAmplitude);

  // Animate ripple frequency - period ~8 seconds
  const newFrequency = 2.5 + Math.sin(time * 0.7) * 0.8;
  ripple.params.set('frequency', newFrequency);

  // Animate phase to create traveling wave effect
  const newPhase = time * 0.5;
  ripple.params.set('phase', newPhase);

  // Update marker position
  const newStartPoint = surface.evaluate(startPos[0], startPos[1]);
  marker.position.copy(newStartPoint);

  // Rotate marker for visibility
  marker.rotation.x = time * 2;
  marker.rotation.y = time * 3;
});

// Start rendering
app.start();

console.log('\n✓ Demo running!');
console.log('  - Function parameters are animating');
console.log('  - Surface + geodesics recompute automatically');
console.log('  - Watch the geodesic paths change as ripples morph!\n');

// Expose to console
(window as any).ripple = ripple;
(window as any).surface = surface;
(window as any).mesh = mesh;
(window as any).geodesics = geodesics;
(window as any).toggleAnimation = () => {
  animationEnabled = !animationEnabled;
  console.log(`Animation ${animationEnabled ? 'enabled' : 'disabled'}`);
};
