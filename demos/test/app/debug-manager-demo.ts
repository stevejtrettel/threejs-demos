/**
 * DebugManager Demo
 *
 * Shows all debug features: stats panel, wireframe, grid, axes, profiling
 *
 * Keyboard shortcuts:
 * - D: Toggle debug stats panel (FPS, frame time, etc.)
 * - W: Toggle wireframe mode
 * - G: Toggle grid helper
 * - A: Toggle axes helper
 */

import { App } from '@/app/App';
import { ParametricSurface } from '@/math/orig/objects/ParametricSurface';
import * as THREE from 'three';

// Create app with debug enabled (default)
const app = new App({
  antialias: true,
  debug: true // This is the default - explicitly showing it here
});

// Set up camera
app.camera.position.set(5, 5, 8);
app.controls.target.set(0, 0, 0);

// Add lights
app.lights.set('three-point');

// Set background
app.backgrounds.setColor(0x2a2a2a);

console.log('=== DebugManager Demo ===');
console.log('\nKeyboard shortcuts:');
console.log('  D - Toggle debug stats (FPS, frame time)');
console.log('  W - Toggle wireframe mode');
console.log('  G - Toggle grid helper');
console.log('  A - Toggle axes helper');
console.log('  N - Toggle normals (coming soon)');
console.log('  B - Toggle bounding boxes (coming soon)');

// === Create some test objects ===

// 1. Parametric surface (torus)
const torus = new ParametricSurface(
  (u, v) => {
    const R = 2; // Major radius
    const r = 0.8; // Minor radius
    const x = (R + r * Math.cos(v)) * Math.cos(u);
    const y = (R + r * Math.cos(v)) * Math.sin(u);
    const z = r * Math.sin(v);
    return { x, y, z };
  },
  {
    uMin: 0,
    uMax: Math.PI * 2,
    vMin: 0,
    vMax: Math.PI * 2,
    uSegments: 40,
    vSegments: 20,
    color: 0xff6b35,
    material: new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      roughness: 0.3,
      metalness: 0.2,
      side: THREE.DoubleSide
    })
  }
);

app.add(torus);

// 2. A few spheres
for (let i = 0; i < 5; i++) {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
      roughness: 0.5,
      metalness: 0.5
    })
  );

  const angle = (i / 5) * Math.PI * 2;
  const radius = 4;
  sphere.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

  app.scene.add(sphere);
}

// 3. Animated cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    roughness: 0.4,
    metalness: 0.6
  })
);
cube.position.set(0, 2, 0);
app.scene.add(cube);

// Animate the cube
app.addAnimateCallback((time) => {
  cube.rotation.x = time * 0.001;
  cube.rotation.y = time * 0.0015;
});

// === Demonstrate profiling ===
console.log('\n=== Performance Profiling Demo ===');

// Profile a slow operation
app.debug.profile('Create 1000 vectors', () => {
  const vectors: THREE.Vector3[] = [];
  for (let i = 0; i < 1000; i++) {
    vectors.push(new THREE.Vector3(Math.random(), Math.random(), Math.random()));
  }
});

// Profile using start/end
app.debug.startProfile('Matrix multiply');
const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
for (let i = 0; i < 10000; i++) {
  m1.multiply(m2);
}
app.debug.endProfile('Matrix multiply');

// === Scene inspection ===
console.log('\n=== Scene Inspection ===');
app.debug.printSceneGraph();

console.log('\n=== Memory Usage ===');
app.debug.logMemoryUsage();

// === Programmatic stats access ===
setTimeout(() => {
  console.log('\n=== Stats after 3 seconds ===');
  const stats = app.debug.getStats();
  console.log(`  Current FPS: ${stats.fps.toFixed(1)}`);
  console.log(`  Frame time: ${stats.frameTime.toFixed(2)}ms`);
  console.log(`  Min FPS: ${stats.minFps.toFixed(1)}`);
  console.log(`  Max FPS: ${stats.maxFps.toFixed(1)}`);
  console.log(`  Avg FPS: ${stats.avgFps.toFixed(1)}`);
}, 3000);

// Start animation loop
app.start();

// Add instructions to page (using createElement to avoid destroying the canvas)
const instructions = document.createElement('div');
instructions.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 20px;
  font-family: monospace;
  font-size: 14px;
  border-radius: 4px;
  max-width: 320px;
  line-height: 1.6;
`;

instructions.innerHTML = `
  <h3 style="margin-top: 0; color: #8bb4e8;">DebugManager Demo</h3>

  <div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 3px;">
    <div style="color: #8bb4e8; margin-bottom: 5px;">Keyboard Shortcuts:</div>
    <div style="font-size: 13px;">
      <div><strong>D</strong> - Toggle stats panel</div>
      <div><strong>W</strong> - Toggle wireframe</div>
      <div><strong>G</strong> - Toggle grid</div>
      <div><strong>A</strong> - Toggle axes</div>
    </div>
  </div>

  <div style="font-size: 12px; color: #aaa; margin-top: 15px;">
    <div>✓ Stats panel (top-left)</div>
    <div>✓ Profiling in console</div>
    <div>✓ Scene graph inspection</div>
    <div>✓ Memory usage logging</div>
  </div>

  <div style="margin-top: 15px; padding: 8px; background: rgba(139, 180, 232, 0.2); border-left: 3px solid #8bb4e8; font-size: 12px;">
    <strong>Try this:</strong> Press D to see stats, then W to see wireframe!
  </div>
`;

document.body.appendChild(instructions);
