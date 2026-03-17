/**
 * Elliptic Curve via Weierstrass ℘
 *
 * The surface (℘(z), ℘'(z)) ⊂ ℂ² projected to ℝ³,
 * parameterized by z in the fundamental parallelogram.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { EllipticCurveMesh } from '@/math/surfaces/EllipticCurveMesh';
import { Lattice2D } from '@/math/lattices/Lattice2D';

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 2, 4);
app.controls.target.set(0, 0, 0);

app.scene.background = new THREE.Color(0x111111);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Elliptic curve surface ---

const curve = new EllipticCurveMesh({
  lattice: new Lattice2D([1, 0], [0.5, Math.sqrt(3) / 2]), // hexagonal
  resolution: 120,
  boundingSize: 10,
  projectionMode: 0,   // (Re ℘, Im ℘, Re ℘')
  dpScale: 0.05,
  outputScale: 0.15,
  holeRadius: 0.04,
  color: 0x4488ff,
  roughness: 0.3,
  metalness: 0.1,
});

app.scene.add(curve);

// --- Try different lattices ---
// Uncomment to switch:
//   Square lattice:     new Lattice2D([1, 0], [0, 1])
//   Rectangular:        new Lattice2D([1, 0], [0, 1.5])
//   Skewed:             new Lattice2D([1, 0], [0.3, 1.2])

app.start();
