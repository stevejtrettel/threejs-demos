import * as THREE from 'three';
import { App } from '@/app/App';
import { Materials } from '@/materials/Materials';

/**
 * Screenshot Export Demo
 * 
 * Demonstrates:
 * 1. Standard Screenshot (P)
 * 2. High-Resolution Screenshot (Shift+P)
 */

const app = new App({
    fov: 60,
    position: new THREE.Vector3(0, 0, 10)
} as any);

// Scene Setup
const torus = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
    Materials.plastic(0x00ff88)
);
app.add(torus, {
    animate: (time, delta) => {
        torus.rotation.x += delta * 0.5;
        torus.rotation.y += delta;
    }
});

app.lights.set('three-point');

// Instructions
console.log('--- Screenshot Demo ---');
console.log('Press P: Take Screenshot (Window Size)');
console.log('Press Shift+P: Take 4K Screenshot (3840x2160)');

// Controls
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        if (e.shiftKey) {
            console.log('Capturing 4K screenshot...');
            app.screenshots.captureHighRes(3840, 2160, 'screenshot-4k.png');
        } else {
            console.log('Capturing screenshot...');
            app.screenshots.capture('screenshot.png');
        }
    }
});

app.start();
