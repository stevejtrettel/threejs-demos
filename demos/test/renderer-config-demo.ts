import * as THREE from 'three';
import { App, CoordinateAxes, Grid } from '@core';

// Demo 1: Default configuration (ACES tone mapping, no shadows)
console.log('=== Renderer Configuration Demo ===');
console.log('');
console.log('Testing different renderer configurations...');

const app = new App({
  // Camera
  fov: 60,

  // Renderer options
  antialias: true,
  powerPreference: 'high-performance',

  // Shadows (try changing these!)
  shadows: {
    type: 'pcfsoft',
    mapSize: 2048
  },

  // Tone mapping
  toneMapping: 'aces',
  toneMappingExposure: 1.2,

  // Color space
  colorSpace: 'srgb',

  // Physically correct lights
  physicallyCorrectLights: true
});

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit({ enableDamping: true });

// Add helpers
const axes = new CoordinateAxes({ size: 5 });
app.add(axes);

const grid = new Grid({ size: 10, divisions: 20, plane: 'xz' });
app.add(grid);

// Create objects that cast and receive shadows
const groundGeometry = new THREE.PlaneGeometry(10, 10);
const groundMaterial = app.materials.matte(0x444444);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
app.scene.add(ground);

// Create spheres with different materials that cast shadows
const materials = [
  { mat: app.materials.plastic(0xff3333), name: 'Plastic' },
  { mat: app.materials.metal(0x33ff33), name: 'Metal' },
  { mat: app.materials.glass(0x3333ff, 0.6), name: 'Glass' }
];

materials.forEach((item, i) => {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const mesh = new THREE.Mesh(geometry, item.mat);

  mesh.position.set((i - 1) * 2.5, 0.5, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  app.scene.add(mesh);
});

// Add a bright light that casts shadows
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 5, 5);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 50;
light.shadow.camera.left = -10;
light.shadow.camera.right = 10;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;
app.scene.add(light);

app.start();

// Expose to console
(window as any).app = app;

console.log('');
console.log('✨ Renderer Configuration Active:');
console.log('  • Shadows: Enabled (PCFSoft, 2048x2048)');
console.log('  • Tone Mapping: ACES Filmic (exposure 1.2)');
console.log('  • Color Space: sRGB');
console.log('  • Physically Correct Lights: Enabled');
console.log('');
console.log('Try changing configuration in code:');
console.log('  shadows: false');
console.log('  toneMapping: "linear"');
console.log('  toneMappingExposure: 0.8');
console.log('');
console.log('Inspect renderer:');
console.log('  app.renderer.shadowMap');
console.log('  app.renderer.toneMapping');
console.log('  app.renderer.toneMappingExposure');
