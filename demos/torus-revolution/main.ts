/**
 * Torus of Revolution — Non-conformal folding
 *
 * Rolls a flat square into a skinny torus of revolution.
 * The grid squares visibly stretch on the outside and compress
 * on the inside, demonstrating the non-conformal metric.
 */

import { App } from '@/app/App';
import { Torus } from '@/math/surfaces/Torus';
import { RollUpMesh } from '@/math/surfaces/RollUpMesh';

const TWO_PI = 2 * Math.PI;

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.fov = 20;
app.camera.updateProjectionMatrix();
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5,
});
app.backgrounds.setColor(0xf0f0f0);

app.camera.position.set(8, 14, 24);
app.controls.target.set(0, 0, 0);
app.controls.update();

// --- Roll-up mesh ---

const torus = new Torus({ R: 2, r: 0.8 });
const mesh = new RollUpMesh(torus, { uSegments: 64, vSegments: 64 });
app.scene.add(mesh);

// --- Animation ---

const PERIOD = 15;
const CAM_DIST = 40;
const CAM_HEIGHT = 16;

app.addAnimateCallback((elapsed) => {
  mesh.setTau(0.5 - 0.5 * Math.cos(TWO_PI * elapsed / PERIOD));

  const angle = TWO_PI * elapsed / PERIOD;
  app.camera.position.set(
    CAM_DIST * Math.cos(angle),
    CAM_HEIGHT,
    CAM_DIST * Math.sin(angle),
  );
  app.controls.target.set(0, 0, 0);
  app.controls.update();
});

app.start();
