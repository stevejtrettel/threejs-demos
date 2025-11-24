import { App } from '../../src/app/App';
import { Panel } from '../../src/ui/containers/Panel';
import { Folder } from '../../src/ui/containers/Folder';
import { Toggle } from '../../src/ui/inputs/Toggle';
import { Button } from '../../src/ui/inputs/Button';
import '../../src/ui/styles/index.css';
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

// Load HDRI for environment lighting and background
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
    asEnvironment: true,  // Use for image-based lighting
    asBackground: true,   // Use as background
    intensity: 1.0
}, () => {
    // Update pathtracer after HDRI loads (if already enabled)
    app.renderManager.updatePathTracer();
    console.log('✅ HDRI loaded and pathtracer updated');
});

// Create scene with various materials to showcase HDRI lighting

// Chrome sphere (perfect mirror)
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.0
});
const chromeSphere = new THREE.Mesh(sphereGeo, chromeMat);
chromeSphere.position.set(-3, 1, 0);
chromeSphere.castShadow = true;
chromeSphere.receiveShadow = true;
app.scene.add(chromeSphere);

// Brushed metal box
const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const metalMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 1.0,
    roughness: 0.3
});
const metalBox = new THREE.Mesh(boxGeo, metalMat);
metalBox.position.set(0, 0.75, 0);
metalBox.rotation.set(0.3, 0.5, 0);
metalBox.castShadow = true;
metalBox.receiveShadow = true;
app.scene.add(metalBox);

// Glossy red sphere
const glossyGeo = new THREE.SphereGeometry(0.8, 64, 64);
const glossyMat = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    metalness: 0.2,
    roughness: 0.1
});
const glossySphere = new THREE.Mesh(glossyGeo, glossyMat);
glossySphere.position.set(3, 0.8, 0);
glossySphere.castShadow = true;
glossySphere.receiveShadow = true;
app.scene.add(glossySphere);

// Glass torus
const torusGeo = new THREE.TorusGeometry(0.6, 0.25, 16, 100);
const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    transmission: 0.95,
    thickness: 0.5,
    ior: 1.5
});
const glassTorus = new THREE.Mesh(torusGeo, glassMat);
glassTorus.position.set(-1, 2, -1);
glassTorus.castShadow = true;
glassTorus.receiveShadow = true;
app.scene.add(glassTorus);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.5,
    metalness: 0.1
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
app.scene.add(plane);

// Position camera
app.camera.position.set(5, 3, 7);
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
            // Ensure environment is updated after enabling
            app.renderManager.updatePathTracer();
            console.log('🎨 Path tracing with HDRI enabled');
            console.log('   Chrome sphere will reflect the studio!');
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
const infoFolder = new Folder('Materials');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 11px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>Left:</strong> Chrome mirror<br/>
  <strong>Center:</strong> Brushed metal<br/>
  <strong>Right:</strong> Glossy red<br/>
  <strong>Top:</strong> Glass torus<br/><br/>
  HDRI provides realistic<br/>
  lighting and reflections
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start
app.start();

console.log('💡 HDRI Path Tracing Demo');
console.log('💡 Toggle PT to see photorealistic reflections');
console.log('💡 HDRI provides realistic environment lighting');
console.log('💡 Watch the chrome sphere - it reflects the entire studio!');
