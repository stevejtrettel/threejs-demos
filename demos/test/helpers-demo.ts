import * as THREE from 'three';
import { App, CoordinateAxes, Grid, Materials } from '@core';

const app = new App();

app.backgrounds.setColor(0x0a0a1a);
app.lights.set('three-point');
app.controls.setOrbit({ enableDamping: true });

// Add coordinate axes
const axes = new CoordinateAxes({
  size: 5,
  showNegative: true
});
app.add(axes);

// Add grid on XZ plane (floor)
const grid = new Grid({
  size: 10,
  divisions: 20,
  plane: 'xz',
  colorCenterLine: 0x666666,
  colorGrid: 0x333333
});
app.add(grid);

// Test Materials with different presets
const materials = [
  { mat: Materials.plastic(0xff0000), name: 'Plastic' },
  { mat: Materials.metal(0x00ff00), name: 'Metal' },
  { mat: Materials.glass(0x0088ff, 0.6), name: 'Glass' },
  { mat: Materials.matte(0xffff00), name: 'Matte' },
  { mat: Materials.glossy(0xff00ff), name: 'Glossy' }
];

// Create spheres with different materials
materials.forEach((item, i) => {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const mesh = new THREE.Mesh(geometry, item.mat);

  // Position in a line
  mesh.position.set((i - 2) * 2, 1, 0);

  app.scene.add(mesh);

  // Add parameters for the material
  app.params.add(item.mat, 'roughness', {
    min: 0,
    max: 1,
    label: `${item.name} Roughness`,
    folder: 'Materials'
  });

  app.params.add(item.mat, 'metalness', {
    min: 0,
    max: 1,
    label: `${item.name} Metalness`,
    folder: 'Materials'
  });
});

app.start();

// Expose to console
(window as any).app = app;
(window as any).axes = axes;
(window as any).grid = grid;

console.log('✨ Helpers & Materials Demo');
console.log('');
console.log('Scene contains:');
console.log('  - CoordinateAxes (with arrowheads)');
console.log('  - Grid (XZ floor plane)');
console.log('  - 5 spheres with different materials:');
console.log('    • Plastic (red)');
console.log('    • Metal (green)');
console.log('    • Glass (blue, transparent)');
console.log('    • Matte (yellow)');
console.log('    • Glossy (magenta)');
console.log('');
console.log('Try:');
console.log('  grid.setOpacity(0.3)');
