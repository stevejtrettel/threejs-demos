/**
 * Parametric Surface Demo
 *
 * Demonstrates the math library's surface system:
 * - Torus primitive with reactive parameters (R, r)
 * - SurfaceMesh component with visual controls
 * - All changes are reactive and automatic
 */

import { App } from '@/app/App';
import { Torus, SurfaceMesh } from '@/math';
import { Lights } from '@/scene';
import * as THREE from 'three';

console.log('=== Parametric Surface Demo ===\n');

// Create app
const app = new App({
  antialias: true,
  debug: true
});

// Setup scene
app.camera.position.set(0, 3, 8);
app.controls.target.set(0, 0, 0);
app.scene.add(Lights.threePoint());
app.backgrounds.setColor(0x1a1a2e);

// Create torus primitive with reactive parameters
const torus = new Torus({
  R: 2,    // Major radius
  r: 0.8   // Minor radius
});

console.log('✓ Created Torus primitive');
console.log(`  - R (major radius): ${torus.R}`);
console.log(`  - r (minor radius): ${torus.r}`);

// Create surface mesh component
const mesh = new SurfaceMesh(torus, {
  color: 0x4488ff,
  roughness: 0.3,
  metalness: 0.1,
  uSegments: 64,
  vSegments: 32
});

app.scene.add(mesh);

console.log('\n✓ Created SurfaceMesh component');
console.log(`  - Geometry: ${mesh.geometry.attributes.position.count} vertices`);
console.log(`  - Material: MeshPhysicalMaterial`);
console.log(`  - Color: 0x${mesh.color.toString(16)}`);

// Add UI panel to demonstrate reactivity
console.log('\n=== Interactive Parameters ===');
console.log('Try changing these in code or via UI:');
console.log('  torus.params.set("R", 3)     // Change major radius');
console.log('  torus.params.set("r", 1.5)   // Change minor radius');
console.log('  mesh.params.set("color", 0xff4444)  // Change color');
console.log('  mesh.params.set("uSegments", 128)   // Increase detail');

// Demonstrate automatic reactivity
setTimeout(() => {
  console.log('\n--- Automatic Animation ---');
  console.log('Watch the torus morph smoothly...\n');
}, 2000);

// Animate parameters to show reactivity
app.addAnimateCallback((time) => {
  // Slowly rotate the mesh
  mesh.rotation.y = time * 0.3;

  // Animate the major radius (R) - period = 2π/freq ≈ 3 seconds
  const newR = 2 + Math.sin(time * 2.0) * 0.8;
  torus.params.set('R', newR);

  // Animate the minor radius (r) - period ≈ 4 seconds for interesting phase difference
  const newR_minor = 0.8 + Math.sin(time * 1.5) * 0.3;
  torus.params.set('r', newR_minor);

  // Color cycles through hues - complete cycle every 10 seconds
  const hue = (time * 0.1) % 1;
  const color = new THREE.Color().setHSL(hue, 0.7, 0.6);
  mesh.params.set('color', color.getHex());
});

// Start rendering
app.start();

console.log('\n✓ Demo running!');
console.log('  - Press D to toggle stats');
console.log('  - Surface parameters are animating');
console.log('  - Notice: mesh rebuilds automatically when torus changes!\n');
