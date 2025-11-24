import { App } from '@/app/App';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Toggle } from '@/ui/inputs/Toggle';
import { Button } from '@/ui/inputs/Button';
import '@/ui/styles/index.css';
import * as THREE from 'three';

// Create app
const app = new App({
    debug: true,
    antialias: true,
    pathTracerDefaults: {
        bounces: 10,
        samples: 1
    }
});

// Create scene with various objects
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x4da6ff,
    metalness: 0.8,
    roughness: 0.2
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(-2, 1, 0);
sphere.castShadow = true;
sphere.receiveShadow = true;
app.scene.add(sphere);

// Metallic box
const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const boxMat = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    metalness: 0.9,
    roughness: 0.1
});
const box = new THREE.Mesh(boxGeo, boxMat);
box.position.set(2, 0.75, 0);
box.rotation.set(0.3, 0.5, 0);
box.castShadow = true;
box.receiveShadow = true;
app.scene.add(box);

// Glass-like torus
const torusGeo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
const torusMat = new THREE.MeshStandardMaterial({
    color: 0x88ff88,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.8
});
const torus = new THREE.Mesh(torusGeo, torusMat);
torus.position.set(0, 2, -1);
torus.castShadow = true;
torus.receiveShadow = true;
app.scene.add(torus);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.8
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
app.scene.add(plane);

// Lighting
app.lights.set('three-point');

// Add area light for path tracing (will look amazing in PT)
const rectLight = new THREE.RectAreaLight(0xffffff, 5, 4, 4);
rectLight.position.set(0, 5, 3);
rectLight.lookAt(0, 0, 0);
app.scene.add(rectLight);

// Set gradient background (compatible with both WebGL and PT)
app.backgrounds.setGradient('#87CEEB', '#E0F6FF'); // Sky blue gradient

// Position camera
app.camera.position.set(5, 4, 8);
app.camera.lookAt(0, 1, 0);

// Create UI
const panel = new Panel('Rendering');
const renderFolder = new Folder('Render Mode');

// Path tracing toggle
renderFolder.add(new Toggle(false, {
    label: 'Path Tracing',
    onChange: (enabled) => {
        if (enabled) {
            app.enablePathTracing();
            console.log('🎨 Path tracing enabled');
        } else {
            app.disablePathTracing();
            console.log('⚡ WebGL rendering enabled');
        }
    }
}));

// Reset accumulation button
renderFolder.add(new Button('Reset Accumulation', () => {
    app.renderManager.resetAccumulation();
    console.log('🔄 Path tracer reset');
}));

panel.add(renderFolder);

// Info folder
const infoFolder = new Folder('Instructions');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 12px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>WebGL Mode:</strong><br/>
  • Fast, real-time<br/>
  • Standard shading<br/><br/>
  <strong>Path Tracing Mode:</strong><br/>
  • Photorealistic<br/>
  • Accurate reflections<br/>
  • Samples accumulate<br/>
  • Reset on camera move
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start
app.start();

console.log('💡 Toggle "Path Tracing" to see the difference!');
console.log('💡 Path tracing will accumulate samples over time');
console.log('💡 Try adjusting bounces to see quality changes');
