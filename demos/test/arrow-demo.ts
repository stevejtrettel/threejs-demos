import { App, Arrow, ConeVector, CoordinateAxes, Grid, Materials } from '@core';

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

// ===== Professional Arrows =====

// 1. Red arrow (X-axis)
const arrowX = new Arrow({
  origin: [0, 0.5, 0],
  direction: [1, 0, 0],
  length: 2,
  color: 0xff0000
});
app.add(arrowX, {
  params: {
    length: { min: 0.1, max: 5 }
  }
});

// 2. Green arrow (Y-axis)
const arrowY = new Arrow({
  origin: [0, 0.5, 0],
  direction: [0, 1, 0],
  length: 1.5,
  color: 0x00ff00
});
app.add(arrowY, {
  params: {
    length: { min: 0.1, max: 5 }
  }
});

// 3. Blue arrow (Z-axis)
const arrowZ = new Arrow({
  origin: [0, 0.5, 0],
  direction: [0, 0, 1],
  length: 1.8,
  color: 0x0000ff
});
app.add(arrowZ, {
  params: {
    length: { min: 0.1, max: 5 }
  }
});

// ===== Simple Cone Vector Field =====

// Create a radial vector field using ConeVectors
const coneField: ConeVector[] = [];
for (let i = -2; i <= 2; i++) {
  for (let j = -2; j <= 2; j++) {
    const x = i;
    const z = j;
    const r = Math.sqrt(x * x + z * z);

    if (r > 0.5 && r < 3) {
      // Radial outward field
      const magnitude = 0.3 + 0.1 * r;
      const cone = new ConeVector({
        origin: [x, 0, z],
        direction: [x / r, 0, z / r],
        magnitude: magnitude,
        color: 0xffaa00,
        baseRadius: 0.03,
        lengthScale: 0.8
      });
      coneField.push(cone);
      app.add(cone);
    }
  }
}

// Animated arrow that rotates
const animatedArrow = new Arrow({
  origin: [0, 2.5, 0],
  direction: [1, 0, 0],
  length: 1.2,
  color: 0xff00ff
});
app.add(animatedArrow);

app.addAnimateCallback((time) => {
  const t = time * 0.001;
  animatedArrow.setDirection(
    Math.cos(t),
    Math.sin(t * 2) * 0.3,
    Math.sin(t)
  );
});

app.start();

// Expose to console
(window as any).app = app;
(window as any).arrowX = arrowX;
(window as any).arrowY = arrowY;
(window as any).arrowZ = arrowZ;
(window as any).animatedArrow = animatedArrow;
(window as any).coneField = coneField;

console.log('✨ Arrow and ConeVector Demo');
console.log('');
console.log('Two types of vector visualizations:');
console.log('');
console.log('Professional Arrows (center):');
console.log('  • Sphere base + cylinder shaft + cone head');
console.log('  • Red (X), Green (Y), Blue (Z) arrows');
console.log('  • Best for publication-quality visualizations');
console.log('');
console.log('Simple Cone Vectors (radial field):');
console.log('  • Single cone shape, scales with magnitude');
console.log('  • Orange radial outward field');
console.log('  • Best for dense vector fields');
console.log('');
console.log('Magenta arrow rotates automatically.');
console.log('');
console.log('Try in console:');
console.log('  arrowX.length = 3');
console.log('  arrowX.color = 0x00ffff');
console.log('  coneField[0].magnitude = 2');
console.log('');
console.log('All parameters are reactive!');
