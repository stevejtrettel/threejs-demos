import { App } from '../../../src/app/App';
import { Panel } from '../../../src/ui/containers/Panel';
import { Folder } from '../../../src/ui/containers/Folder';
import { Toggle } from '../../../src/ui/inputs/Toggle';
import { Button } from '../../../src/ui/inputs/Button';
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

// Create test scene with reflective materials
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05
});
const chromeSphere = new THREE.Mesh(sphereGeo, chromeMat);
chromeSphere.position.set(0, 1, 0);
app.scene.add(chromeSphere);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.0
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
app.scene.add(plane);

// Position camera
app.camera.position.set(4, 2, 6);
app.camera.lookAt(0, 1, 0);

// Background type management
let currentBackgroundType: string = 'none';
let isPathTracingEnabled = false;

function setBackground(type: string) {
    currentBackgroundType = type;

    switch (type) {
        case 'hdri':
            console.log('📸 Loading HDRI background...');
            app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
                asEnvironment: true,
                asBackground: true,
                intensity: 1.0
            });
            break;

        case 'procedural-scene':
            console.log('🎨 Creating procedural scene background...');
            // Create a simple room environment
            const envScene = new THREE.Scene();

            // Room (inverted box)
            const roomGeo = new THREE.BoxGeometry(10, 10, 10);
            const roomMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                side: THREE.BackSide,
                emissive: 0x222222,
                emissiveIntensity: 0.5
            });
            const room = new THREE.Mesh(roomGeo, roomMat);
            envScene.add(room);

            // Colored walls for variety
            const wall1 = new THREE.Mesh(
                new THREE.PlaneGeometry(10, 10),
                new THREE.MeshStandardMaterial({
                    color: 0xff6644,
                    side: THREE.DoubleSide,
                    emissive: 0xff6644,
                    emissiveIntensity: 0.3
                })
            );
            wall1.position.set(0, 0, -5);
            envScene.add(wall1);

            // Point light
            const light = new THREE.PointLight(0xffffff, 100);
            light.position.set(0, 4, 0);
            envScene.add(light);

            // Render to environment maps (creates both PMREM and equirect!)
            app.backgrounds.createEnvironmentFromScene(envScene, {
                resolution: 512,
                asEnvironment: true,
                asBackground: true,
                intensity: 1.0
            });
            break;

        case 'gradient-sky':
            console.log('🌅 Creating gradient sky background...');
            // This now renders to environment maps instead of mesh!
            app.backgrounds.setSky({
                topColor: 0x0077ff,
                bottomColor: 0xffeedd,
                offset: 33,
                exponent: 0.6
            });
            break;

        case 'atmospheric-sky':
            console.log('☀️ Creating atmospheric sky background...');
            // This now renders to environment maps with HDR sun!
            app.backgrounds.setAtmosphericSky({
                turbidity: 10,
                rayleigh: 3,
                elevation: 15,  // Sun height in degrees
                azimuth: 180,
                exposure: 0.5
            });
            break;

        case 'none':
            console.log('🚫 Removing background...');
            app.scene.background = null;
            app.scene.environment = null;
            break;
    }

    // If pathtracing is active, swap to correct texture format
    if (isPathTracingEnabled && type !== 'none') {
        // Small delay to let HDRI load
        setTimeout(() => {
            const equirect = app.backgrounds.getEquirectEnvironment();
            if (equirect) {
                app.scene.environment = equirect;
                app.scene.background = equirect;
                app.renderManager.resetAccumulation();
            }
        }, 100);
    }
}

// Create UI
const panel = new Panel('Path Tracer Backgrounds Test');

// Render mode folder
const renderFolder = new Folder('Render Mode');
renderFolder.add(new Toggle(false, {
    label: 'Path Tracing',
    onChange: (enabled) => {
        isPathTracingEnabled = enabled;
        if (enabled) {
            app.enablePathTracing();
            console.log('🎨 Path tracing enabled');
            console.log('   All background types now use equirectangular format');
            console.log('   Environment auto-synced! ✨');
        } else {
            app.disablePathTracing();
            console.log('⚡ WebGL rendering enabled');
            console.log('   All background types now use PMREM format');
        }
    }
}));

renderFolder.add(new Button('Reset Accumulation', () => {
    app.renderManager.resetAccumulation();
    console.log('🔄 Path tracer reset');
}));

panel.add(renderFolder);

// Background type folder
const backgroundFolder = new Folder('Background Type');

backgroundFolder.add(new Button('None', () => setBackground('none')));
backgroundFolder.add(new Button('HDRI (studio.hdr)', () => setBackground('hdri')));
backgroundFolder.add(new Button('Procedural Scene (room)', () => setBackground('procedural-scene')));
backgroundFolder.add(new Button('Gradient Sky (shader)', () => setBackground('gradient-sky')));
backgroundFolder.add(new Button('Atmospheric Sky', () => setBackground('atmospheric-sky')));

panel.add(backgroundFolder);

// Info folder
const infoFolder = new Folder('Test Information');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 11px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>This demo tests all background types with pathtracer:</strong><br/><br/>

  <strong>✅ HDRI:</strong> Loaded equirect image<br/>
  <strong>✅ Procedural Scene:</strong> Cubemap → Equirect conversion<br/>
  <strong>✅ Gradient Sky:</strong> Shader → Environment maps<br/>
  <strong>✅ Atmospheric Sky:</strong> Physical sky → Environment maps (HDR!)<br/><br/>

  All backgrounds now provide:<br/>
  • WebGL: PMREM for IBL<br/>
  • Pathtracer: Equirect for sampling<br/><br/>

  <strong>Key improvements:</strong><br/>
  • HDR preservation throughout<br/>
  • Dual-format storage<br/>
  • Automatic texture swapping<br/>
  • No manual sync needed!
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start with gradient sky
setBackground('gradient-sky');

// Start rendering
app.start();

console.log('🎨 Path Tracer Background Test Demo');
console.log('');
console.log('✅ All background types now work with pathtracer!');
console.log('');
console.log('Test each background type:');
console.log('  1. Select background type');
console.log('  2. Toggle path tracing on/off');
console.log('  3. Watch chrome sphere reflect the environment');
console.log('');
console.log('Notice: Equirect conversion happens automatically!');
