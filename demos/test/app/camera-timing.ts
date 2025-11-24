import * as THREE from 'three';
import { App } from '@/app/App';
import { Materials } from '@/materials/Materials';

/**
 * Phase 1 Demo: Camera & Time
 * 
 * This demo showcases:
 * 1. TimelineManager: Controlling simulation speed and pausing
 * 2. CameraManager: Smooth camera transitions
 */

// Initialize App
const app = new App({
    fov: 60,
    position: new THREE.Vector3(0, 5, 10)
} as any); // Type cast until AppOptions is updated

// Add a reference grid
const grid = new THREE.GridHelper(10, 10);
app.add(grid);

// Add a rotating cube to visualize time/speed
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = Materials.plastic(0x0077ff);
const cube = new THREE.Mesh(geometry, material);
cube.position.y = 0.5;

// Add to app with animation logic
app.add(cube, {
    animate: (time: number, delta: number) => {
        // Rotation depends on delta, so it will respect time scaling
        cube.rotation.y += delta;
        cube.rotation.x += delta * 0.5;
    }
});

// Add some lights
app.lights.set('three-point');

// --- DEMO SCRIPT ---

console.log('--- Phase 1 Demo Started ---');
console.log('1. Normal speed (1.0x)');

// Sequence of events
setTimeout(() => {
    console.log('2. Slow motion (0.2x)');
    app.timeline.setSpeed(0.2);
}, 2000);

setTimeout(() => {
    console.log('3. Fast forward (5.0x)');
    app.timeline.setSpeed(5.0);
}, 4000);

setTimeout(() => {
    console.log('4. Pause');
    app.timeline.pause();
}, 6000);

setTimeout(() => {
    console.log('5. Resume normal speed & Camera FlyTo');
    app.timeline.play();
    app.timeline.setSpeed(1.0);

    // Fly camera to a new position
    app.cameraManager.flyTo(
        new THREE.Vector3(5, 5, 5), // Target position
        new THREE.Vector3(0, 0, 0), // Look at target
        { duration: 2.0 }
    ).then(() => {
        console.log('Camera transition complete!');
    });
}, 8000);

// Start the loop
app.start();
