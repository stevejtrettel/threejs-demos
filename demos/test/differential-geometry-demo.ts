import * as THREE from 'three';
import {
  App,
  ParametricSurface,
  Arrow,
  CoordinateAxes,
  Materials,
  computeGaussianCurvature,
  computeMeanCurvature
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
const axes = new CoordinateAxes({ size: 3 });
app.add(axes);

// Create a sphere for testing differential geometry
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
    uSegments: 32,
    vSegments: 32,
    color: 0x3366ff,
    wireframe: false
  }
);
app.add(sphere);

// Test differential geometry at various points
const testPoints = [
  { u: Math.PI / 4, v: 0, name: 'Front' },
  { u: Math.PI / 4, v: Math.PI / 2, name: 'Right' },
  { u: Math.PI / 4, v: Math.PI, name: 'Back' },
  { u: Math.PI / 4, v: 3 * Math.PI / 2, name: 'Left' },
  { u: Math.PI / 2, v: 0, name: 'Equator' }
];

// Visualize surface normals at test points
const normalArrows: Arrow[] = [];

testPoints.forEach(({ u, v, name }) => {
  // Get position
  const pos = sphere.parameterization(u, v);

  // Get surface normal
  const normal = sphere.surfaceNormal(u, v);

  // Get first fundamental form
  const I = sphere.firstFundamentalForm(u, v);

  // Get Christoffel symbols
  const Γ = sphere.christoffelSymbols(u, v);

  // Compute curvatures
  const K = computeGaussianCurvature((u, v) => sphere.parameterization(u, v), u, v);
  const H = computeMeanCurvature((u, v) => sphere.parameterization(u, v), u, v);

  // Create arrow for normal
  const arrow = new Arrow({
    tail: pos,
    head: pos.clone().addScaledVector(normal, 0.5),
    color: 0xffff00,
    baseRadius: 0.02,
    shaftRadius: 0.01,
    headRadius: 0.04,
    headLength: 0.1
  });
  normalArrows.push(arrow);
  app.add(arrow);

  // Log differential geometry data
  console.log(`\n=== ${name} (u=${u.toFixed(3)}, v=${v.toFixed(3)}) ===`);
  console.log(`Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
  console.log(`Normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`);
  console.log(`First Fundamental Form:`);
  console.log(`  E = ${I.E.toFixed(6)}`);
  console.log(`  F = ${I.F.toFixed(6)}`);
  console.log(`  G = ${I.G.toFixed(6)}`);
  console.log(`Christoffel Symbols:`);
  console.log(`  Γ^u_uu = ${Γ.u.u.u.toFixed(6)}`);
  console.log(`  Γ^u_uv = ${Γ.u.u.v.toFixed(6)}`);
  console.log(`  Γ^u_vv = ${Γ.u.v.v.toFixed(6)}`);
  console.log(`  Γ^v_uu = ${Γ.v.u.u.toFixed(6)}`);
  console.log(`  Γ^v_uv = ${Γ.v.u.v.toFixed(6)}`);
  console.log(`  Γ^v_vv = ${Γ.v.v.v.toFixed(6)}`);
  console.log(`Curvatures:`);
  console.log(`  Gaussian (K) = ${K.toFixed(6)}`);
  console.log(`  Mean (H) = ${H.toFixed(6)}`);
});

app.start();

// Expose to console
(window as any).app = app;
(window as any).sphere = sphere;
(window as any).normalArrows = normalArrows;

console.log('\n\n✨ Differential Geometry Demo');
console.log('');
console.log('Testing DifferentialSurface interface on a sphere (radius = 2)');
console.log('');
console.log('Yellow arrows show surface normals at test points');
console.log('');
console.log('Expected results for a sphere of radius r:');
console.log('  • E ≈ r²');
console.log('  • G ≈ r² sin²(u)');
console.log('  • F ≈ 0');
console.log('  • Gaussian curvature K ≈ 1/r² = 0.25');
console.log('  • Mean curvature H ≈ 1/r = 0.5');
console.log('');
console.log('See console output above for computed values!');
