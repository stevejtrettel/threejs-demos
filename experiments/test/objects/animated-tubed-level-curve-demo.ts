import * as THREE from 'three';
import { App, TubedLevelCurves, CoordinateAxes, Grid, Materials, Lights } from '@';

const app = new App({
  fov: 60,
  toneMapping: 'aces'
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.scene.add(Lights.threePoint());
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

// ===== Animated Example 1: Breathing Circle =====
// Radius oscillates with time
let breathingTime = 0;
const breathingRadius = () => 1 + 0.5 * Math.sin(breathingTime);

const breathing = new TubedLevelCurves(
  (x, y) => x * x + y * y,
  {
    levels: [breathingRadius(), breathingRadius() * 1.5, breathingRadius() * 2],
    resolution: 60,
    bounds: { xMin: -2.5, xMax: 2.5, yMin: -2.5, yMax: 2.5 },
    zPosition: 0,
    tubeRadius: 0.025,
    tubularSegments: 64,
    radialSegments: 6,
    colormap: (level, index) => {
      const colors = [0xff3333, 0x33ff33, 0x3333ff];
      return colors[index] || 0xffffff;
    }
  }
);
breathing.mesh.position.set(-6, 0, 0);
app.add(breathing);

// ===== Animated Example 2: Rotating Saddle =====
// Saddle rotates over time
let saddleAngle = 0;

const saddle = new TubedLevelCurves(
  (x, y) => {
    const cos = Math.cos(saddleAngle);
    const sin = Math.sin(saddleAngle);
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    return xr * xr - yr * yr;
  },
  {
    levels: [-1.5, -0.75, 0, 0.75, 1.5],
    resolution: 80,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    tubeRadius: 0.02,
    tubularSegments: 64,
    radialSegments: 6,
    colormap: (level) => {
      if (level === 0) return 0xffffff;
      if (level > 0) return 0xff5555;
      return 0x5555ff;
    }
  }
);
saddle.mesh.position.set(0, 0, 0);
app.add(saddle);

// ===== Animated Example 3: Traveling Wave =====
// Wave propagates through space
let wavePhase = 0;

const wave = new TubedLevelCurves(
  (x, y) => Math.sin(x * 2 + wavePhase) * Math.cos(y * 2),
  {
    levels: [-0.8, -0.4, 0, 0.4, 0.8],
    resolution: 100,
    bounds: { xMin: -Math.PI, xMax: Math.PI, yMin: -Math.PI, yMax: Math.PI },
    zPosition: 0,
    tubeRadius: 0.02,
    tubularSegments: 64,
    radialSegments: 6,
    colormap: (level, index, total) => {
      const hue = (index / total) * 0.7;
      return new THREE.Color().setHSL(hue, 0.8, 0.5).getHex();
    }
  }
);
wave.mesh.position.set(6, 0, 0);
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

  // Update animated parameters
  breathingTime = time * 0.001;
  saddleAngle = time * 0.0003;
  wavePhase = time * 0.002;

  // Update breathing circles
  const r = breathingRadius();
  (breathing as any).options.levels = [r * r, r * r * 2.25, r * r * 4];
  breathing.rebuild();

  // Update rotating saddle
  saddle.rebuild();

  // Update traveling wave
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
    <div>FPS: ${fps}</div>
    <div>Update Time: ${updateTime.toFixed(2)}ms</div>
    <div>Frame Budget: ${(1000 / 60).toFixed(2)}ms (60fps)</div>
    <div style="margin-top: 10px; color: ${updateTime < 16 ? '#00ff00' : '#ff0000'}">
      ${updateTime < 16 ? '✓ Real-time capable' : '✗ Below 60fps'}
    </div>
  `;
}, 100);

app.start();

// Expose to console
(window as any).app = app;
(window as any).breathing = breathing;
(window as any).saddle = saddle;
(window as any).wave = wave;

console.log('✨ Animated Tubed Level Curve Performance Test');
console.log('');
console.log('Three animated examples:');
console.log('');
console.log('Left (Breathing Circles):');
console.log('  • Circles expand/contract with time');
console.log('  • Tests dynamic level changes');
console.log('');
console.log('Center (Rotating Saddle):');
console.log('  • Saddle rotates continuously');
console.log('  • Tests function transformation');
console.log('');
console.log('Right (Traveling Wave):');
console.log('  • Wave propagates through space');
console.log('  • Tests complex topology changes');
console.log('');
console.log('Watch FPS and update time in top-left!');
console.log('Good performance: <16ms update time (60fps capable)');
