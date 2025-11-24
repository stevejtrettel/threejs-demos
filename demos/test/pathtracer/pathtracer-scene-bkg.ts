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

// ===================================
// CREATE PROCEDURAL SCENE BACKGROUND
// ===================================

// Create a custom environment scene (like a room or abstract geometry)
const envScene = new THREE.Scene();

// Create an inverted room
const roomGeo = new THREE.BoxGeometry(10, 10, 10);
const roomMat = new THREE.MeshStandardMaterial({
    color: 0x334455,
    side: THREE.BackSide,
    emissive: 0x112233,
    emissiveIntensity: 0.4  // Subtle ambient glow
});
const room = new THREE.Mesh(roomGeo, roomMat);
envScene.add(room);

// Add a colored accent wall
const accentWall = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
        color: 0xff6644,
        side: THREE.DoubleSide,
        emissive: 0xff4422,
        emissiveIntensity: 0.5  // Brighter for colored light
    })
);
accentWall.position.set(0, 0, -5);
envScene.add(accentWall);

// Add some geometric shapes for visual interest
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 32, 32),
    new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        emissive: 0x2266aa,
        emissiveIntensity: 0.6
    })
);
sphere.position.set(-3, 3, -3);
envScene.add(sphere);

// Add point lights for HDR highlights
const light1 = new THREE.PointLight(0xffffff, 150);
light1.position.set(0, 4, 0);
envScene.add(light1);

const light2 = new THREE.PointLight(0xff8844, 80);
light2.position.set(-4, 2, -4);
envScene.add(light2);

// Render the procedural scene to environment maps
// This creates BOTH PMREM (for WebGL) and equirect (for pathtracer)!
console.log('🎨 Rendering procedural scene to environment maps...');
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,  // Higher = better quality, but slower
    asEnvironment: true,
    asBackground: true,
    intensity: 1.0,
    includeLights: true  // ← Clone lights to main scene!
});
console.log('✅ Environment maps created (PMREM + equirect)');
console.log('✅ Lights cloned from environment to main scene');

// ===================================
// CREATE MAIN SCENE WITH REFLECTIVE OBJECTS
// ===================================

// Chrome sphere (will reflect the procedural environment!)
const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05
});
const chromeSphere = new THREE.Mesh(sphereGeo, chromeMat);
chromeSphere.position.set(-2, 1, 0);
app.scene.add(chromeSphere);

// Glossy metallic torus
const torusGeo = new THREE.TorusGeometry(0.8, 0.3, 16, 100);
const metalMat = new THREE.MeshStandardMaterial({
    color: 0xccaa88,
    metalness: 1.0,
    roughness: 0.2
});
const torus = new THREE.Mesh(torusGeo, metalMat);
torus.position.set(2, 1.2, 0);
torus.rotation.x = Math.PI / 4;
app.scene.add(torus);

// Ground plane
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.7,
    metalness: 0.0
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
app.scene.add(plane);

// Position camera
app.camera.position.set(4, 3, 6);
app.camera.lookAt(0, 1, 0);

// ===================================
// UI CONTROLS
// ===================================

const panel = new Panel('Procedural Scene Background');
const renderFolder = new Folder('Render Mode');

renderFolder.add(new Toggle(false, {
    label: 'Path Tracing',
    onChange: (enabled) => {
        if (enabled) {
            app.enablePathTracing();
            console.log('🎨 Path tracing enabled');
            console.log('   Using equirectangular environment (auto-converted from cubemap!)');
        } else {
            app.disablePathTracing();
            console.log('⚡ WebGL rendering enabled');
            console.log('   Using PMREM environment (pre-filtered cubemap)');
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
  <strong>Procedural Scene Background</strong><br/><br/>

  This demo creates a custom environment<br/>
  from procedural geometry (room + shapes).<br/><br/>

  <strong>How it works:</strong><br/>
  1. Create scene with geometry/lights<br/>
  2. Call createEnvironmentFromScene()<br/>
  3. Automatically generates:<br/>
     • Cubemap (rendered from scene)<br/>
     • PMREM (for WebGL IBL)<br/>
     • Equirect (for pathtracer)<br/><br/>

  <strong>Benefits:</strong><br/>
  • No HDRI files needed!<br/>
  • Full control over lighting<br/>
  • Procedural/animated possible<br/>
  • Works with pathtracer!<br/><br/>

  Toggle PT to see reflections!
`;
infoFolder.domElement.appendChild(info);
panel.add(infoFolder);

panel.mount(document.body);

// Start
app.start();

console.log('🏠 Procedural Scene Background Demo');
console.log('');
console.log('✅ Created custom environment from scene geometry');
console.log('✅ Automatically converted cubemap → equirect for pathtracer');
console.log('✅ Chrome sphere will reflect the procedural room!');
console.log('');
console.log('💡 This is your most common use case - no HDRI needed!');
