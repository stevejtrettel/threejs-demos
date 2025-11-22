import * as THREE from 'three';
import { App, TubedLevelCurves, CoordinateAxes, Grid } from '@core';

const app = new App({
  fov: 60,
  toneMapping: 'aces'
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('three-point');
app.controls.setOrbit({
  enableDamping: true,
  autoRotate: false
});

// Add helpers
const axes = new CoordinateAxes({ size: 3 });
app.add(axes);

const grid = new Grid({
  size: 8,
  divisions: 16,
  plane: 'xz',
  colorGrid: 0x222222
});
app.add(grid);

// Performance monitoring
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;
let updateTime = 0;

// Single animated example: Traveling wave
let wavePhase = 0;

const wave = new TubedLevelCurves(
  (x, y) => Math.sin(x * 2 + wavePhase) * Math.cos(y * 2),
  {
    levels: [-0.8, -0.4, 0, 0.4, 0.8],
    resolution: 80,  // Reduced from 100
    bounds: { xMin: -Math.PI, xMax: Math.PI, yMin: -Math.PI, yMax: Math.PI },
    zPosition: 0,
    tubeRadius: 0.02,
    tubularSegments: 48,  // Reduced from 64
    radialSegments: 6,
    colormap: (level, index, total) => {
      const hue = (index / total) * 0.7;
      return new THREE.Color().setHSL(hue, 0.8, 0.5).getHex();
    }
  }
);
app.add(wave);

// Animation loop
app.addAnimateCallback((time) => {
  frameCount++;

  // Update FPS every second
  const now = performance.now();
  if (now - lastFrameTime > 1000) {
    fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    frameCount = 0;
    lastFrameTime = now;
  }

  const startUpdate = performance.now();

  // Update wave phase
  wavePhase = time * 0.002;
  wave.rebuild();

  updateTime = performance.now() - startUpdate;
});

// Display stats overlay
const stats = document.createElement('div');
stats.style.position = 'fixed';
stats.style.top = '10px';
stats.style.left = '10px';
stats.style.color = '#00ff00';
stats.style.fontFamily = 'monospace';
stats.style.fontSize = '14px';
stats.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
stats.style.padding = '10px';
stats.style.borderRadius = '5px';
stats.style.zIndex = '1000';
document.body.appendChild(stats);

setInterval(() => {
  stats.innerHTML = `
    <div><b>Single Animated Scene</b></div>
    <div>FPS: ${fps}</div>
    <div>Update Time: ${updateTime.toFixed(2)}ms</div>
    <div>Frame Budget: ${(1000 / 60).toFixed(2)}ms (60fps)</div>
    <div style="margin-top: 5px;">
      Resolution: 80 (6400 cells)
    </div>
    <div>Levels: 5</div>
    <div>Tube segments: 48</div>
    <div style="margin-top: 10px; color: ${updateTime < 16 ? '#00ff00' : updateTime < 33 ? '#ffaa00' : '#ff0000'}">
      ${updateTime < 16 ? '✓ 60fps capable' : updateTime < 33 ? '⚠ 30fps' : '✗ Below 30fps'}
    </div>
  `;
}, 100);

app.start();

// Expose to console
(window as any).app = app;
(window as any).wave = wave;

console.log('✨ Single Animated Tubed Level Curve');
console.log('');
console.log('Traveling wave: sin(2x + phase) × cos(2y)');
console.log('5 rainbow-colored level contours');
console.log('Resolution: 80 (6400 grid cells)');
console.log('');
console.log('Watch performance in top-left corner');
