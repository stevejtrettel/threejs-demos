/**
 * Atmospheric Sky Demo
 *
 * Demonstrates the realistic atmospheric scattering sky system
 * using Three.js Sky with physically-based parameters.
 *
 * Controls:
 * - D: Toggle debug stats
 * - Adjust sun position and atmospheric parameters to see effects
 */

import { App } from '../src/app/App';
import * as THREE from 'three';

console.log('=== Atmospheric Sky Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  shadows: true,
  far: 1000000  // Very far plane for massive sky sphere
});

// Setup camera
app.camera.position.set(0, 2, 10);
app.controls.target.set(0, 1, 0);

// === Create test objects ===

// Ground plane
const groundGeo = new THREE.PlaneGeometry(50, 50);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x3a5f0b,  // Grassy green
  roughness: 0.9,
  metalness: 0.0
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
app.scene.add(ground);

// Test sphere
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.5,
  metalness: 0.0
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(0, 1, 0);
sphere.castShadow = true;
sphere.receiveShadow = true;
app.scene.add(sphere);

console.log('✓ Created test scene');

// === Setup Atmospheric Sky ===

const sky = app.backgrounds.setAtmosphericSky({
  turbidity: 10,      // Atmospheric haze (1-20)
  rayleigh: 3,        // Blue sky intensity (0-4)
  mieCoefficient: 0.005,  // Atmospheric scattering
  mieDirectionalG: 0.7,   // Sun glow direction
  elevation: 10,      // Sun elevation (degrees above horizon)
  azimuth: 180,       // Sun direction (180 = south)
  exposure: 0.5       // Overall brightness
});

console.log('✓ Created atmospheric sky');
console.log('  - Turbidity: 10 (atmospheric haze)');
console.log('  - Rayleigh: 3 (blue sky scattering)');
console.log('  - Sun elevation: 10° (low on horizon)');
console.log('  - Sun azimuth: 180° (south)\n');

// Add sun light matching the sky
const sun = new THREE.DirectionalLight(0xffffff, 2.0);

// Calculate sun direction from elevation and azimuth
const elevation = 10;
const azimuth = 180;
const phi = THREE.MathUtils.degToRad(90 - elevation);
const theta = THREE.MathUtils.degToRad(azimuth);

sun.position.setFromSphericalCoords(50, phi, theta);
sun.castShadow = true;

// Configure shadows
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;

app.scene.add(sun);

// Add subtle ambient light
const ambient = new THREE.AmbientLight(0x404040, 0.2);
app.scene.add(ambient);

console.log('✓ Added sunlight matching sky');
console.log('  - DirectionalLight aligned with sky sun');
console.log('  - Shadows enabled\n');

// === Animation ===
app.addAnimateCallback((time) => {
  sphere.rotation.y = time * 0.0005;
});

// Start rendering
app.start();

console.log('=== Atmospheric Sky Parameters ===');
console.log('Adjustable properties:');
console.log('  turbidity (1-20): Atmospheric haze');
console.log('    1 = clear, 10 = typical, 20 = very hazy');
console.log('  rayleigh (0-4): Blue sky scattering');
console.log('    Higher = more blue');
console.log('  mieCoefficient (0-0.1): Atmospheric particles');
console.log('    Affects overall brightness');
console.log('  elevation (0-90): Sun height above horizon');
console.log('    0 = sunset, 45 = midday, 90 = noon');
console.log('  azimuth (0-360): Sun direction');
console.log('    0 = north, 90 = east, 180 = south, 270 = west');
console.log('  exposure (0-2): Overall brightness');
console.log('\n✓ Demo running! Press D for debug stats.');
console.log('\nTry different sun positions:');
console.log('  - Sunrise: elevation: 0-10, azimuth: 90');
console.log('  - Noon: elevation: 80-90, azimuth: 180');
console.log('  - Sunset: elevation: 0-10, azimuth: 270');
console.log('  - Golden hour: elevation: 5, turbidity: 15');
