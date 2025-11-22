import { App, LevelCurve, LevelCurves, CoordinateAxes, Grid } from '@core';

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

// ===== Example 1: Single Circle =====
// x² + y² = 1
const circle = new LevelCurve(
  (x, y) => x * x + y * y,
  {
    level: 1,
    resolution: 80,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    color: 0xff0000,
    linewidth: 3
  }
);
circle.mesh.position.set(-6, 0, 0);
app.add(circle, {
  params: {
    level: { min: 0.1, max: 4, step: 0.1 }
  }
});

// ===== Example 2: Paraboloid Contours =====
// f(x,y) = x² + y²
const paraboloid = new LevelCurves(
  (x, y) => x * x + y * y,
  {
    numLevels: 8,
    minLevel: 0.25,
    maxLevel: 4,
    resolution: 80,
    bounds: { xMin: -2.5, xMax: 2.5, yMin: -2.5, yMax: 2.5 },
    zPosition: 0,
    linewidth: 2
  }
);
paraboloid.mesh.position.set(0, 0, 0);
app.add(paraboloid);

// ===== Example 3: Saddle Point =====
// f(x,y) = x² - y²
const saddle = new LevelCurves(
  (x, y) => x * x - y * y,
  {
    levels: [-2, -1, -0.5, 0, 0.5, 1, 2],
    resolution: 80,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    colormap: (level) => {
      if (level === 0) return 0xffffff; // White for zero level
      if (level > 0) return 0xff3333;   // Red for positive
      return 0x3333ff;                  // Blue for negative
    },
    linewidth: 2
  }
);
saddle.mesh.position.set(6, 0, 0);
app.add(saddle);

// ===== Example 4: Interesting Function =====
// f(x,y) = sin(x) + cos(y)
const waves = new LevelCurves(
  (x, y) => Math.sin(x * 2) + Math.cos(y * 2),
  {
    numLevels: 12,
    minLevel: -1.8,
    maxLevel: 1.8,
    resolution: 100,
    bounds: { xMin: -Math.PI, xMax: Math.PI, yMin: -Math.PI, yMax: Math.PI },
    zPosition: 0,
    linewidth: 1.5
  }
);
waves.mesh.position.set(0, 0, -6);
app.add(waves);

app.start();

// Expose to console
(window as any).app = app;
(window as any).circle = circle;
(window as any).paraboloid = paraboloid;
(window as any).saddle = saddle;
(window as any).waves = waves;

console.log('✨ Level Curve Demo');
console.log('');
console.log('Level curves (contour lines) visualized using marching squares:');
console.log('');
console.log('Front-Left (Red Circle):');
console.log('  • Single level curve: x² + y² = 1');
console.log('  • Try: circle.level = 2');
console.log('');
console.log('Center (Blue to Red):');
console.log('  • Paraboloid: f(x,y) = x² + y²');
console.log('  • Concentric circles at different heights');
console.log('');
console.log('Front-Right (Red/Blue):');
console.log('  • Saddle point: f(x,y) = x² - y²');
console.log('  • Hyperbolic contours');
console.log('  • White line is f = 0');
console.log('');
console.log('Back (Multicolor):');
console.log('  • Wave function: f(x,y) = sin(2x) + cos(2y)');
console.log('  • Complex interference pattern');
console.log('');
console.log('Level curves are the 2D version of level surfaces!');
