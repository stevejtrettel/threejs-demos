import * as THREE from 'three';
import { App } from '@/app/App';
import { Materials } from '@/scene/Materials';

/**
 * Video Export Demo
 * 
 * Demonstrates:
 * 1. Frame-by-frame video export (V)
 */

const app = new App({
    fov: 60,
    position: new THREE.Vector3(0, 0, 10)
} as any);

// Scene Setup
const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    Materials.plastic(0xff5500)
);
app.add(cube, {
    animate: (time, delta) => {
        cube.rotation.x = time;
        cube.rotation.y = time * 0.5;
    }
});

app.lights.set('three-point');

// Instructions
console.log('--- Video Export Demo ---');
console.log('Press V: Export 2-second video at 30fps');

// Controls
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'v') {
        console.log('Starting export...');
        app.video.export({
            duration: 2.0,
            fps: 30,
            filename: 'demo-video',
            onProgress: (p) => console.log(`Exporting: ${(p * 100).toFixed(0)}%`)
        });
    }
});

app.start();
