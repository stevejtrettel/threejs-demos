/**
 * Schwarzschild light cones in ingoing Eddington–Finkelstein coordinates —
 * the cones tipping *through* the horizon.
 *
 * Unlike standard coordinates (which are singular at r = 2M, so cones freeze
 * there), the ingoing EF chart is regular across the horizon. Full spacetime
 * null geodesics cross it smoothly, so a row of future light cones emitted at
 * decreasing radius tips over more and more:
 *
 *   far out  → nearly upright;   nearer  → leaning inward;
 *   just outside the horizon → outgoing edge vertical (marginally trapped),
 *   and rays cross r = 2M and fall toward the centre.
 *
 * Cones are emitted *outside* the horizon (a ring sampled by spatial direction
 * is only well-defined there); their inward rays then carry the picture across.
 * Plotted as a spacetime diagram: space flat, EF time t̃ up.
 *
 * Flows through `Schwarzschild.chart('eddingtonFinkelstein')` → `sampleLightCone`
 * → `lightConeGeometry`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Schwarzschild, sampleLightCone, lightConeGeometry } from '@/math/relativity';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const MASS = 1;
const rH = 2 * MASS;
const TIME_SCALE = 0.5;
const T_MAX = 11;          // affine/time cutoff for each cone
const R_FLOOR = 1.0;       // stop rays here (well inside; avoids the r→0 stiff region)

const bh = new Schwarzschild({ mass: MASS, extent: 40, timeScale: TIME_SCALE });
const ef = bh.chart('eddingtonFinkelstein');

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(19, 10, 18);
app.controls.target.set(4, 3, 0);
app.controls.update();
applyStage(app);

// Horizon worldline (cylinder r = 2M up the EF-time axis).
const tTop = T_MAX * TIME_SCALE;
app.scene.add(new THREE.Mesh(
  new THREE.CylinderGeometry(rH, rH, tTop * 2.2, 56, 1, true),
  matte(PALETTE.ink, { roughness: 0.7, side: THREE.DoubleSide }),
));

// Faint spatial-plane grid.
{
  const grid = new THREE.GridHelper(40, 20, PALETTE.slate, mixHex(PALETTE.slate, PALETTE.surface, 0.55));
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  app.scene.add(grid);
}

// --- A row of cones marching toward the horizon -----------------------------

const coneMat = matte(LIGHTRAY, { roughness: 0.85, side: THREE.DoubleSide });
const EVENT_RADII = [9, 6, 4, 3, 2.4, 2.1];

for (const r of EVENT_RADII) {
  const rays = sampleLightCone(ef, [0, r, 0], {
    rays: 128,
    steps: 360,
    dt: 0.025,
    stop: (c) => {
      const rr = Math.hypot(c[1], c[2]);
      return rr < R_FLOOR || rr > 14 || c[0] > T_MAX;
    },
  });
  app.scene.add(new THREE.Mesh(lightConeGeometry(rays), coneMat));

  // Emission-event marker.
  app.scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
  )).position.set(r, 0, 0);
}

app.start();
