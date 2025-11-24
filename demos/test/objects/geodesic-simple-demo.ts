import * as THREE from 'three';
import {
  App,
  ParametricSurface,
  Geodesic,
  CoordinateAxes
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

// Create a simple sphere
const sphere = new ParametricSurface(
  (u, v) => new THREE.Vector3(
    2 * Math.sin(u) * Math.cos(v),
    2 * Math.sin(u) * Math.sin(v),
    2 * Math.cos(u)
  ),
  {
    uMin: 0,
    uMax: Math.PI,
    vMin: 0,
    vMax: 2 * Math.PI,
    uSegments: 64,
    vSegments: 64,
    color: 0x2244aa,
    wireframe: false
  }
);
// Make sphere semi-transparent
(sphere.material as THREE.MeshStandardMaterial).opacity = 0.3;
(sphere.material as THREE.MeshStandardMaterial).transparent = true;
app.add(sphere);

// Create a single geodesic (equator - should be stable)
const geodesic1 = new Geodesic({
  surface: sphere,
  u0: Math.PI / 2,  // Start at equator
  v0: 0,
  du0: 0,          // No u motion
  dv0: 1.0,        // Pure v motion (should trace equator)
  steps: 1000,
  stepSize: 0.01,
  color: 0xff3333,
  useThickLine: true,
  thickness: 0.05
});
app.add(geodesic1);

app.start();

// Expose to console
(window as any).app = app;
(window as any).sphere = sphere;
(window as any).geodesic1 = geodesic1;

console.log('✨ Simple Geodesic Test - Equator on Sphere');
console.log('');
console.log('This geodesic should be a perfect circle (equator)');
console.log('');
console.log('Try in console:');
console.log('  geodesic1.du0 = 0.5  // Add some tilt');
console.log('  geodesic1.u0 = Math.PI/4  // Start at different latitude');
