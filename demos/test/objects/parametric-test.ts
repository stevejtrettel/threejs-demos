/**
 * Test ParametricSurface rendering
 */

import { App } from '@/app/App';
import { ParametricSurface } from '@/math/orig/objects/ParametricSurface';
import * as THREE from 'three';

console.log('Creating app...');
const app = new App({
  antialias: true,
  debug: true
});

console.log('Setting up camera...');
app.camera.position.set(5, 5, 8);
app.controls.target.set(0, 0, 0);

console.log('Adding lights...');
app.lights.set('three-point');

console.log('Setting background...');
app.backgrounds.setColor(0x2a2a2a);

console.log('Creating ParametricSurface (simple sphere)...');
const sphere = new ParametricSurface(
  (u, v) => {
    const x = Math.sin(u) * Math.cos(v);
    const y = Math.sin(u) * Math.sin(v);
    const z = Math.cos(u);
    return { x, y, z };
  },
  {
    uMin: 0,
    uMax: Math.PI,
    vMin: 0,
    vMax: Math.PI * 2,
    uSegments: 32,
    vSegments: 32,
    color: 0xff6b35
  }
);

console.log('ParametricSurface created:', sphere);
console.log('Mesh:', sphere.mesh);
console.log('Geometry:', sphere.mesh.geometry);
console.log('Material:', sphere.mesh.material);

console.log('Adding to app...');
app.add(sphere);

console.log('Scene children:', app.scene.children);

console.log('Starting app...');
app.start();

console.log('App started! You should see an orange sphere.');
