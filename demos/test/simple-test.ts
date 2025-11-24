/**
 * Simple Debug Test
 * Just a spinning cube - if this doesn't work, something is fundamentally wrong
 */

import { App } from '@/app/App';
import * as THREE from 'three';

console.log('Creating app...');
const app = new App({
  antialias: true,
  debug: true
});

console.log('App created:', app);
console.log('Scene:', app.scene);
console.log('Camera:', app.camera);
console.log('Renderer:', app.renderer);

// Set up camera
app.camera.position.set(0, 0, 5);

// Add a simple cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);
app.scene.add(cube);

console.log('Cube added to scene');
console.log('Scene children:', app.scene.children);

// Add a light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
app.scene.add(light);

console.log('Light added');

// Set background
app.backgrounds.setColor(0x333333);

console.log('Background set');

// Animate cube
app.addAnimateCallback((time) => {
  cube.rotation.x = time * 0.001;
  cube.rotation.y = time * 0.0015;
});

console.log('Animation callback added');

// Start
console.log('Starting app...');
app.start();

console.log('App started - you should see a red spinning cube!');
console.log('Press D to toggle stats');
