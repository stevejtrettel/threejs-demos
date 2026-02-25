import * as THREE from 'three';
import { App, ParametricSurface, CoordinateAxes, Grid, Materials } from '@';

const app = new App({
  fov: 60,
  toneMapping: 'aces',
  shadows: false
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('three-point');
app.controls.setOrbit({
  enableDamping: true,
  autoRotate: true,
  autoRotateSpeed: 1
});

// Add helpers
const axes = new CoordinateAxes({ size: 3 });
app.add(axes);

const grid = new Grid({
  size: 6,
  divisions: 12,
  plane: 'xz',
  colorCenterLine: 0x444444,
  colorGrid: 0x222222
});
app.add(grid);

// 1. Torus
const torus = new ParametricSurface(
  (u, v) => {
    const R = 1.5;  // Major radius
    const r = 0.5;  // Minor radius
    return {
      x: (R + r * Math.cos(v)) * Math.cos(u),
      y: (R + r * Math.cos(v)) * Math.sin(u),
      z: r * Math.sin(v)
    };
  },
  {
    uMin: 0,
    uMax: 2 * Math.PI,
    vMin: 0,
    vMax: 2 * Math.PI,
    uSegments: 64,
    vSegments: 32,
    material: Materials.plastic(0xff3333)
  }
);
torus.mesh.position.set(-3, 1.5, 0);
app.add(torus);

// 2. Möbius Strip
const mobius = new ParametricSurface(
  (u, v) => {
    const width = 0.4;
    return {
      x: (1 + v * width * Math.cos(u / 2)) * Math.cos(u),
      y: (1 + v * width * Math.cos(u / 2)) * Math.sin(u),
      z: v * width * Math.sin(u / 2)
    };
  },
  {
    uMin: 0,
    uMax: 2 * Math.PI,
    vMin: -1,
    vMax: 1,
    uSegments: 64,
    vSegments: 16,
    material: Materials.glossy(0x33ff33)
  }
);
mobius.mesh.position.set(0, 1.5, 0);
app.add(mobius);

// 3. Sphere (parametric)
const sphere = new ParametricSurface(
  (u, v) => {
    const r = 1;
    return {
      x: r * Math.sin(u) * Math.cos(v),
      y: r * Math.sin(u) * Math.sin(v),
      z: r * Math.cos(u)
    };
  },
  {
    uMin: 0,
    uMax: Math.PI,
    vMin: 0,
    vMax: 2 * Math.PI,
    uSegments: 32,
    vSegments: 32,
    material: Materials.metal(0x3333ff)
  }
);
sphere.mesh.position.set(3, 1.5, 0);
app.add(sphere);

app.start();

// Expose to console
(window as any).app = app;
(window as any).torus = torus;
(window as any).mobius = mobius;
(window as any).sphere = sphere;

console.log('✨ Parametric Surface Demo');
console.log('');
console.log('Surfaces:');
console.log('  • Torus (red) - Classic donut shape');
console.log('  • Möbius Strip (green) - One-sided surface');
console.log('  • Sphere (blue) - Parametric sphere');
console.log('');
console.log('All surfaces have reactive parameters!');
console.log('');
console.log('Try in console:');
console.log('  torus.uSegments = 16    // Lower resolution');
console.log('  torus.uSegments = 128   // Higher resolution');
console.log('  mobius.vMax = 0.5       // Half-width strip');
console.log('  sphere.uMax = Math.PI/2 // Hemisphere');
console.log('');
console.log('Auto-rotate is enabled. Enjoy the view!');
