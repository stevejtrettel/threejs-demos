import { App } from '@/app/App';
import { Window } from '@/ui/containers/Window';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import '@/ui/styles/index.css';
import * as THREE from 'three';

// Simple scene
const app = new App({ debug: true, antialias: true });

// Add a simple sphere
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshStandardMaterial({ color: 0x4da6ff });
const sphere = new THREE.Mesh(geometry, material);
app.scene.add(sphere);

// Add lights
app.lights.set('three-point');

// Position camera
app.camera.position.set(0, 2, 5);
app.camera.lookAt(0, 0, 0);

// Create a floating window for screenshot configuration
const screenshotWindow = new Window('Screenshot Settings', {
    width: 320,
    height: 220,
    x: 100,
    y: 100
});

const resolutionOptions = { width: 1920, height: 1080 };

screenshotWindow.add(new Slider(resolutionOptions.width, {
    min: 640,
    max: 3840,
    step: 1,
    label: 'Width',
    onChange: (v) => {
        resolutionOptions.width = v;
        console.log(`Resolution: ${resolutionOptions.width}x${resolutionOptions.height}`);
    }
}));

screenshotWindow.add(new Slider(resolutionOptions.height, {
    min: 480,
    max: 2160,
    step: 1,
    label: 'Height',
    onChange: (v) => {
        resolutionOptions.height = v;
        console.log(`Resolution: ${resolutionOptions.width}x${resolutionOptions.height}`);
    }
}));

screenshotWindow.add(new Button('Take Screenshot', () => {
    app.screenshots.captureHighRes(
        resolutionOptions.width,
        resolutionOptions.height,
        `screenshot_${resolutionOptions.width}x${resolutionOptions.height}.png`
    );
    console.log(`📸 Screenshot captured at ${resolutionOptions.width}x${resolutionOptions.height}`);
}));

screenshotWindow.add(new Button('Close Window', () => {
    screenshotWindow.close();
}));

// Open the floating window
screenshotWindow.open();

// Start
app.start();

console.log('💡 Drag the window title bar to move it around!');
console.log('💡 Adjust resolution and click "Take Screenshot"');
