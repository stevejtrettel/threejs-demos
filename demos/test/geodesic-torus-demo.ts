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
  autoRotateSpeed: 0.5
});

// Add axes
const axes = new CoordinateAxes({ size: 5 });
app.add(axes);

// Torus parameters (we'll reference these in the surface)
let R = 2.0;  // Major radius
let r = 0.6;  // Minor radius

// Create a torus surface
const torus = new ParametricSurface(
  (u, v) => {
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
    uSegments: 128,
    vSegments: 64,
    color: 0x2244aa,
    wireframe: false,
    material: Materials.plastic(0x2244aa, 0.4)  // Semi-transparent
  }
);
app.add(torus);

// Create several geodesics
const geodesic1 = new Geodesic({
  surface: torus,
  u0: 0,
  v0: 0,
  du0: 1.0,
  dv0: 0.3,
  steps: 2000,
  stepSize: 0.005,
  color: 0xff3333,
  useThickLine: true,
  thickness: 0.04
});
app.add(geodesic1);

const geodesic2 = new Geodesic({
  surface: torus,
  u0: 0,
  v0: Math.PI,
  du0: 1.0,
  dv0: -0.2,
  steps: 2000,
  stepSize: 0.005,
  color: 0x33ff33,
  useThickLine: true,
  thickness: 0.04
});
app.add(geodesic2);

const geodesic3 = new Geodesic({
  surface: torus,
  u0: Math.PI,
  v0: 0,
  du0: 0.8,
  dv0: 0.5,
  steps: 2000,
  stepSize: 0.005,
  color: 0xffff33,
  useThickLine: true,
  thickness: 0.04
});
app.add(geodesic3);

app.start();

// Helper function to update torus geometry
function updateTorusGeometry(majorRadius: number, minorRadius: number) {
  R = majorRadius;
  r = minorRadius;

  // Rebuild the torus (this will trigger recalculation of fundamental forms)
  torus.rebuild();

  // Rebuild all geodesics (they will integrate on the new surface)
  geodesic1.rebuild();
  geodesic2.rebuild();
  geodesic3.rebuild();

  console.log(`Updated torus: R=${R.toFixed(2)}, r=${r.toFixed(2)}`);
}

// Expose to console
(window as any).app = app;
(window as any).torus = torus;
(window as any).geodesic1 = geodesic1;
(window as any).geodesic2 = geodesic2;
(window as any).geodesic3 = geodesic3;
(window as any).updateTorusGeometry = updateTorusGeometry;

console.log('✨ Geodesic Demo - Geodesics on a Torus');
console.log('');
console.log('Surface:');
console.log('  • Blue torus (R=2.0, r=0.6)');
console.log('');
console.log('Geodesics:');
console.log('  • Red - Winding around major axis');
console.log('  • Green - Opposite side, different winding');
console.log('  • Yellow - Complex path');
console.log('');
console.log('Geodesics on a torus create beautiful patterns!');
console.log('');
console.log('Try in console:');
console.log('');
console.log('  // Change torus geometry (geodesics will adapt!)');
console.log('  updateTorusGeometry(2.5, 0.5)  // Thinner torus');
console.log('  updateTorusGeometry(1.5, 0.8)  // Fatter torus');
console.log('  updateTorusGeometry(2.0, 0.6)  // Back to original');
console.log('');
console.log('  // Change geodesic initial conditions');
console.log('  geodesic1.du0 = 1.0');
console.log('  geodesic1.dv0 = 0.5');
console.log('');
console.log('  // Change geodesic integration');
console.log('  geodesic1.steps = 3000');
console.log('  geodesic1.stepSize = 0.003');
console.log('');
console.log('  // Change appearance');
console.log('  geodesic1.colorHex = 0xff00ff');
console.log('  geodesic2.thickness = 0.06');
console.log('  torus.colorHex = 0x4466ff');
console.log('  torus.wireframe = true');
console.log('');
console.log('All parameters are reactive!');
console.log('Geodesic parameters auto-rebuild geodesics.');
console.log('Surface parameters auto-rebuild surface.');
console.log('updateTorusGeometry() rebuilds everything for new geometry.');
