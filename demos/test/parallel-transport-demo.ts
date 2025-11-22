import * as THREE from 'three';
import {
  App,
  GraphSurface,
  Arrow,
  CoordinateAxes,
  TangentVector,
  integrateGeodesicCoords,
  integrateParallelTransport,
  createCatmullRomVec
} from '@core';

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

// Create a wave surface z = sin(x)sin(y)
const surface = new GraphSurface(
  {
    f: (x, y) => Math.sin(x) * Math.sin(y),
    fx: (x, y) => Math.cos(x) * Math.sin(y),
    fy: (x, y) => Math.sin(x) * Math.cos(y),
    fxx: (x, y) => -Math.sin(x) * Math.sin(y),
    fxy: (x, y) => Math.cos(x) * Math.cos(y),
    fyy: (x, y) => -Math.sin(x) * Math.sin(y)
  },
  {
    xMin: -Math.PI,
    xMax: Math.PI,
    yMin: -Math.PI,
    yMax: Math.PI,
    xSegments: 128,
    ySegments: 128,
    color: 0x2244aa,
    wireframe: false
  }
);

// Make surface semi-transparent
(surface.material as THREE.MeshStandardMaterial).opacity = 0.3;
(surface.material as THREE.MeshStandardMaterial).transparent = true;
app.add(surface);

// Integrate a geodesic in parameter space
const initialTV = new TangentVector(
  new THREE.Vector2(-2, -2),  // Start position
  new THREE.Vector2(1.0, 0.8)     // Initial velocity
);

console.log('Integrating geodesic in parameter space...');
const geodesicCoords = integrateGeodesicCoords(surface, initialTV, {
  steps: 500,
  stepSize: 0.01,
  isOutsideDomain: (u, v) => surface.isOutsideDomain(u, v)
});

console.log(`Geodesic: ${geodesicCoords.length} points`);

// Visualize the geodesic curve
const geodesicPoints3D = geodesicCoords.map(p => surface.parameterization(p.x, p.y));
const geodesicGeometry = new THREE.BufferGeometry().setFromPoints(geodesicPoints3D);
const geodesicLine = new THREE.Line(
  geodesicGeometry,
  new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 })
);
app.scene.add(geodesicLine);

// Integrate parallel transport along the geodesic
console.log('Integrating parallel transport...');
const initialBasis: [THREE.Vector2, THREE.Vector2] = [
  new THREE.Vector2(1, 0),  // e1 = (1, 0) in parameter space
  new THREE.Vector2(0, 1)   // e2 = (0, 1) in parameter space
];

const transportedBasis = integrateParallelTransport(
  surface,
  geodesicCoords,
  initialBasis,
  { stepSize: 0.001 }
);

console.log(`Transported basis: ${transportedBasis.length} frames`);

// Create interpolators for smooth basis queries
const ts = geodesicCoords.map((_, i) => i / (geodesicCoords.length - 1));
const e1Samples = transportedBasis.map(([e1]) => e1);
const e2Samples = transportedBasis.map(([, e2]) => e2);

const e1Interp = createCatmullRomVec(ts, e1Samples);
const e2Interp = createCatmullRomVec(ts, e2Samples);

// Visualize parallel transported basis vectors along the curve
const arrows: Arrow[] = [];
const numArrows = 20;

for (let i = 0; i < numArrows; i++) {
  const t = i / (numArrows - 1);
  const idx = Math.floor(t * (geodesicCoords.length - 1));
  const coord = geodesicCoords[idx];
  const pos3D = surface.parameterization(coord.x, coord.y);

  // Get interpolated basis vectors
  const e1 = e1Interp(t);
  const e2 = e2Interp(t);

  // Convert basis vectors from parameter space to 3D
  // For a graph z = f(x,y), the tangent space vectors are:
  // ∂/∂x = (1, 0, f_x)
  // ∂/∂y = (0, 1, f_y)
  const fx = surface.derivatives.fx!(coord.x, coord.y);
  const fy = surface.derivatives.fy!(coord.x, coord.y);

  // V_3D = V_u * ∂/∂x + V_v * ∂/∂y
  const e1_3D = new THREE.Vector3(e1.x, e1.y, e1.x * fx + e1.y * fy);
  const e2_3D = new THREE.Vector3(e2.x, e2.y, e2.x * fx + e2.y * fy);

  // Normalize for direction, keep length separate
  const arrowLength = 0.4;  // Reasonable arrow length
  const e1_dir = e1_3D.clone().normalize();
  const e2_dir = e2_3D.clone().normalize();

  // Create arrows for e1 (red) and e2 (green)
  const arrow1 = new Arrow({
    origin: pos3D,
    direction: e1_dir,
    length: arrowLength,
    color: 0xff0000,
    baseRadius: 0.015,
    shaftRadius: 0.008,
    headRadius: 0.025,
    headLength: 0.08
  });
  arrows.push(arrow1);
  app.add(arrow1);

  const arrow2 = new Arrow({
    origin: pos3D,
    direction: e2_dir,
    length: arrowLength,
    color: 0x00ff00,
    baseRadius: 0.015,
    shaftRadius: 0.008,
    headRadius: 0.025,
    headLength: 0.08
  });
  arrows.push(arrow2);
  app.add(arrow2);
}

console.log(`\nCreated ${arrows.length} arrows total (${arrows.length / 2} frames)`);

app.start();

// Expose to console
(window as any).app = app;
(window as any).surface = surface;
(window as any).geodesicCoords = geodesicCoords;
(window as any).transportedBasis = transportedBasis;
(window as any).e1Interp = e1Interp;
(window as any).e2Interp = e2Interp;
(window as any).arrows = arrows;

console.log('\n\n✨ Parallel Transport Demo - Basis Vectors Along Geodesic');
console.log('');
console.log('Surface: z = sin(x)sin(y) - smooth wave surface');
console.log('');
console.log('Visualization:');
console.log('  • Yellow curve = Geodesic path');
console.log('  • Red arrows = e1 basis vector (parallel transported)');
console.log('  • Green arrows = e2 basis vector (parallel transported)');
console.log('');
console.log('How it works:');
console.log('  1. Integrate geodesic in parameter space (u,v)');
console.log('  2. Integrate parallel transport equation: DV/dt = -Γ^i_jk γ\'^j V^k');
console.log('  3. Create Catmull-Rom interpolators for smooth basis queries');
console.log('  4. Convert basis vectors from parameter space to 3D tangent vectors');
console.log('');
console.log('Notice how the basis vectors:');
console.log('  • Stay tangent to the surface');
console.log('  • Rotate as they follow the curve (due to curvature)');
console.log('  • Maintain their relative angle (parallel transport property)');
console.log('');
console.log('Try in console:');
console.log('  e1Interp(0.5)  // Get e1 at halfway point');
console.log('  e2Interp(0.75) // Get e2 at 3/4 point');
console.log('  transportedBasis[100]  // Get basis at specific curve point');
console.log('');
console.log('This is FAST: integrate once, interpolate many times!');
