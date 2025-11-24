import * as THREE from 'three';
import { App } from '@/app/App';
import { Materials } from '@/materials/Materials';

/**
 * Mesh Export Demo
 * 
 * Demonstrates:
 * 1. GLTF Export (1)
 * 2. OBJ Export (2)
 * 3. STL Export (3)
 */

const app = new App({
    fov: 60,
    position: new THREE.Vector3(0, 0, 10)
} as any);

// Scene Setup
const group = new THREE.Group();
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    Materials.plastic(0x0077ff)
);
const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.2, 1.5),
    Materials.plastic(0xffffff)
);
box.position.y = -1.2;
group.add(sphere, box);

app.add(group, {
    animate: (time, delta) => {
        group.rotation.y += delta * 0.5;
    }
});

app.lights.set('three-point');

// Instructions
console.log('--- Mesh Export Demo ---');
console.log('Press 1: Export GLTF (Binary .glb)');
console.log('Press 2: Export OBJ');
console.log('Press 3: Export STL (Binary)');

// Controls
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case '1':
            console.log('Exporting GLTF...');
            app.export.exportGLTF(app.scene, 'scene.glb');
            break;
        case '2':
            console.log('Exporting OBJ...');
            app.export.exportOBJ(app.scene, 'scene.obj');
            break;
        case '3':
            console.log('Exporting STL...');
            app.export.exportSTL(group, 'model.stl');
            break;
    }
});

app.start();
