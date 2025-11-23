/**
 * HDRI Environment Mapping Demo
 *
 * Demonstrates loading and using HDRI files for realistic lighting and backgrounds.
 *
 * Setup:
 * 1. Place an HDR file in /assets/hdri/ (e.g., studio.hdr)
 * 2. Free HDRIs: https://polyhaven.com/hdris
 *
 * This demo shows three patterns:
 * - HDRI for both environment lighting and background
 * - HDRI for lighting only (with solid color background)
 * - HDRI for lighting only (with procedural sky background)
 */

import { App } from '../src/app/App';
import * as THREE from 'three';

console.log('=== HDRI Environment Mapping Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  shadows: true,
  toneMapping: 'aces',    // Important for HDR
  toneMappingExposure: 1.0
});

// Setup camera
app.camera.position.set(0, 2, 8);
app.controls.target.set(0, 1, 0);

// === Create test objects with different materials ===

// Chrome sphere (very reflective - shows HDRI best)
const chromeGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.0,  // Mirror finish
  envMapIntensity: 1.0
});
const chromeSphere = new THREE.Mesh(chromeGeo, chromeMat);
chromeSphere.position.set(-3, 1, 0);
chromeSphere.castShadow = true;
app.scene.add(chromeSphere);

// Brushed metal (medium reflection)
const metalGeo = new THREE.SphereGeometry(1, 64, 64);
const metalMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.3,
  envMapIntensity: 1.0
});
const metalSphere = new THREE.Mesh(metalGeo, metalMat);
metalSphere.position.set(0, 1, 0);
metalSphere.castShadow = true;
app.scene.add(metalSphere);

// Glossy plastic (dielectric)
const plasticGeo = new THREE.SphereGeometry(1, 64, 64);
const plasticMat = new THREE.MeshStandardMaterial({
  color: 0xff6b35,
  metalness: 0.0,
  roughness: 0.2,
  envMapIntensity: 0.8
});
const plasticSphere = new THREE.Mesh(plasticGeo, plasticMat);
plasticSphere.position.set(3, 1, 0);
plasticSphere.castShadow = true;
app.scene.add(plasticSphere);

// Ground plane
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x808080,
  roughness: 0.8,
  metalness: 0.0
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
app.scene.add(ground);

console.log('✓ Created test objects');
console.log('  - Left: Chrome (mirror finish - perfect HDRI reflection)');
console.log('  - Center: Brushed metal (roughness: 0.3)');
console.log('  - Right: Glossy plastic (subtle reflections)\n');

// === HDRI Loading Examples ===

console.log('=== HDRI Loading Patterns ===\n');

// Pattern 1: HDRI for both lighting AND background
console.log('Pattern 1: HDRI as both environment and background');
console.log('  app.backgrounds.loadHDR(\'/assets/hdri/studio.hdr\', {');
console.log('    asEnvironment: true,');
console.log('    asBackground: true,');
console.log('    intensity: 1.0');
console.log('  });\n');

// Pattern 2: HDRI for lighting only, solid background
console.log('Pattern 2: HDRI lighting + solid color background');
console.log('  app.backgrounds.setColor(0x1a1a1a);');
console.log('  app.backgrounds.loadHDR(\'/assets/hdri/studio.hdr\', {');
console.log('    asEnvironment: true,');
console.log('    asBackground: false,');
console.log('    intensity: 1.5');
console.log('  });\n');

// Pattern 3: HDRI for lighting, procedural sky background
console.log('Pattern 3: HDRI lighting + procedural sky background');
console.log('  app.backgrounds.setSky({ topColor: 0x0077ff });');
console.log('  app.backgrounds.loadHDR(\'/assets/hdri/outdoor.hdr\', {');
console.log('    asEnvironment: true,');
console.log('    asBackground: false');
console.log('  });\n');

// === Attempt to load HDRI ===

const hdriPath = '/assets/hdri/studio.hdr';

console.log(`Attempting to load HDRI: ${hdriPath}`);
console.log('(If file not found, demo will use fallback lighting)\n');

// Try to load HDRI
app.backgrounds.loadHDR(hdriPath, {
  asEnvironment: true,
  asBackground: true,
  intensity: 1.2
});

// Fallback: If HDRI doesn't load, use directional light
// (You'll see warnings in console if HDRI fails to load)
setTimeout(() => {
  // Add fallback lighting in case HDRI doesn't load
  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(5, 10, 5);
  light.castShadow = true;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  app.scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  app.scene.add(ambient);
}, 100);

// === Animation ===
app.addAnimateCallback((time) => {
  // Rotate spheres to show different angles
  const t = time * 0.0003;
  chromeSphere.rotation.y = t;
  metalSphere.rotation.y = t;
  plasticSphere.rotation.y = t;
});

// Start rendering
app.start();

console.log('=== HDRI Setup Guide ===');
console.log('\nTo use this demo with real HDRI:');
console.log('1. Download free HDRI from:');
console.log('   - Poly Haven: https://polyhaven.com/hdris');
console.log('   - HDRI Haven: https://hdrihaven.com');
console.log('   - sIBL Archive: http://www.hdrlabs.com/sibl/archive.html');
console.log('\n2. Place .hdr file in: /assets/hdri/');
console.log('   Example: /assets/hdri/studio.hdr');
console.log('\n3. Recommended HDRIs for different scenes:');
console.log('   - Studio/Product: "studio_small_03", "photo_studio_01"');
console.log('   - Outdoor: "kloppenheim_06", "sunset_fairway"');
console.log('   - Interior: "artist_workshop", "modern_buildings"');
console.log('\n4. File formats supported:');
console.log('   - .hdr (Radiance HDR) - most common');
console.log('   - .exr (OpenEXR) - also supported');
console.log('\n✓ Demo running! Press D for debug stats.');
console.log('\nNotice how the chrome sphere perfectly reflects the environment!');

// === Using AssetManager (alternative approach) ===
console.log('\n=== Alternative: Using AssetManager ===');
console.log('You can also load HDRIs via AssetManager for more control:\n');
console.log('const envMap = await app.assets.loadHDRI(\'/assets/hdri/studio.hdr\');');
console.log('app.backgrounds.setEnvironmentOnly(envMap, 1.5);');
console.log('app.backgrounds.setColor(0x1a1a1a);\n');
