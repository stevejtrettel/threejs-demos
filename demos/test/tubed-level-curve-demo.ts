import * as THREE from 'three';
import { App, TubedLevelCurve, TubedLevelCurves, CoordinateAxes, Grid, Materials } from '@core';

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

// ===== Example 1: Single Tubed Circle =====
// x² + y² = 1
const circle = new TubedLevelCurve(
  (x, y) => x * x + y * y,
  {
    level: 1,
    resolution: 80,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    tubeRadius: 0.03,
    tubularSegments: 128,
    radialSegments: 8,
    material: Materials.plastic(0xff0000)
  }
);
circle.mesh.position.set(-6, 0, 0);
app.add(circle, {
  params: {
    level: { min: 0.1, max: 4, step: 0.1 }
  }
});

// ===== Example 2: Tubed Paraboloid Contours =====
// f(x,y) = x² + y²
const paraboloid = new TubedLevelCurves(
  (x, y) => x * x + y * y,
  {
    numLevels: 8,
    minLevel: 0.25,
    maxLevel: 4,
    resolution: 100,
    bounds: { xMin: -2.5, xMax: 2.5, yMin: -2.5, yMax: 2.5 },
    zPosition: 0,
    tubeRadius: 0.025,
    tubularSegments: 64,
    radialSegments: 6
  }
);
paraboloid.mesh.position.set(0, 0, 0);
app.add(paraboloid);

// ===== Example 3: Saddle Point with Tubes =====
// f(x,y) = x² - y²
const saddle = new TubedLevelCurves(
  (x, y) => x * x - y * y,
  {
    levels: [-2, -1, -0.5, 0, 0.5, 1, 2],
    resolution: 100,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    tubeRadius: 0.025,
    tubularSegments: 64,
    radialSegments: 6,
    colormap: (level) => {
      if (level === 0) return 0xffffff; // White for zero level
      if (level > 0) return 0xff3333;   // Red for positive
      return 0x3333ff;                  // Blue for negative
    }
  }
);
saddle.mesh.position.set(6, 0, 0);
app.add(saddle);

// ===== Example 4: Complex Pattern =====
// f(x,y) = sin(x²+y²)
const ripples = new TubedLevelCurves(
  (x, y) => Math.sin((x * x + y * y) * 2),
  {
    numLevels: 7,
    minLevel: -0.9,
    maxLevel: 0.9,
    resolution: 120,
    bounds: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    zPosition: 0,
    tubeRadius: 0.02,
    tubularSegments: 64,
    radialSegments: 6,
    colormap: (level, index, total) => {
      const hue = (index / total) * 0.8;
      return new THREE.Color().setHSL(hue, 0.8, 0.5).getHex();
    }
  }
);
ripples.mesh.position.set(0, 0, -6);
app.add(ripples);

app.start();

// Expose to console
(window as any).app = app;
(window as any).circle = circle;
(window as any).paraboloid = paraboloid;
(window as any).saddle = saddle;
(window as any).ripples = ripples;

console.log('✨ Tubed Level Curve Demo');
console.log('');
console.log('Level curves as 3D tubes with lighting and shadows:');
console.log('');
console.log('Front-Left (Red Circle):');
console.log('  • Single tubed level curve: x² + y² = 1');
console.log('  • Try: circle.level = 2');
console.log('');
console.log('Center (Blue to Red):');
console.log('  • Paraboloid: f(x,y) = x² + y²');
console.log('  • Concentric circles as tubes');
console.log('  • Beautiful depth perception!');
console.log('');
console.log('Front-Right (Red/Blue):');
console.log('  • Saddle point: f(x,y) = x² - y²');
console.log('  • Hyperbolic contours as tubes');
console.log('  • White tube is f = 0');
console.log('');
console.log('Back (Rainbow):');
console.log('  • Ripple pattern: f(x,y) = sin(2(x²+y²))');
console.log('  • Concentric wave contours');
console.log('');
console.log('Tubes have actual geometry - rotate to see depth!');
