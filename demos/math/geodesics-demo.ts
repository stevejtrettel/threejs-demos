/**
 * Geodesics on Surfaces Demo
 *
 * Demonstrates geodesic integration on a parametric surface:
 * - Torus surface (semi-transparent)
 * - Multiple geodesics flowing from a point
 * - Shows how "straight lines" curve on curved surfaces
 */

import { App } from '@/app/App';
import { Torus, SurfaceMesh, GeodesicTrail } from '@/math';
import * as THREE from 'three';

console.log('=== Geodesics Demo ===\n');

// Create app
const app = new App({
  antialias: true,
  debug: true
});

// Setup scene
app.camera.position.set(0, 4, 10);
app.controls.target.set(0, 0, 0);
app.lights.set('three-point');
app.backgrounds.setColor(0x0a0a1a);

// Create torus
const torus = new Torus({
  R: 2.5,
  r: 1.0
});

// Create semi-transparent surface mesh
const surface = new SurfaceMesh(torus, {
  color: 0x2244aa,
  roughness: 0.2,
  metalness: 0.1,
  transmission: 0.6,  // Glass-like
  uSegments: 64,
  vSegments: 32
});

app.scene.add(surface);

console.log('✓ Created torus surface (semi-transparent)');
console.log(`  - R: ${torus.R}, r: ${torus.r}`);

// Create multiple geodesics from a single point
const geodesics: GeodesicTrail[] = [];
const numGeodesics = 8;
const startPosition: [number, number] = [Math.PI, Math.PI / 2];

console.log(`\n✓ Launching ${numGeodesics} geodesics from (π, π/2)`);

for (let i = 0; i < numGeodesics; i++) {
  const angle = (i / numGeodesics) * Math.PI * 2;

  // Each geodesic starts from same point but different direction
  const geodesic = new GeodesicTrail(torus, {
    initialPosition: startPosition,
    initialVelocity: [Math.cos(angle), Math.sin(angle)],
    color: 0xff3366,
    maxPoints: 600,
    stepSize: 0.008
  });

  geodesics.push(geodesic);
  app.scene.add(geodesic);

  console.log(`  - Geodesic ${i + 1}: velocity direction ${(angle * 180 / Math.PI).toFixed(0)}°`);
}

console.log('\n=== What are Geodesics? ===');
console.log('Geodesics are the "straightest possible" paths on a curved surface.');
console.log('They generalize the concept of straight lines to curved spaces.');
console.log('On a flat plane, geodesics are straight lines.');
console.log('On a sphere, geodesics are great circles.');
console.log('On a torus, geodesics can wrap around in complex ways!\n');

// Add marker at starting point
const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const marker = new THREE.Mesh(markerGeometry, markerMaterial);

// Convert parameter coords to 3D position
const startPoint = torus.evaluate(startPosition[0], startPosition[1]);
marker.position.copy(startPoint);
app.scene.add(marker);

console.log('✓ Added yellow marker at starting point');

// Animate geodesics
app.addAnimateCallback((time, delta) => {
  // Slowly rotate the entire scene for better view
  surface.rotation.y = time * 0.0002;

  geodesics.forEach(g => {
    g.rotation.y = time * 0.0002;
    g.animate(time, delta);
  });

  marker.rotation.y = time * 0.0002;
});

// Reset geodesics every 20 seconds
setInterval(() => {
  console.log('\n--- Resetting geodesics ---');
  geodesics.forEach(g => g.reset());
}, 20000);

// Start rendering
app.start();

console.log('\n✓ Demo running!');
console.log('  - Press D to toggle stats');
console.log('  - Watch geodesics flow along the surface');
console.log('  - Geodesics reset every 20 seconds');
console.log('  - Notice: they follow curved paths but never "turn" on the surface!\n');
