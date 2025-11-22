import * as THREE from 'three';
import { App } from '@core/App';
import { SpinningSphere } from './SpinningSphere';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Component with internal params
const sphere = new SpinningSphere();
app.add(sphere, { params: ['speed', 'color'] });

// Ad-hoc Three.js object with helper params
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
cube.position.set(3, 0, 0);
app.scene.add(cube);

// Add parameters using helpers
app.params.addPosition(cube);
app.params.addRotation(cube);
app.params.addColor(cube.material);

app.start();

// Expose to console for testing
(window as any).app = app;
(window as any).sphere = sphere;
(window as any).cube = cube;

// Test in console
console.log('✨ Variables available in console:');
console.log('  app    - The main App instance');
console.log('  sphere - The spinning red sphere');
console.log('  cube   - The green cube');
console.log('');
console.log('Try these commands:');
console.log('  cube.position.x = 0');
console.log('  cube.rotation.y = Math.PI');
console.log('  sphere.speed = 5');
console.log('  sphere.color = 0xff00ff');
