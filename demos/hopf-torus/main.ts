/**
 * Hopf Torus Demo
 *
 * A torus in R³ via the Hopf fibration, with conformal gridlines.
 * The curve on S² determines the torus shape and its lattice.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfTorus, fromSpherical } from '@/math/hopf';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';
import { CurveTube } from '@/math/curves/CurveTube';

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 3, 5);
app.controls.target.set(0, 0, 0);

app.scene.background = new THREE.Color(0x111111);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Hopf torus from a non-trivial curve on S² ---
// A tilted figure-eight-like curve that produces a skewed (non-rectangular) torus.
// The varying phi means the fiber and edge directions are not orthogonal
// in the embedding, giving a visibly sheared conformal grid.

const hopf = new HopfTorus({
  curve: fromSpherical(t => ({
    theta: t,
    phi: Math.PI / 3 + 0.3 * Math.sin(2 * t),  // oscillating latitude
  })),
});

// Log derived lattice info
const tau = hopf.lattice.tau();
console.log('Derived lattice tau:', tau.tau);
console.log('Height:', hopf.height);
console.log('Edge generator:', hopf.edgeGenerator);

// --- Surface (glass) ---

const surface = new SurfaceMesh(hopf, {
  uSegments: 128,
  vSegments: 128,
  color: 0xc9eaff,
  transmission: 0.85,
  roughness: 0.05,
  metalness: 0,
});
app.scene.add(surface);

// --- Conformal grid ---

const N_GRID = 12;
const FIBER_COLOR = 0x4287f5;   // blue
const EDGE_COLOR = 0xd43b3b;    // red
const TUBE_RADIUS = 0.012;

// Fibers (horizontal circles in the fundamental domain)
for (let i = 0; i <= N_GRID; i++) {
  const fiber = hopf.fiberAt(i / N_GRID);
  const tube = new CurveTube({
    curve: fiber,
    radius: TUBE_RADIUS,
    radiusFn: (t) => TUBE_RADIUS * hopf.stereoScale(fiber.evaluate(t)),
    color: FIBER_COLOR,
    showEndpoints: false,
    roughness: 0.2,
    metalness: 0.5,
  });
  app.scene.add(tube);
}

// Edges (vertical edges in the fundamental domain)
for (let i = 0; i <= N_GRID; i++) {
  const edge = hopf.edgeAt(i / N_GRID);
  const tube = new CurveTube({
    curve: edge,
    radius: TUBE_RADIUS,
    radiusFn: (t) => TUBE_RADIUS * hopf.stereoScale(edge.evaluate(t)),
    color: EDGE_COLOR,
    showEndpoints: false,
    roughness: 0.2,
    metalness: 0.5,
  });
  app.scene.add(tube);
}

app.start();
