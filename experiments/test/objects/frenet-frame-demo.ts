import { App, ParametricCurve, FrenetFrame, CoordinateAxes, Grid, Materials } from '@';

const app = new App({
  fov: 60,
  toneMapping: 'aces'
});

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('three-point');
app.controls.setOrbit({
  enableDamping: true,
  autoRotate: true,
  autoRotateSpeed: 0.5
});

// Add helpers
const axes = new CoordinateAxes({ size: 3 });
app.add(axes);

const grid = new Grid({
  size: 8,
  divisions: 16,
  plane: 'xz',
  colorGrid: 0x222222
});
app.add(grid);

// Define a helix curve
const helixFn = (t: number) => ({
  x: 2 * Math.cos(t),
  y: t * 0.3,
  z: 2 * Math.sin(t)
});

// Create the curve
const helix = new ParametricCurve(helixFn, {
  tMin: 0,
  tMax: 4 * Math.PI,
  segments: 200,
  color: 0x888888,
  linewidth: 2
});
app.add(helix);

// Create Frenet frame at multiple positions along the curve
const frames: FrenetFrame[] = [];
const numFrames = 8;

for (let i = 0; i < numFrames; i++) {
  const t = (i / numFrames) * 4 * Math.PI;
  const frame = new FrenetFrame(helixFn, {
    position: t,
    scale: 0.5
  });
  frames.push(frame);
  app.add(frame);
}

// Create one animated frame that travels along the curve
const animatedFrame = new FrenetFrame(helixFn, {
  position: 0,
  scale: 0.8
});
app.add(animatedFrame, {
  params: {
    position: { min: 0, max: 4 * Math.PI, step: 0.01 },
    scale: { min: 0.1, max: 2 }
  }
});

// Animate the frame along the curve
app.addAnimateCallback((time) => {
  const t = (time * 0.0005) % (4 * Math.PI);
  animatedFrame.position = t;
});

app.start();

// Expose to console
(window as any).app = app;
(window as any).helix = helix;
(window as any).animatedFrame = animatedFrame;
(window as any).frames = frames;

console.log('✨ Frenet Frame Demo');
console.log('');
console.log('Visualization of the Frenet-Serret frame along a helix:');
console.log('  • Gray curve: Helix');
console.log('  • Red arrows: Tangent vectors (T)');
console.log('  • Green arrows: Normal vectors (N)');
console.log('  • Blue arrows: Binormal vectors (B)');
console.log('');
console.log('The large frame animates along the curve automatically.');
console.log('');
console.log('Mathematical background:');
console.log('  T = r\'(t) / |r\'(t)|  (unit tangent)');
console.log('  N = T\'(t) / |T\'(t)|  (principal normal)');
console.log('  B = T × N              (binormal)');
console.log('');
console.log('Try in console:');
console.log('  animatedFrame.position = Math.PI');
console.log('  animatedFrame.scale = 1.5');
console.log('');
console.log('The frame forms an orthonormal basis at each point!');
