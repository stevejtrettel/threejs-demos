import * as THREE from 'three';
import { App } from '@core/App';

const app = new App();

// Setup scene
app.backgrounds.setGradient('#1a1a2e', '#16213e');
app.lights.set('three-point');
app.controls.setOrbit();

// Create geometry with proper material
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  roughness: 0.5,
  metalness: 0.5
});
const sphere = new THREE.Mesh(geometry, material);

app.scene.add(sphere);

app.addAnimateCallback((time, delta) => {
  sphere.rotation.y += delta * 0.001;
});

app.start();
