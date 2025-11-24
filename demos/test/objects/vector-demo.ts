import * as THREE from 'three';
import { App, Vector, CoordinateAxes, Grid, Materials } from '@';

const app = new App({
  fov: 60,
  toneMapping: 'aces'
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('three-point');
app.controls.setOrbit({ enableDamping: true });

// Add helpers
const axes = new CoordinateAxes({ size: 3 });
app.add(axes);

const grid = new Grid({
  size: 6,
  divisions: 12,
  plane: 'xz'
});
app.add(grid);

// Create various vectors to demonstrate different use cases

// 1. Velocity vector (red)
const velocity = new Vector({
  origin: [0, 0.5, 0],
  direction: [1, 0, 0],
  length: 2,
  color: 0xff0000
});
app.add(velocity, {
  params: {
    length: { min: 0.1, max: 5 }
  }
});

// 2. Force vector (blue)
const force = new Vector({
  origin: [0, 0.5, 0],
  direction: [0, 1, 0.5],
  length: 1.5,
  color: 0x0000ff
});
app.add(force, {
  params: {
    length: { min: 0.1, max: 5 }
  }
});

// 3. Multiple vectors in a pattern (green)
const vectorField: Vector[] = [];
for (let i = -2; i <= 2; i++) {
  for (let j = -2; j <= 2; j++) {
    // Create a radial pattern
    const x = i;
    const z = j;
    const r = Math.sqrt(x * x + z * z);

    if (r > 0.1) {
      const vec = new Vector({
        origin: [x, 0, z],
        direction: [-z / r, 0, x / r],  // Perpendicular to radius
        length: 0.5,
        color: 0x00ff00
      });
      vectorField.push(vec);
      app.add(vec);
    }
  }
}

// 4. Animated vector (magenta)
const animated = new Vector({
  origin: [0, 2, 0],
  direction: [1, 0, 0],
  length: 1,
  color: 0xff00ff
});
app.add(animated);

// Animate the magenta vector
app.addAnimateCallback((time) => {
  const t = time * 0.001;
  animated.setDirection(
    Math.cos(t),
    Math.sin(t * 2) * 0.5,
    Math.sin(t)
  );
});

// Add a sphere to show velocity vector acting on an object
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.2, 32, 32),
  Materials.plastic(0xffff00)
);
sphere.position.set(0, 0.5, 0);
app.scene.add(sphere);

app.start();

// Expose to console
(window as any).app = app;
(window as any).velocity = velocity;
(window as any).force = force;
(window as any).animated = animated;

console.log('✨ Vector Demo');
console.log('');
console.log('Vectors displayed:');
console.log('  • Red: Velocity vector (along X)');
console.log('  • Blue: Force vector (angled upward)');
console.log('  • Green: Vector field (radial circulation)');
console.log('  • Magenta: Animated vector (rotating)');
console.log('');
console.log('Try in console:');
console.log('  velocity.length = 3');
console.log('  velocity.setDirection(0, 1, 0)');
console.log('  force.color = 0xff00ff');
console.log('');
console.log('All vectors have reactive parameters!');
