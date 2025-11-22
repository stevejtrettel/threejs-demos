import { App } from '@core/App';
import { SpinningSphere } from './SpinningSphere';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Add sphere with parameter exposure
const sphere = new SpinningSphere();
app.add(sphere, {
  params: true  // Expose all parameters
});

app.start();

// Test parameter changes via console
console.log('Test changing parameters:');
console.log('sphere.speed = 3');
console.log('sphere.size = 2');
console.log('sphere.color = 0x00ff00');

// Auto-test after 2 seconds
setTimeout(() => {
  console.log('Auto-testing parameters...');
  sphere.speed = 3;
  sphere.size = 2;
  sphere.color = 0x00ff00;
}, 2000);
