/**
 * Surface of revolution from an ODE profile solved by quadrature.
 *
 * Profile curve in the (r, h) half-plane:
 *   r(u) = asin(1/u)
 *   h'(u) = √(u² − 2) / (u² − 1)
 *
 * Parameter u ∈ [√2, uMax].  Revolved around the h-axis.
 *
 * --- Euclidean case (commented out) ---
 *   r(u) = 1/u
 *   h'(u) = (1/u) √(1 − 1/u²)
 *   Parameter u ∈ [1, uMax].
 */

import { App } from '@/app/App';
import { SurfaceMesh, integrate } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

// --- Scene ---

const app = new App({ antialias: true, debug: true, fov: 40 });
app.camera.position.set(0, 2, 5);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, 3, 4);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// --- Profile curve (solved by quadrature) ---

const NUM_STEPS = 400;

const U_MIN = Math.sqrt(2);

function solveProfile(uMax: number) {
//   const { states, times } = integrate({
//     deriv: (_state: number[], t: number) => {
//       const u = U_MIN + t;
//       const u2 = u * u;
//       return [Math.sqrt(Math.max(0, u2 - 2)) / (u2 - 1)];
//     },
//     initial: [0],
//     dt: (uMax - U_MIN) / NUM_STEPS,
//     steps: NUM_STEPS,
//   });

//   // Profile: (r, h) from u=√2 to u=uMax
//   return states.map(([h], i) => {
//     const u = U_MIN + times[i];
//     const r = Math.asin(1 / u);
//     return new THREE.Vector3(r, h, 0);
//   });

 // --- Euclidean case ---
  const { states, times } = integrate({
    deriv: (_state: number[], t: number) => {
      const u = 1 + t;
      const u2 = u * u;
      return [(1 / u) * Math.sqrt(Math.max(0, 1 - 1 / u2))];
    },
    initial: [0],
    dt: (uMax - 1) / NUM_STEPS,
    steps: NUM_STEPS,
  });
  return states.map(([h], i) => {
    const u = 1 + times[i];
    const r = 1 / u;
    return new THREE.Vector3(r, h, 0);
  });
}

const initialUMax = 6;
const initialPoints = solveProfile(initialUMax);

const profileCurve = new NumericalCurve({
  points: initialPoints,
  closed: false,
  curveType: 'catmullrom',
  tension: 0.5,
});

// --- Surface of revolution ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const p = profileCurve.evaluate(v);
    return new THREE.Vector3(
      p.x * Math.cos(u),
      p.y,
      -p.x * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 1 };
  },
};

const mesh = new SurfaceMesh(surface, {
  roughness: 0.4,
  metalness: 0.1,
  color: 0x4488cc,
  uSegments: 96,
  vSegments: 96,
});

app.scene.add(mesh);

// --- Rebuild for a given uMax ---

function setUMax(uMax: number) {
  const points = solveProfile(uMax);
  profileCurve.updatePoints(points);
  mesh.rebuild();
}

// --- Slider ---

app.overlay.addSlider({
  label: 'uMax',
  min: 2, max: 20, step: 0.1, value: initialUMax,
  format: (v) => `uMax = ${v.toFixed(1)}`,
  onChange: setUMax,
});

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
