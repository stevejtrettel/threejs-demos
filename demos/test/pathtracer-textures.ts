import { App } from '../../src/app/App';
import { Panel } from '../../src/ui/containers/Panel';
import { Folder } from '../../src/ui/containers/Folder';
import { Toggle } from '../../src/ui/inputs/Toggle';
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

// Set simple gradient background
app.backgrounds.setGradient('#1a1a2e', '#16213e');

// Add some lighting
app.lights.set('three-point');

// Create spheres that will receive textures
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);

// Left sphere - will load a diffuse texture
const leftMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.0
});
const leftSphere = new THREE.Mesh(sphereGeo, leftMat);
leftSphere.position.set(-2.5, 1, 0);
app.scene.add(leftSphere);

// Center sphere - will load a normal map
const centerMat = new THREE.MeshStandardMaterial({
    color: 0x4477aa,
    roughness: 0.5,
    metalness: 0.3
});
const centerSphere = new THREE.Mesh(sphereGeo, centerMat);
centerSphere.position.set(0, 1, 0);
app.scene.add(centerSphere);

// Right sphere - will load both diffuse and roughness maps
const rightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.0
});
const rightSphere = new THREE.Mesh(sphereGeo, rightMat);
rightSphere.position.set(2.5, 1, 0);
app.scene.add(rightSphere);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
app.scene.add(plane);

// Position camera
app.camera.position.set(0, 3, 8);
app.camera.lookAt(0, 1, 0);

// Load textures asynchronously
async function loadTextures() {
    console.log('📦 Loading textures...');

    try {
        // Example: Load diffuse texture for left sphere
        // In a real app, you'd use actual texture files
        // const diffuseTexture = await app.assets.loadTexture('/assets/textures/wood.jpg');
        // if (diffuseTexture) {
        //     leftMat.map = diffuseTexture;
        //     leftMat.needsUpdate = true;
        // }

        // Example: Load normal map for center sphere
        // const normalMap = await app.assets.loadTexture('/assets/textures/rock-normal.jpg');
        // if (normalMap) {
        //     centerMat.normalMap = normalMap;
        //     centerMat.needsUpdate = true;
        // }

        // Example: Load multiple maps for right sphere
        // const [diffuse, roughness] = await Promise.all([
        //     app.assets.loadTexture('/assets/textures/metal-diffuse.jpg'),
        //     app.assets.loadTexture('/assets/textures/metal-roughness.jpg')
        // ]);
        // if (diffuse) {
        //     rightMat.map = diffuse;
        //     rightMat.needsUpdate = true;
        // }
        // if (roughness) {
        //     rightMat.roughnessMap = roughness;
        //     rightMat.needsUpdate = true;
        // }

        // IMPORTANT: After loading textures, notify the pathtracer!
        app.notifyMaterialsChanged();
        console.log('✅ Textures loaded and pathtracer notified');
    } catch (error) {
        console.error('❌ Error loading textures:', error);
    }
}

// Load textures when demo starts
loadTextures();

// Create UI
const panel = new Panel('Path Tracer Textures');
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

panel.add(renderFolder);

// Info folder
const infoFolder = new Folder('About Texture Loading');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 11px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>Pattern:</strong><br/>
  1. Load textures async<br/>
  2. Assign to materials<br/>
  3. Set material.needsUpdate<br/>
  4. Call app.notifyMaterialsChanged()<br/><br/>

  <strong>Auto-sync:</strong><br/>
  • Environment changes: automatic<br/>
  • Material changes: call notify
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start
app.start();

console.log('💡 Path Tracer Texture Demo');
console.log('💡 Shows how to load textures and sync with pathtracer');
console.log('💡 Environment changes are automatic!');
console.log('💡 Material changes need app.notifyMaterialsChanged()');
