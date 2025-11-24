/**
 * Measurement & Annotation Demo
 *
 * Demonstrates the MeasurementManager for interactive measurements and annotations.
 *
 * Features:
 * - Coordinate display on hover
 * - Distance measurement between points
 * - 3D text labels (billboard sprites)
 * - Interactive measurement mode
 */

import { App } from '@/app/App';
import { MeasurementManager } from '@/scene/MeasurementManager';
import * as THREE from 'three';

console.log('=== Measurement & Annotation Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Create measurement manager
const measurements = new MeasurementManager(app.scene, app.camera, app.renderer.domElement);

// Setup camera
app.camera.position.set(8, 6, 8);
app.controls.target.set(0, 0, 0);

// Setup environment
app.backgrounds.setColor(0x1a1a2e);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
app.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
app.scene.add(directionalLight);

// Enable debug helpers
app.debug.showStats(true);
app.debug.toggleGrid(10, 10);
app.debug.toggleAxes(5);

console.log('=== Creating Scene Objects ===\n');

// === Create objects for measurement ===

// Sphere 1
const sphere1 = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.3, metalness: 0.7 })
);
sphere1.position.set(-3, 0.5, 0);
sphere1.name = 'sphere1';
app.scene.add(sphere1);

// Sphere 2
const sphere2 = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0x4ecdc4, roughness: 0.3, metalness: 0.7 })
);
sphere2.position.set(3, 0.5, 0);
sphere2.name = 'sphere2';
app.scene.add(sphere2);

// Cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xffe66d, roughness: 0.4, metalness: 0.6 })
);
cube.position.set(0, 0.5, 3);
cube.name = 'cube';
app.scene.add(cube);

// Cone
const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.5, 1.5, 32),
  new THREE.MeshStandardMaterial({ color: 0xa8e6cf, roughness: 0.4, metalness: 0.5 })
);
cone.position.set(0, 0.75, -3);
cone.name = 'cone';
app.scene.add(cone);

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.name = 'ground';
app.scene.add(ground);

console.log('✓ Created 5 objects for measurement\n');

// === Setup Measurement System ===

console.log('=== Setting Up Measurements ===\n');

// Enable measurements
measurements.enable();
console.log('✓ Measurement system enabled\n');

// Add labels to objects
measurements.addLabel('sphere1Label', sphere1.position, 'Sphere 1', {
  color: 0xff6b6b,
  size: 0.4,
  billboard: true,
  offset: new THREE.Vector3(0, 1.2, 0)
});

measurements.addLabel('sphere2Label', sphere2.position, 'Sphere 2', {
  color: 0x4ecdc4,
  size: 0.4,
  billboard: true,
  offset: new THREE.Vector3(0, 1.2, 0)
});

measurements.addLabel('cubeLabel', cube.position, 'Cube', {
  color: 0xffe66d,
  size: 0.4,
  billboard: true,
  offset: new THREE.Vector3(0, 1.2, 0)
});

measurements.addLabel('coneLabel', cone.position, 'Cone', {
  color: 0xa8e6cf,
  size: 0.4,
  billboard: true,
  offset: new THREE.Vector3(0, 1.5, 0)
});

// Add origin label
measurements.addLabel('origin', new THREE.Vector3(0, 0, 0), 'Origin', {
  color: 0xffffff,
  size: 0.3,
  offset: new THREE.Vector3(0, 0.3, 0)
});

console.log('✓ Added 5 labels to scene\n');

// Calculate and display some distances
const dist1 = measurements.distance(sphere1.position, sphere2.position);
console.log(`Distance sphere1 ↔ sphere2: ${dist1.toFixed(3)}`);

const dist2 = measurements.distance(sphere1.position, cube.position);
console.log(`Distance sphere1 ↔ cube: ${dist2.toFixed(3)}`);

const dist3 = measurements.distance(cube.position, cone.position);
console.log(`Distance cube ↔ cone: ${dist3.toFixed(3)}\n`);

// === Keyboard Controls ===

console.log('=== Keyboard Controls ===\n');
console.log('  C - Toggle coordinate display');
console.log('  M - Enter distance measurement mode');
console.log('  X - Exit measurement mode / Clear measurements');
console.log('  L - Toggle labels');
console.log('  D - Toggle debug stats');
console.log('  G - Toggle grid');
console.log('  A - Toggle axes\n');

let labelsVisible = true;
const labelNames = ['sphere1Label', 'sphere2Label', 'cubeLabel', 'coneLabel', 'origin'];

window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'c':
      // Toggle coordinate display
      measurements.showCoordinates(!measurements['showingCoordinates']);
      console.log(`Coordinate display: ${measurements['showingCoordinates'] ? 'ON' : 'OFF'}`);
      break;

    case 'm':
      // Enter measurement mode
      measurements.enterDistanceMeasurementMode();
      console.log('Entered distance measurement mode - click two points on the ground');
      break;

    case 'x':
      // Exit measurement mode
      measurements.exitMeasurementMode();
      console.log('Exited measurement mode');
      break;

    case 'l':
      // Toggle labels
      labelsVisible = !labelsVisible;
      if (labelsVisible) {
        // Re-add labels
        measurements.addLabel('sphere1Label', sphere1.position, 'Sphere 1', {
          color: 0xff6b6b,
          size: 0.4,
          offset: new THREE.Vector3(0, 1.2, 0)
        });
        measurements.addLabel('sphere2Label', sphere2.position, 'Sphere 2', {
          color: 0x4ecdc4,
          size: 0.4,
          offset: new THREE.Vector3(0, 1.2, 0)
        });
        measurements.addLabel('cubeLabel', cube.position, 'Cube', {
          color: 0xffe66d,
          size: 0.4,
          offset: new THREE.Vector3(0, 1.2, 0)
        });
        measurements.addLabel('coneLabel', cone.position, 'Cone', {
          color: 0xa8e6cf,
          size: 0.4,
          offset: new THREE.Vector3(0, 1.5, 0)
        });
        measurements.addLabel('origin', new THREE.Vector3(0, 0, 0), 'Origin', {
          color: 0xffffff,
          size: 0.3,
          offset: new THREE.Vector3(0, 0.3, 0)
        });
        console.log('Labels: ON');
      } else {
        // Remove labels
        for (const name of labelNames) {
          measurements.removeLabel(name);
        }
        console.log('Labels: OFF');
      }
      break;
  }
});

// === Animation ===

app.addAnimateCallback((time) => {
  const t = time * 0.001;

  // Rotate objects
  sphere1.rotation.y = t * 0.5;
  sphere2.rotation.y = t * 0.5;
  cube.rotation.x = t * 0.3;
  cube.rotation.y = t * 0.5;
  cone.rotation.y = t * 0.6;

  // Floating animation
  sphere1.position.y = 0.5 + Math.sin(t * 2) * 0.15;
  sphere2.position.y = 0.5 + Math.cos(t * 2) * 0.15;

  // Update billboard labels (they automatically face camera)
  measurements.update();
});

// Start rendering
app.start();

console.log('=== Demo Running ===');
console.log('✓ Measurement system active');
console.log('✓ Labels visible on all objects');
console.log('✓ Press C to show coordinates');
console.log('✓ Press M to measure distances');
console.log('  → Click two points on the ground plane to measure');
console.log('  → Yellow line will connect points with distance label');
console.log('✓ Press X to clear measurements\n');

console.log('=== Usage Examples ===\n');
console.log('// Enable coordinate display');
console.log('measurements.showCoordinates(true);\n');

console.log('// Calculate distance between two points');
console.log('const dist = measurements.distance(point1, point2);\n');

console.log('// Add a label');
console.log("measurements.addLabel('myLabel', position, 'Text', {");
console.log('  color: 0xff0000,');
console.log('  size: 0.5,');
console.log('  billboard: true  // Always faces camera');
console.log('});\n');

console.log('// Remove a label');
console.log("measurements.removeLabel('myLabel');\n");

console.log('// Interactive distance measurement');
console.log('measurements.enterDistanceMeasurementMode();');
console.log('// Click two points, distance will be displayed\n');
