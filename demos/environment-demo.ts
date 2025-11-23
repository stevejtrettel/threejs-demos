/**
 * Environment & Lighting Demo
 *
 * Demonstrates the enhanced BackgroundManager features:
 * - Procedural sky background
 * - Environment intensity control
 * - Separating background and environment lighting
 * - Different material responses to IBL
 */

import { App } from '../src/app/App';
import * as THREE from 'three';

console.log('=== Environment & Lighting Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  shadows: true,  // Enable shadow mapping
  far: 10000      // Extend camera far plane to see sky sphere
});

// Setup camera
app.camera.position.set(0, 2, 10);
app.controls.target.set(0, 1, 0);

// === Create test objects with different materials ===

// Metal sphere (highly reflective, shows environment well)
const metalGeo = new THREE.SphereGeometry(1, 64, 64);
const metalMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.1,
  envMapIntensity: 1.0
});
const metalSphere = new THREE.Mesh(metalGeo, metalMat);
metalSphere.position.set(-3, 1, 0);
metalSphere.castShadow = true;
metalSphere.receiveShadow = true;
app.scene.add(metalSphere);

// Glossy plastic sphere (medium reflection)
const plasticGeo = new THREE.SphereGeometry(1, 64, 64);
const plasticMat = new THREE.MeshStandardMaterial({
  color: 0xff6b35,
  metalness: 0.0,
  roughness: 0.3,
  envMapIntensity: 0.8
});
const plasticSphere = new THREE.Mesh(plasticGeo, plasticMat);
plasticSphere.position.set(0, 1, 0);
plasticSphere.castShadow = true;
plasticSphere.receiveShadow = true;
app.scene.add(plasticSphere);

// Rough material (subtle environment influence)
const roughGeo = new THREE.SphereGeometry(1, 64, 64);
const roughMat = new THREE.MeshStandardMaterial({
  color: 0x4ecdc4,
  metalness: 0.0,
  roughness: 0.8,
  envMapIntensity: 0.5
});
const roughSphere = new THREE.Mesh(roughGeo, roughMat);
roughSphere.position.set(3, 1, 0);
roughSphere.castShadow = true;
roughSphere.receiveShadow = true;
app.scene.add(roughSphere);

// Ground plane to show lighting
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x808080,
  roughness: 0.8,
  metalness: 0.0
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
app.scene.add(ground);

console.log('✓ Created test objects:');
console.log('  - Left: Metal sphere (metalness: 1.0, roughness: 0.1)');
console.log('  - Center: Plastic sphere (metalness: 0.0, roughness: 0.3)');
console.log('  - Right: Rough sphere (metalness: 0.0, roughness: 0.8)\n');

// === Setup Environment ===

// Option 1: Procedural Sky (no HDRI needed)
app.backgrounds.setSky({
  topColor: 0x0077ff,      // Sky blue
  bottomColor: 0xffffff,   // Horizon white
  offset: 33,
  exponent: 0.6
});

console.log('✓ Using procedural sky background');
console.log('  - Top color: 0x0077ff (sky blue)');
console.log('  - Bottom color: 0xffffff (white)\n');

// Add some directional light since sky doesn't provide environment lighting
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 10, 5);
sun.castShadow = true;

// Configure shadow properties for better quality
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;

app.scene.add(sun);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
app.scene.add(ambient);

console.log('✓ Added lighting:');
console.log('  - Directional light (sun)');
console.log('  - Ambient light\n');

// === Demo HDRI Loading (commented out - uncomment if you have an HDRI) ===
/*
console.log('To use HDRI environment:');
console.log('  1. Place an HDR file in /assets/hdri/');
console.log('  2. Uncomment the loadHDR call below:\n');
console.log('app.backgrounds.loadHDR(\'/assets/hdri/studio.hdr\', {');
console.log('  asEnvironment: true,  // Use for IBL');
console.log('  asBackground: false,  // Keep procedural sky as background');
console.log('  intensity: 1.5        // Boost environment lighting');
console.log('});\n');

// Example HDRI loading:
// app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
//   asEnvironment: true,   // Use for image-based lighting
//   asBackground: false,   // Don't replace the sky background
//   intensity: 1.5,        // Boost IBL strength
//   rotation: 0            // Rotate environment (radians)
// });
*/

// === Environment Controls Demo ===

console.log('=== Environment Controls ===');
console.log('Available methods:');
console.log('  app.backgrounds.setEnvironmentIntensity(1.5)  // Boost IBL');
console.log('  app.backgrounds.removeEnvironment()           // Remove IBL only');
console.log('  app.backgrounds.removeBackground()            // Remove background only');
console.log('  app.backgrounds.setColor(0x1a1a1a)           // Solid color background\n');

// === Animation ===
app.addAnimateCallback((time) => {
  // Rotate spheres to show different angles
  const t = time * 0.0003;
  metalSphere.rotation.y = t;
  plasticSphere.rotation.y = t;
  roughSphere.rotation.y = t;
});

// Start rendering
app.start();

console.log('✓ Demo running!');
console.log('\nNotice how different materials respond to the environment:');
console.log('  - Metal sphere: Strong reflections');
console.log('  - Plastic sphere: Subtle speculars');
console.log('  - Rough sphere: Diffuse appearance');
console.log('\nPress D for debug stats, W for wireframe, G for grid, A for axes');
