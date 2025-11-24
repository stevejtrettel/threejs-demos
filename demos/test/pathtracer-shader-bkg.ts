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

// ===================================
// CREATE SCENE WITH REFLECTIVE OBJECTS
// ===================================

// Chrome sphere (will reflect the shader background!)
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.0  // Perfect mirror
});
const chromeSphere = new THREE.Mesh(sphereGeo, chromeMat);
chromeSphere.position.set(0, 1, 0);
app.scene.add(chromeSphere);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x606060,
    roughness: 0.8,
    metalness: 0.0
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
app.scene.add(plane);

// Position camera
app.camera.position.set(3, 2, 5);
app.camera.lookAt(0, 1, 0);

// ===================================
// SHADER BACKGROUND TYPES
// ===================================

function setGradientSky() {
    console.log('🌅 Creating gradient sky...');

    // This now renders the shader to environment maps!
    // Creates both PMREM (WebGL) and equirect (pathtracer)
    app.backgrounds.setSky({
        topColor: 0x0088ff,      // Sky blue
        bottomColor: 0xffeedd,   // Warm horizon
        offset: 33,
        exponent: 0.6
    });

    console.log('✅ Gradient sky rendered to environment maps');
}

function setAtmosphericSky() {
    console.log('☀️ Creating atmospheric sky...');

    // Physical sky shader with HDR sun!
    // Sun brightness can be > 1.0 for realistic lighting
    app.backgrounds.setAtmosphericSky({
        turbidity: 10,
        rayleigh: 3,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.7,
        elevation: 15,    // Sun angle (degrees)
        azimuth: 180,     // Sun direction (degrees)
        exposure: 0.5
    });

    console.log('✅ Atmospheric sky rendered to environment maps');
    console.log('   Sun provides HDR lighting (values > 1.0)');
}

function setSunsetSky() {
    console.log('🌇 Creating sunset sky...');

    app.backgrounds.setAtmosphericSky({
        turbidity: 10,
        rayleigh: 2,
        elevation: 2,     // Low sun angle
        azimuth: 90,
        exposure: 0.6
    });

    console.log('✅ Sunset sky rendered to environment maps');
}

function setNightSky() {
    console.log('🌃 Creating night sky...');

    app.backgrounds.setSky({
        topColor: 0x000820,      // Dark blue
        bottomColor: 0x1a1a3e,   // Dark horizon
        offset: 20,
        exponent: 1.2
    });

    console.log('✅ Night sky rendered to environment maps');
}

// Start with gradient sky
setGradientSky();

// ===================================
// UI CONTROLS
// ===================================

const panel = new Panel('Shader Backgrounds');

// Shader type buttons
const shaderFolder = new Folder('Sky Type');

shaderFolder.add(new Button('Gradient Sky', () => {
    setGradientSky();
    if (app.renderManager.isPathTracing()) {
        app.renderManager.resetAccumulation();
    }
}));

shaderFolder.add(new Button('Atmospheric Sky (midday)', () => {
    setAtmosphericSky();
    if (app.renderManager.isPathTracing()) {
        app.renderManager.resetAccumulation();
    }
}));

shaderFolder.add(new Button('Sunset Sky', () => {
    setSunsetSky();
    if (app.renderManager.isPathTracing()) {
        app.renderManager.resetAccumulation();
    }
}));

shaderFolder.add(new Button('Night Sky', () => {
    setNightSky();
    if (app.renderManager.isPathTracing()) {
        app.renderManager.resetAccumulation();
    }
}));

panel.add(shaderFolder);

// Render mode
const renderFolder = new Folder('Render Mode');
renderFolder.add(new Toggle(false, {
    label: 'Path Tracing',
    onChange: (enabled) => {
        if (enabled) {
            app.enablePathTracing();
            console.log('🎨 Path tracing enabled');
            console.log('   Using equirectangular environment');
        } else {
            app.disablePathTracing();
            console.log('⚡ WebGL rendering enabled');
            console.log('   Using PMREM environment');
        }
    }
}));

renderFolder.add(new Button('Reset Accumulation', () => {
    app.renderManager.resetAccumulation();
    console.log('🔄 Path tracer reset');
}));

panel.add(renderFolder);

// Info
const infoFolder = new Folder('About This Demo');
const info = document.createElement('div');
info.style.cssText = 'padding: 8px; font-size: 11px; line-height: 1.6; color: var(--cr-text-secondary);';
info.innerHTML = `
  <strong>Shader-Based Backgrounds</strong><br/><br/>

  Demonstrates procedural sky shaders<br/>
  rendered to environment maps.<br/><br/>

  <strong>How it works:</strong><br/>
  1. Create shader (gradient or physical)<br/>
  2. Render to temporary scene<br/>
  3. Capture as cubemap<br/>
  4. Convert to environment maps:<br/>
     • PMREM for WebGL<br/>
     • Equirect for pathtracer<br/><br/>

  <strong>Shader types:</strong><br/>
  • <strong>Gradient:</strong> Simple color blend<br/>
  • <strong>Atmospheric:</strong> Physical scattering<br/>
    (HDR sun for realistic lighting!)<br/><br/>

  <strong>Benefits:</strong><br/>
  • No image files needed<br/>
  • Fully customizable<br/>
  • HDR lighting support<br/>
  • Works with pathtracer!<br/><br/>

  Watch the chrome sphere reflect<br/>
  the procedural sky!
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start
app.start();

console.log('🎨 Shader Background Demo');
console.log('');
console.log('✅ Shader backgrounds now render to environment maps');
console.log('✅ Provides proper IBL (not just visual background)');
console.log('✅ Works with pathtracer via equirect conversion');
console.log('');
console.log('💡 Try different shader types and toggle pathtracing!');
