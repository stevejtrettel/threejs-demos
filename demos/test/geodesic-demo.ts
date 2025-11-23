import * as THREE from 'three';
import {
  App,
  ParametricSurface,
  Geodesic,
  CoordinateAxes,
  Materials
} from '@';

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
  autoRotateSpeed: 0.3
});

// Add axes
const axes = new CoordinateAxes({ size: 4 });
app.add(axes);

// Create a sphere
const sphere = new ParametricSurface(
  (u, v) => {
    const r = 2;
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
    uSegments: 64,
    vSegments: 64,
    color: 0x1a3366,
    wireframe: false,
    material: Materials.plastic(0x2244aa, 0.3)  // Semi-transparent
  }
);
app.add(sphere);

// Create geodesics with different initial conditions
const geodesic1 = new Geodesic({
  surface: sphere,
  u0: Math.PI / 4,
  v0: 0,
  du0: 0.5,
  dv0: 1.0,
  steps: 1000,
  stepSize: 0.01,
  color: 0xff3333,
  useThickLine: true,
  thickness: 0.03
});
app.add(geodesic1);

const geodesic2 = new Geodesic({
  surface: sphere,
  u0: Math.PI / 2,
  v0: 0,
  du0: 0,
  dv0: 1.0,
  steps: 1000,
  stepSize: 0.01,
  color: 0x33ff33,
  useThickLine: true,
  thickness: 0.03
});
app.add(geodesic2);

const geodesic3 = new Geodesic({
  surface: sphere,
  u0: Math.PI / 6,
  v0: Math.PI / 4,
  du0: 1.0,
  dv0: 0.5,
  steps: 1000,
  stepSize: 0.01,
  color: 0xffff33,
  useThickLine: true,
  thickness: 0.03
});
app.add(geodesic3);

app.start();

// Expose to console
(window as any).app = app;
(window as any).sphere = sphere;
(window as any).geodesic1 = geodesic1;
(window as any).geodesic2 = geodesic2;
(window as any).geodesic3 = geodesic3;

console.log('✨ Geodesic Demo - Geodesics on a Sphere');
console.log('');
console.log('Surfaces:');
console.log('  • Blue sphere (radius = 2)');
console.log('');
console.log('Geodesics:');
console.log('  • Red - Oblique great circle');
console.log('  • Green - Equator (du0=0, pure v motion)');
console.log('  • Yellow - Another oblique path');
console.log('');
console.log('On a sphere, geodesics are great circles!');
console.log('');
console.log('Try in console:');
console.log('  // Change initial conditions');
console.log('  geodesic1.du0 = 1.0');
console.log('  geodesic1.dv0 = 0.5');
console.log('');
console.log('  // Change integration parameters');
console.log('  geodesic1.steps = 500');
console.log('  geodesic1.stepSize = 0.02');
console.log('');
console.log('  // Change appearance');
console.log('  geodesic1.colorHex = 0xff00ff');
console.log('  geodesic1.thickness = 0.05');
console.log('');
console.log('All parameters are reactive - geodesics automatically rebuild or update!');
