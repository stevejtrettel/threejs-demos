// Mock window for Node environment
(global as any).window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: () => { },
    removeEventListener: () => { },
};
(global as any).document = {
    createElement: () => ({ getContext: () => ({}) }),
    body: { appendChild: () => { }, style: {} },
};
(global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);

import { App } from './app/App.ts';
import * as THREE from 'three';

// Create app
const app = new App({
    fov: 60,
    position: new THREE.Vector3(0, 5, 10)
} as any); // Cast to any because we added position to options in CameraManager but maybe not AppOptions interface yet

console.log('App initialized successfully');
console.log('Camera Manager:', app.cameraManager ? 'Present' : 'Missing');
console.log('Timeline Manager:', app.timeline ? 'Present' : 'Missing');

// Test Camera
const startPos = app.camera.position.clone();
console.log(`Initial Camera Position: ${startPos.x}, ${startPos.y}, ${startPos.z}`);

app.cameraManager.setPosition(10, 10, 10);
console.log(`New Camera Position: ${app.camera.position.x}, ${app.camera.position.y}, ${app.camera.position.z}`);

// Test Timeline
console.log(`Initial Time: ${app.timeline.time}`);
app.timeline.update(1000); // Simulate 1 second passing (1000ms)
console.log(`Time after 1s (simulated): ${app.timeline.time}`);

app.timeline.setSpeed(2.0);
app.timeline.update(2000); // Simulate another 1 second (timestamp 2000)
// Delta should be 1s * 2.0 speed = 2.0
// Total time should be ~1.0 + 2.0 = 3.0
console.log(`Time after another 1s at 2x speed: ${app.timeline.time}`);

console.log('Verification script completed without errors.');
