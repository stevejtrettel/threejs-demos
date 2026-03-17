/**
 * Hopf Torus Folding — hexagonal torus rolling up
 *
 * Rolls a flat parallelogram (the fundamental domain of the hexagonal
 * Hopf torus) into a torus in R³ via the Hopf fibration + stereographic
 * projection.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfTorus, fromSpherical } from '@/math/hopf';
import { RollUpMesh } from '@/math/surfaces/RollUpMesh';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

const TWO_PI = 2 * Math.PI;

// --- Hex torus curve on S² ---

const hopf = new HopfTorus({
  curve: fromSpherical(t => {
    const a = 0.276;
    const b = 1.9;
    const n = 3;
    return {
      phi: Math.PI / 2 + a * b * Math.cos(n * t),
      theta: t + a * Math.sin(2 * n * t),
    };
  }),
});

const e1 = new THREE.Vector2(hopf.fiberPeriod, 0);
const e2 = hopf.edgeGenerator;

console.log('Hex torus lattice tau:', hopf.lattice.tau());
console.log('e1:', e1);
console.log('e2:', e2);

// --- Surface adapter: maps [-0.5, 0.5]² through lattice generators ---

const hopfSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const pt = new THREE.Vector2(
      u * e1.x + v * e2.x,
      u * e1.y + v * e2.y,
    );
    return hopf.isometricImage(pt);
  },
  getDomain(): SurfaceDomain {
    return { uMin: -0.5, uMax: 0.5, vMin: -0.5, vMax: 0.5 };
  },
};

// --- Scene ---

const app = new App({ antialias: true });
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

const mesh = new RollUpMesh(hopfSurface, {
  squareDomain: false,
  uSegments: 96,
  vSegments: 96,
});
app.scene.add(mesh);

// --- Animation ---

const FOLD_UP = 5;
const HOLD = 5;
const FOLD_DOWN = 5;
const PERIOD = FOLD_UP + HOLD + FOLD_DOWN;
const CAM_DIST = 40;
const CAM_HEIGHT = 16;

app.addAnimateCallback((elapsed) => {
  const phase = elapsed % PERIOD;
  let tau: number;
  if (phase < FOLD_UP) {
    tau = 0.5 - 0.5 * Math.cos(Math.PI * phase / FOLD_UP);
  } else if (phase < FOLD_UP + HOLD) {
    tau = 1.0;
  } else {
    const t = (phase - FOLD_UP - HOLD) / FOLD_DOWN;
    tau = 0.5 + 0.5 * Math.cos(Math.PI * t);
  }
  mesh.setTau(tau);

  // Tilt mesh 90° around X as it folds up
  mesh.rotation.x = tau * (-Math.PI / 2);

  const angle = TWO_PI * (elapsed % PERIOD) / PERIOD;
  app.camera.position.set(
    CAM_DIST * Math.cos(angle),
    CAM_HEIGHT,
    CAM_DIST * Math.sin(angle),
  );
  app.controls.target.set(0, 0, 0);
  app.controls.update();
});

app.start();
