/**
 * mesh-relax — quad-grid napkin with stretch + shear + bend springs.
 *
 * Build a square grid of quads in the xy-plane. Capture three families of
 * springs from the current (flat) layout — together they freeze the
 * intrinsic metric *and* the bending stiffness:
 *   - `stretchSprings` (edge springs)         — resist edge-length change
 *   - `shearSprings`  (quad diagonals)        — resist quad shear collapse
 *   - `bendSprings`   (across-the-fold pairs) — resist surface bending
 *
 * Then lift the embedding to a paraboloid + small noise and let the
 * `Physics` evolver dynamically relax it. Inertia, drag and the three
 * spring families together give the soft, settling cloth-like motion
 * the legacy "napkin" demo had.
 *
 * No constraints, no gravity — the sheet just relaxes back to flat.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import type { ParsedMesh } from '@/math/mesh/parseOBJ';
import { Embedding } from '@/math/mesh/Embedding';
import { MeshView } from '@/math/mesh/MeshView';
import { stretchSprings } from '@/math/mesh/energy/builders/stretchSprings';
import { shearSprings } from '@/math/mesh/energy/builders/shearSprings';
import { bendSprings } from '@/math/mesh/energy/builders/bendSprings';
import { SpringEnergy } from '@/math/mesh/energy/SpringEnergy';
import { Physics } from '@/math/mesh/evolvers/Physics';

// --- Build an N×N quad grid in the xy-plane ------------------------------

function buildQuadGrid(N: number, size: number): ParsedMesh {
  const vertices: THREE.Vector3[] = [];
  const faces: number[][] = [];

  const step = size / (N - 1);
  const half = size / 2;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      vertices.push(new THREE.Vector3(-half + i * step, -half + j * step, 0));
    }
  }

  const idx = (i: number, j: number) => j * N + i;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      // CCW quad: (i,j), (i+1,j), (i+1,j+1), (i,j+1)
      faces.push([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)]);
    }
  }

  return { vertices, faces };
}

// --- Pipeline -----------------------------------------------------------

const N = 20;
const SIZE = 4;

const grid = buildQuadGrid(N, SIZE);
const emb = Embedding.fromOBJ(grid);

// Capture all three spring families from the FLAT reference. Densities
// roughly match a soft cloth: stretch >> shear > bend.
const stretchK = 30;
const shearK = 10;
const bendK = 5;

const allSprings = [
  ...stretchSprings(emb, stretchK),
  ...shearSprings(emb, shearK),
  ...bendSprings(emb, bendK),
];
const energy = new SpringEnergy(allSprings);

// Lift the embedding into a paraboloid.
const curvature = 0.30;
for (let k = 0; k < emb.N; k++) {
  const a = 3 * k;
  const x = emb.positions[a];
  const y = emb.positions[a + 1];
  emb.positions[a + 2] = curvature * (x * x + y * y);
}

// Physics: light vertices + moderate drag → springy cloth that settles
// in a couple of oscillations.
const evolver = new Physics(emb, energy, { mass: 0.5, drag: 2 });

// --- App + scene -------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(4, 5, 6);
app.controls.target.set(0, 0, 0.5);

app.scene.background = new THREE.Color(0xeae4d8);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(3, 6, 4);
app.scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xb8c8d8, 0.6);
fillLight.position.set(-4, 2, -3);
app.scene.add(fillLight);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// --- View + animation --------------------------------------------------

const meshView = new MeshView(emb, { face: { color: 0xd9603a } });
app.scene.add(meshView);

// Brief pause so the bent state is visible before the dynamics start.
// dt = 0.05 matches the legacy PhysicsFlow's order of magnitude — much
// bigger than gradient-descent territory, but well inside the
// explicit-Euler stability bound for these spring stiffnesses.
const dt = 0.05;
const startDelay = 0.5;
let elapsed = 0;

app.addAnimateCallback((_time, delta) => {
  elapsed += delta;
  if (elapsed < startDelay) {
    meshView.sync();
    return;
  }
  evolver.step(dt);
  meshView.sync();
});

app.start();

// Print spring counts so you can see what you're getting.
// eslint-disable-next-line no-console
console.log(
  `mesh-relax: ${emb.N} verts, ${emb.mesh.faces.length} quads, ` +
  `${allSprings.length} springs ` +
  `(stretch ${stretchSprings(emb, 1).length}, ` +
  `shear ${shearSprings(emb, 1).length}, ` +
  `bend ${bendSprings(emb, 1).length})`,
);
