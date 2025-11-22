import * as THREE from 'three';
import { App } from '@core/App';

const app = new App();

// Create a spinning cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);

app.scene.add(cube);

// Animate it
app.addAnimateCallback((time, delta) => {
  cube.rotation.x += delta * 0.001;
  cube.rotation.y += delta * 0.001;
});

app.start();
