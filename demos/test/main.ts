import { App, ParametricCurve } from '@core';

const app = new App();

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('ambient');
app.controls.setOrbit({ enableDamping: true });

// Helix curve
const helix = new ParametricCurve(
  (t) => ({
    x: Math.cos(t),
    y: Math.sin(t),
    z: t / 5
  }),
  {
    tMin: 0,
    tMax: 10 * Math.PI,
    color: 0xff0000
  }
);

app.add(helix, {
  params: {
    tMax: { min: 0, max: 20 * Math.PI },
    segments: true
  }
});

app.start();

// Expose to console
(window as any).app = app;
(window as any).helix = helix;

console.log('✨ ParametricCurve Demo');
console.log('');
console.log('Try these commands:');
console.log('  helix.tMax = 5 * Math.PI     // Shorter helix');
console.log('  helix.tMax = 15 * Math.PI    // Longer helix');
console.log('  helix.segments = 300         // Smoother curve');
console.log('  helix.segments = 20          // Jagged curve');
