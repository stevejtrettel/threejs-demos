import { App } from '@/app/App';
import { Modal } from '@/ui/containers/Modal';
import { Folder } from '@/ui/containers/Folder';
import { Button } from '@/ui/inputs/Button';
import { Slider } from '@/ui/inputs/Slider';
import { Toggle } from '@/ui/inputs/Toggle';
import { TextInput } from '@/ui/inputs/TextInput';
import '@/ui/styles/index.css';
import * as THREE from 'three';

// Simple scene
const app = new App({ debug: true, antialias: true });

// Add a rotating torus
const geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
const torus = new THREE.Mesh(geometry, material);
app.scene.add(torus);
app.addAnimateCallback((time, delta) => {
    torus.rotation.x += delta * 0.5;
    torus.rotation.y += delta * 0.3;
});

// Add lights
app.lights.set('three-point');

// Position camera
app.camera.position.set(0, 2, 5);
app.camera.lookAt(0, 0, 0);

// Create a modal overlay for export settings
const exportModal = new Modal('Export Dashboard', {
    width: 600,
    height: 450,
    closeOnBackdrop: true
});

// Create folders to organize settings
const videoFolder = new Folder('Video Settings');
const exportFolder = new Folder('Export Options');

const videoSettings = { duration: 3, fps: 30, quality: 80 };

videoFolder.add(new Slider(videoSettings.duration, {
    min: 1,
    max: 10,
    step: 1,
    label: 'Duration (s)',
    onChange: (v) => videoSettings.duration = v
}));

videoFolder.add(new Slider(videoSettings.fps, {
    min: 24,
    max: 60,
    step: 1,
    label: 'FPS',
    onChange: (v) => videoSettings.fps = v
}));

videoFolder.add(new Slider(videoSettings.quality, {
    min: 50,
    max: 100,
    step: 1,
    label: 'Quality',
    onChange: (v) => videoSettings.quality = v
}));

const exportOptions = {
    filename: 'animation',
    autoPlay: false,
    showWatermark: true
};

exportFolder.add(new TextInput(exportOptions.filename, {
    label: 'Filename',
    onChange: (v) => exportOptions.filename = v
}));

exportFolder.add(new Toggle(exportOptions.autoPlay, {
    label: 'Auto Play',
    onChange: (v) => exportOptions.autoPlay = v
}));

exportFolder.add(new Toggle(exportOptions.showWatermark, {
    label: 'Watermark',
    onChange: (v) => exportOptions.showWatermark = v
}));

exportModal.add(videoFolder);
exportModal.add(exportFolder);

// Action buttons
exportModal.add(new Button('Export Video', () => {
    console.log('🎬 Exporting video with settings:', {
        duration: videoSettings.duration,
        fps: videoSettings.fps,
        quality: videoSettings.quality,
        filename: exportOptions.filename,
        autoPlay: exportOptions.autoPlay,
        watermark: exportOptions.showWatermark
    });

    app.video.export({
        duration: videoSettings.duration,
        fps: videoSettings.fps,
        filename: exportOptions.filename,
        onProgress: (progress) => {
            console.log(`Export progress: ${Math.round(progress * 100)}%`);
        }
    });

    exportModal.close();
}));

exportModal.add(new Button('Cancel', () => {
    exportModal.close();
}));

// Open the modal after 1 second
setTimeout(() => {
    exportModal.open();
    console.log('💡 This is a Modal overlay - it blocks interaction with the scene');
    console.log('💡 Click the backdrop (dark area) or "Cancel" to close');
}, 1000);

// Start
app.start();
