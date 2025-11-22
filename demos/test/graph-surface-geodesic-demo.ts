import * as THREE from 'three';
import {
  App,
  GraphSurface,
  Geodesic,
  CoordinateAxes
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
  autoRotateSpeed: 0.5
});

// Add axes
const axes = new CoordinateAxes({ size: 6 });
app.add(axes);

// Create a graph surface z = sin(x) * cos(y)
// Provide symbolic derivatives for maximum speed
const graph = new GraphSurface(
  {
    f: (x, y) => Math.sin(x) * Math.cos(y),
    fx: (x, y) => Math.cos(x) * Math.cos(y),
    fy: (x, y) => -Math.sin(x) * Math.sin(y),
    fxx: (x, y) => -Math.sin(x) * Math.cos(y),
    fxy: (x, y) => -Math.cos(x) * Math.sin(y),
    fyy: (x, y) => -Math.sin(x) * Math.cos(y)
  },
  {
    xMin: -Math.PI,
    xMax: Math.PI,
    yMin: -Math.PI,
    yMax: Math.PI,
    xSegments: 128,
    ySegments: 128,
    color: 0x2266aa,
    wireframe: false
  }
);

// Make surface semi-transparent
(graph.material as THREE.MeshStandardMaterial).opacity = 0.4;
(graph.material as THREE.MeshStandardMaterial).transparent = true;
app.add(graph);

// Create multiple geodesics to test performance
const geodesics: Geodesic[] = [];

// Grid of geodesics
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    const geodesic = new Geodesic({
      surface: graph,
      u0: -2 + i * 2,
      v0: -2 + j * 2,
      du0: 0.5 + Math.random() * 0.5,
      dv0: 0.5 + Math.random() * 0.5,
      steps: 2000,
      stepSize: 0.005,
      color: 0xff3333 + i * 0x002200 + j * 0x000022,
      useThickLine: true,
      thickness: 0.03
    });
    geodesics.push(geodesic);
    app.add(geodesic);
  }
}

app.start();

// Expose to console
(window as any).app = app;
(window as any).graph = graph;
(window as any).geodesics = geodesics;

console.log('✨ GraphSurface Geodesic Demo - OPTIMIZED');
console.log('');
console.log('Surface: z = sin(x)cos(y)');
console.log('9 geodesics with different initial conditions');
console.log('');
console.log('This uses optimized formulas for graphs z = f(x,y):');
console.log('  • Direct Christoffel symbols (no metric tensor computation)');
console.log('  • ~10x faster than general ParametricSurface');
console.log('  • Perfect for real-time geodesic animation');
console.log('');
console.log('Try in console:');
console.log('  geodesics[0].du0 = 1.0  // Change initial velocity');
console.log('  geodesics[0].v0 = 0     // Change starting position');
console.log('  graph.colorHex = 0x44aa66  // Change surface color');
console.log('');
console.log('Performance: All 9 geodesics should update smoothly!');
