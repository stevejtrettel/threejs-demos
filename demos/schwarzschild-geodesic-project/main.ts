/**
 * Individual light geodesics around a black hole, with their projection to the
 * spatial plane.
 *
 * A family of null rays (a sweep of impact parameters) is fired past a
 * Schwarzschild black hole. Each is drawn twice:
 *   • as a curve in the (2+1) spacetime — bending in space while climbing in
 *     coordinate time (height), steeply near the hole where light slows;
 *   • as its shadow on the floor — the spatial light path it projects to.
 *
 * Rays under the critical impact parameter b = 3√3·M ≈ 5.2 spiral into the
 * hole (their spacetime curve winds up the horizon worldline); above it they
 * swing past and escape. Built on `traceOpticalRay`: the spacetime curve lifts
 * each point by coordinate time t, the shadow drops it to the plane.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Schwarzschild, traceOpticalRay } from '@/math/relativity';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const MASS = 1;
const rH = 2 * MASS;
const TIME_SCALE = 0.4;

const bh = new Schwarzschild({ mass: MASS, extent: 44 });
const optical = bh.chart('optical');
const data = bh.staticData();

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(16, 12, 20);
app.controls.target.set(0, 4, 0);
app.controls.update();
applyStage(app);

// --- Black hole: spatial disk (floor) + horizon worldline (cylinder) ---------

const T_TOP = 12;
app.scene.add(new THREE.Mesh(
  new THREE.CylinderGeometry(rH, rH, T_TOP * 2, 48, 1, true),
  matte(PALETTE.ink, { roughness: 0.7, side: THREE.DoubleSide }),
));
{
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(rH, 48),
    matte(PALETTE.ink, { roughness: 0.8, side: THREE.DoubleSide }),
  );
  disk.rotateX(-Math.PI / 2);
  disk.position.y = 0.01;
  app.scene.add(disk);
}

// Floor grid (the spatial plane the rays project onto).
{
  const grid = new THREE.GridHelper(60, 30, PALETTE.slate, mixHex(PALETTE.slate, PALETTE.surface, 0.55));
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  app.scene.add(grid);
}

// --- Geodesics + shadows ----------------------------------------------------

const START_X = -11;
const IMPACT_PARAMETERS = [1, 3, 4.5, 5.196, 6.5, 9];

const rayMat = matte(LIGHTRAY, { roughness: 0.6 });
const capMat = matte(mixHex(LIGHTRAY, PALETTE.ink, 0.2), { roughness: 0.5 });
const shadowMat = matte(mixHex(PALETTE.slate, PALETTE.ink, 0.25), { roughness: 0.85 });

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(points.length, 1200), radius, 8, false), mat);
}

for (const b of IMPACT_PARAMETERS) {
  const ray = traceOpticalRay(optical, [START_X, b], [1, 0], {
    steps: 520,
    dt: 0.04,
    lapseSq: (xy) => data.lapseSq(xy),
    stop: (xy) => Math.hypot(xy[0], xy[1]) > 40,
  });

  const spacetime: THREE.Vector3[] = [];
  const shadow: THREE.Vector3[] = [];
  for (let k = 0; k < ray.x.length; k++) {
    spacetime.push(new THREE.Vector3(ray.x[k], ray.t[k] * TIME_SCALE, ray.y[k]));
    shadow.push(new THREE.Vector3(ray.x[k], 0.02, ray.y[k]));
  }

  app.scene.add(tube(spacetime, 0.08, rayMat));
  app.scene.add(tube(shadow, 0.05, shadowMat));

  // End caps on the spacetime curve.
  for (const end of [spacetime[0], spacetime[spacetime.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), capMat);
    cap.position.copy(end);
    app.scene.add(cap);
  }

  // A few faint risers tying the curve to its shadow.
  for (let k = 0; k < spacetime.length; k += Math.max(1, Math.floor(spacetime.length / 7))) {
    const a = spacetime[k];
    const riser = tube([new THREE.Vector3(a.x, 0.02, a.z), a], 0.012,
      matte(mixHex(PALETTE.slate, PALETTE.surface, 0.3), { roughness: 0.9 }));
    app.scene.add(riser);
  }
}

app.start();
