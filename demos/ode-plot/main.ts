/**
 * ODE Plot
 *
 * 2D plot of an ODE solution curve.
 * Edit the ODE below and reload to see a different curve.
 *
 * Default: profile curve for a K = +1 surface of revolution.
 * State = [r, r', y]. Plots r (horizontal) vs y (vertical).
 */

import { App } from '@/app/App';
import { integrate, CurveTube } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import * as THREE from 'three';

// --- Scene (2D view) ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 8);
app.controls.target.set(0, 0, 0);

// Light from camera direction so the flat curve is well-lit
const light = new THREE.PointLight(0xffffff, 40);
light.position.set(0, 0, 8);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
app.backgrounds.setColor(0xffffff);

// --- ODE: edit this! ---
//
// State = [r, r', y]. deriv returns [dr/ds, dr'/ds, dy/ds].
const deriv = ([r, rp]: number[]) => [
  rp,
  -r,
  1,
];

const initialState = [0, 1, 0];
const dt = Math.PI / 400;
const steps = 1200;

// Which state components to plot?
const toPoint = ([r, , y]: number[]) => ({ x: r, y });

// --- Solve ---

const { states } = integrate({ deriv, initial: initialState, dt, steps });

// Center and scale to fit in view
const yStart = toPoint(states[0]).y;
const yEnd = toPoint(states[states.length - 1]).y;
const yMid = (yStart + yEnd) / 2;

const points = states.map((s) => {
  const p = toPoint(s);
  return new THREE.Vector3(p.x, p.y - yMid, 0);
});

let maxR = 0;
for (const p of points) maxR = Math.max(maxR, p.length());
if (maxR > 0) for (const p of points) p.multiplyScalar(3 / maxR);

// --- Render ---

const curve = new NumericalCurve({ points, closed: false, curveType: 'catmullrom', tension: 0.5 });

const tube = new CurveTube({
  curve,
  radius: 0.025,
  tubularSegments: Math.min(points.length, 2000),
  radialSegments: 6,
  showEndpoints: false,
  color: 0xffaa33,
  roughness: 0.3,
});

app.scene.add(tube);

// --- Animate ---

app.start();
