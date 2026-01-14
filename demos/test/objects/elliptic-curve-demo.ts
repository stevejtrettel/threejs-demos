import { App, EllipticCurveMesh, Helpers } from '@';

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

// Add helpers
app.add(Helpers.axes(3));
app.add(Helpers.grid({ size: 6, divisions: 12 }));

// Create elliptic curve mesh
// Uses Weierstrass P function to map fundamental domain to (P(z), P'(z)) in C^2
// then projects to R^3 by dropping one coordinate
const curve = new EllipticCurveMesh({
  tauRe: 0.5,
  tauIm: 0.866,       // sqrt(3)/2 - gives hexagonal lattice
  resolution: 80,
  holeRadius: 0.06,
  latticeTerms: 10,
  projectionMode: 0,  // Drop Im(P')
  boundingSize: 5,
  outputScale: 0.1,
  color: 0x4488ff,
  roughness: 0.7,
  metalness: 0.3
});

app.add(curve, { params: true });

app.start();

// Expose to console
(window as any).app = app;
(window as any).curve = curve;

console.log('Elliptic Curve Demo');
console.log('');
console.log('Visualizes an elliptic curve via Weierstrass P function.');
console.log('The curve lives as (P(z), P\'(z)) in C^2, projected to R^3.');
console.log('');
console.log('Parameters:');
console.log('  tauRe, tauIm: Lattice parameter tau = tauRe + i*tauIm');
console.log('  resolution: Grid sampling density');
console.log('  holeRadius: Size of hole at poles');
console.log('  projectionMode: Which R^4 coordinate to drop (0-3)');
console.log('  outputScale: Output scaling factor');
console.log('');
console.log('Try in console:');
console.log('  curve.params.set("tauIm", 1.2)');
console.log('  curve.params.set("projectionMode", 1)');
console.log('  curve.params.set("resolution", 120)');
console.log('  curve.params.set("outputScale", 0.15)');
