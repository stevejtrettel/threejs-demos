/**
 * Scene-Based Environment Demo
 *
 * Demonstrates creating custom procedural environments by rendering
 * a THREE.Scene to a cubemap for use as background and IBL.
 *
 * This technique allows creating stylized environments without HDRI files:
 * - Rooms with colored lights
 * - Geometric patterns
 * - Stylized lighting that matches your scene aesthetic
 * - Dynamic environments that can be procedurally generated
 *
 * Similar to the classic "BoxWithLights" pattern but modernized.
 */

import { App } from '@/app/App';
import * as THREE from 'three';

console.log('=== Scene-Based Environment Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  shadows: true,
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Setup camera
app.camera.position.set(0, 2, 8);
app.controls.target.set(0, 1, 0);

// === Create test objects to show environment reflections ===

// Chrome sphere (perfect reflections)
const chromeGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.0,
  envMapIntensity: 1.0
});
const chromeSphere = new THREE.Mesh(chromeGeo, chromeMat);
chromeSphere.position.set(-2.5, 1, 0);
chromeSphere.castShadow = true;
app.scene.add(chromeSphere);

// Brushed metal sphere
const metalGeo = new THREE.SphereGeometry(1, 64, 64);
const metalMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.3,
  envMapIntensity: 1.0
});
const metalSphere = new THREE.Mesh(metalGeo, metalMat);
metalSphere.position.set(2.5, 1, 0);
metalSphere.castShadow = true;
app.scene.add(metalSphere);

// Ground plane (reflective to show environment)
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x404040,
  roughness: 0.2,
  metalness: 0.8,
  envMapIntensity: 1.5
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
app.scene.add(ground);

console.log('✓ Created test objects');
console.log('  - Left: Chrome sphere (mirror finish)');
console.log('  - Right: Brushed metal sphere\n');

// === Create Custom Environment Scene ===

console.log('=== Creating Custom Environment Scene ===\n');

// Create a separate scene for the environment
const envScene = new THREE.Scene();

// Create a room (box viewed from inside)
const roomSize = 20;
const roomGeo = new THREE.BoxGeometry(roomSize, roomSize, roomSize);
const roomMat = new THREE.MeshBasicMaterial({
  color: 0x2a2a2a,
  side: THREE.BackSide  // View from inside
});
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

console.log('✓ Created room geometry (box viewed from inside)');

// Add colored emissive light sources around the room
// This is the modern version of your BoxWithLights pattern

// Red light (top-left corner)
const redLightGeo = new THREE.SphereGeometry(1, 16, 16);
const redLightMat = new THREE.MeshBasicMaterial({
  color: 0xff3333,
  // Emissive materials glow
});
const redLight = new THREE.Mesh(redLightGeo, redLightMat);
redLight.position.set(-6, 6, -6);
envScene.add(redLight);

const redPointLight = new THREE.PointLight(0xff3333, 100, 30);
redPointLight.position.copy(redLight.position);
envScene.add(redPointLight);

// Blue light (top-right corner)
const blueLightGeo = new THREE.SphereGeometry(1, 16, 16);
const blueLightMat = new THREE.MeshBasicMaterial({
  color: 0x3333ff,
});
const blueLight = new THREE.Mesh(blueLightGeo, blueLightMat);
blueLight.position.set(6, 6, 6);
envScene.add(blueLight);

const bluePointLight = new THREE.PointLight(0x3333ff, 100, 30);
bluePointLight.position.copy(blueLight.position);
envScene.add(bluePointLight);

// Green light (center-left)
const greenLightGeo = new THREE.SphereGeometry(1, 16, 16);
const greenLightMat = new THREE.MeshBasicMaterial({
  color: 0x33ff33,
});
const greenLight = new THREE.Mesh(greenLightGeo, greenLightMat);
greenLight.position.set(-6, 0, 6);
envScene.add(greenLight);

const greenPointLight = new THREE.PointLight(0x33ff33, 100, 30);
greenPointLight.position.copy(greenLight.position);
envScene.add(greenPointLight);

// Yellow light (bottom-right)
const yellowLightGeo = new THREE.SphereGeometry(1, 16, 16);
const yellowLightMat = new THREE.MeshBasicMaterial({
  color: 0xffff33,
});
const yellowLight = new THREE.Mesh(yellowLightGeo, yellowLightMat);
yellowLight.position.set(6, -3, -6);
envScene.add(yellowLight);

const yellowPointLight = new THREE.PointLight(0xffff33, 100, 30);
yellowPointLight.position.copy(yellowLight.position);
envScene.add(yellowPointLight);

console.log('✓ Added colored light sources:');
console.log('  - Red (top-left)');
console.log('  - Blue (top-right)');
console.log('  - Green (center-left)');
console.log('  - Yellow (bottom-right)\n');

// Add ambient light to prevent pure black
const envAmbient = new THREE.AmbientLight(0xffffff, 0.1);
envScene.add(envAmbient);

// === Render Environment Scene to Cubemap ===

console.log('=== Rendering Environment to Cubemap ===\n');

const envMap = app.backgrounds.createEnvironmentFromScene(envScene, {
  resolution: 512,           // Higher resolution for better quality
  near: 0.1,
  far: 100,
  intensity: 1.0,
  asBackground: true,        // Use as scene background
  asEnvironment: true,       // Use for IBL (lighting on materials)
  backgroundBlurriness: 0.3  // Blur the background (0-1)
});

console.log('✓ Generated cubemap environment');
console.log('  - Resolution: 512x512 per face');
console.log('  - Using PMREM for proper IBL');
console.log('  - Applied as both background and environment');
console.log('  - Background blur: 0.3 (keeps environment sharp for IBL)\n');

// === Add some direct lighting for shadows ===

const directional = new THREE.DirectionalLight(0xffffff, 0.5);
directional.position.set(5, 10, 5);
directional.castShadow = true;
directional.shadow.mapSize.width = 2048;
directional.shadow.mapSize.height = 2048;
app.scene.add(directional);

console.log('✓ Added directional light for shadows\n');

// === Animation ===
app.addAnimateCallback((time) => {
  // Rotate spheres to show different angles
  const t = time * 0.0003;
  chromeSphere.rotation.y = t;
  metalSphere.rotation.y = t;
});

// Start rendering
app.start();

console.log('=== Scene-Based Environment Benefits ===');
console.log('✓ No HDRI files needed');
console.log('✓ Fully procedural and customizable');
console.log('✓ Can be generated at runtime');
console.log('✓ Perfect for stylized/non-photorealistic looks');
console.log('✓ Matches your scene aesthetic exactly\n');

console.log('=== API Usage ===');
console.log('// 1. Create environment scene');
console.log('const envScene = new THREE.Scene();');
console.log('');
console.log('// 2. Add geometry and lights');
console.log('const room = new THREE.Mesh(');
console.log('  new THREE.BoxGeometry(20, 20, 20),');
console.log('  new THREE.MeshStandardMaterial({ side: THREE.BackSide })');
console.log(');');
console.log('envScene.add(room);');
console.log('envScene.add(new THREE.PointLight(0xff0000, 100));');
console.log('');
console.log('// 3. Render to cubemap');
console.log('const envMap = app.backgrounds.createEnvironmentFromScene(envScene, {');
console.log('  resolution: 512,     // Cubemap resolution');
console.log('  intensity: 1.0,      // Environment intensity');
console.log('  asBackground: true,  // Use as background');
console.log('  asEnvironment: true  // Use for IBL');
console.log('});\n');

console.log('=== Advanced Options ===');
console.log('createEnvironmentFromScene(scene, {');
console.log('  position: new THREE.Vector3(0, 0, 0), // Camera position');
console.log('  resolution: 256,        // 256, 512, 1024, etc.');
console.log('  near: 0.1,              // Camera near plane');
console.log('  far: 1000,              // Camera far plane');
console.log('  intensity: 1.0,         // Environment intensity multiplier');
console.log('  asBackground: true,     // Use as scene.background');
console.log('  asEnvironment: true,    // Use as scene.environment (IBL)');
console.log('  backgroundBlurriness: 0 // Blur background 0-1 (sharp IBL)');
console.log('});\n');
console.log('TIP: Use backgroundBlurriness to blur the background while keeping');
console.log('     sharp IBL for realistic material reflections!\n');

console.log('✓ Demo running! Press D for debug stats.');
console.log('\nNotice how the spheres reflect the colored lights from the environment!');
console.log('The chrome sphere shows perfect reflections of the room and lights.');
