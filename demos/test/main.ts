import { App } from '@core/App';
import { SpinningSphere } from './SpinningSphere';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Add multiple spheres using app.add()
const spheres: SpinningSphere[] = [];
for (let i = 0; i < 5; i++) {
  const sphere = new SpinningSphere(Math.random() + 0.5);
  app.add(sphere);  // Automatically adds to scene and animation!
  spheres.push(sphere);
}

app.start();

// Test removal after 3 seconds
setTimeout(() => {
  console.log('Removing first sphere...');
  app.remove(spheres[0]);
}, 3000);

// Test clear after 6 seconds
setTimeout(() => {
  console.log('Clearing all...');
  app.clear();
}, 6000);
