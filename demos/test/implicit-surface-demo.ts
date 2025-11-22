import { App, ImplicitSurface, CoordinateAxes, Grid, Materials } from '@core';

const app = new App({
  fov: 60,
  toneMapping: 'aces'
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('three-point');
app.controls.setOrbit({
  enableDamping: true,
  autoRotate: true,
  autoRotateSpeed: 1
});

// Add helpers
const axes = new CoordinateAxes({ size: 2 });
app.add(axes);

const grid = new Grid({
  size: 6,
  divisions: 12,
  plane: 'xz',
  colorGrid: 0x222222
});
app.add(grid);

// 1. Sphere: x² + y² + z² - r² = 0
const sphere = new ImplicitSurface(
  (x, y, z) => x * x + y * y + z * z - 1,
  {
    resolution: 32,
    isovalue: 0,
    material: Materials.plastic(0xff3333),
    bounds: {
      xMin: -1.5,
      xMax: 1.5,
      yMin: -1.5,
      yMax: 1.5,
      zMin: -1.5,
      zMax: 1.5
    }
  }
);
sphere.mesh.position.set(-3, 1.5, 0);
app.add(sphere);

// 2. Torus: (√(x² + y²) - R)² + z² - r² = 0
const torus = new ImplicitSurface(
  (x, y, z) => {
    const R = 0.8; // Major radius
    const r = 0.3; // Minor radius
    const q = Math.sqrt(x * x + y * y) - R;
    return q * q + z * z - r * r;
  },
  {
    resolution: 64,
    isovalue: 0,
    material: Materials.glossy(0x33ff33),
    bounds: {
      xMin: -1.5,
      xMax: 1.5,
      yMin: -1.5,
      yMax: 1.5,
      zMin: -1.5,
      zMax: 1.5
    }
  }
);
torus.mesh.position.set(0, 1.5, 0);
app.add(torus);

// 3. Metaballs: Smooth blobs
const metaballs = new ImplicitSurface(
  (x, y, z) => {
    // Three metaballs
    const blob1 = 0.3 / ((x - 0.3) * (x - 0.3) + y * y + z * z);
    const blob2 = 0.3 / ((x + 0.3) * (x + 0.3) + (y - 0.2) * (y - 0.2) + z * z);
    const blob3 = 0.3 / (x * x + (y + 0.2) * (y + 0.2) + (z - 0.3) * (z - 0.3));
    return blob1 + blob2 + blob3;
  },
  {
    resolution: 28,
    isovalue: 3,
    material: Materials.metal(0x3333ff),
    bounds: {
      xMin: -1.2,
      xMax: 1.2,
      yMin: -1.2,
      yMax: 1.2,
      zMin: -1.2,
      zMax: 1.2
    }
  }
);
metaballs.mesh.position.set(3, 1.5, 0);
app.add(metaballs);

// 4. Heart shape (bonus!)
const heart = new ImplicitSurface(
  (x, y, z) => {
    const x2 = x * x;
    const y2 = y * y;
    const z2 = z * z;
    return Math.pow(x2 + 2.25 * y2 + z2 - 1, 3) - x2 * z2 * z - 0.1125 * y2 * z2 * z;
  },
  {
    resolution: 24,
    isovalue: 0,
    material: Materials.glossy(0xff3377),
    bounds: {
      xMin: -1.5,
      xMax: 1.5,
      yMin: -1.2,
      yMax: 1.2,
      zMin: -1.5,
      zMax: 1.5
    }
  }
);
heart.mesh.position.set(0, 1.5, -3);
app.add(heart);

app.start();

// Expose to console
(window as any).app = app;
(window as any).sphere = sphere;
(window as any).torus = torus;
(window as any).metaballs = metaballs;
(window as any).heart = heart;

console.log('✨ Implicit Surface Demo');
console.log('');
console.log('Surfaces visualized using marching cubes:');
console.log('  • Red sphere: x² + y² + z² = r²');
console.log('  • Green torus: (√(x² + y²) - R)² + z² = r²');
console.log('  • Blue metaballs: Smooth blending of 3 blobs');
console.log('  • Pink heart: Complex algebraic surface');
console.log('');
console.log('Implicit surfaces are defined by f(x,y,z) = constant');
console.log('The marching cubes algorithm finds the level set.');
console.log('');
console.log('Try in console:');
console.log('  sphere.resolution = 48   // Higher resolution');
console.log('  sphere.isovalue = 0.5    // Smaller sphere');
console.log('  metaballs.isovalue = 5   // Different blob shapes');
console.log('');
console.log('All parameters are reactive!');
