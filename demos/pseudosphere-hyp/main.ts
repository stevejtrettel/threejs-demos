/**
 * Pseudosphere embedded in H³, visualised in the Poincaré ball.
 *
 * Profile curve in (r, h) coordinates, parameterised by u ∈ [uMin, uMax]:
 *   r(u) = arcsinh(1/u)
 *   h'(u) = u / √(1 + u²)
 *
 * H³ upper-half-space embedding  (h, r, θ) ↦
 *   x = eʰ tanh(r) cos θ
 *   y = eʰ tanh(r) sin θ
 *   z = eʰ / cosh(r)
 *
 * Cayley transform to Poincaré ball:
 *   (x, y, z) ↦ (2x, 2y, x²+y²+z²−1) / (x²+y²+(z+1)²)
 */

import { App } from '@/app/App';
import { SurfaceMesh, integrate } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

// --- Scene ---

const app = new App({ antialias: true, debug: true, fov: 40 });
app.camera.position.set(0, 3, 6);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, 3, 4);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// --- Profile curve (h solved by quadrature, r closed-form) ---

const NUM_STEPS = 3000;
const U_MIN = 0.01;

function solveProfile(uMax: number) {
  const { states, times } = integrate({
    deriv: (_state: number[], t: number) => {
      const u = U_MIN + t;
      return [u / Math.sqrt(1 + u * u)];
    },
    initial: [0],
    dt: (uMax - U_MIN) / NUM_STEPS,
    steps: NUM_STEPS,
  });

  return states.map(([h], i) => {
    const u = U_MIN + times[i];
    const r = Math.asinh(1 / u);
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

// --- Surface: H³ upper-half-space embedding + Cayley transform ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const p = profileCurve.evaluate(v); // p.x = r, p.y = h
    const r = p.x;
    const h = p.y;
    const theta = u;

    // Upper half space
    const eh = Math.exp(h);
    const tanhr = Math.tanh(r);
    const coshr = Math.cosh(r);
    const x = eh * tanhr * Math.cos(theta);
    const y = eh * tanhr * Math.sin(theta);
    const z = eh / coshr;

    // Cayley transform to Poincaré ball
    const rr = x * x + y * y;
    const denom = rr + (z + 1) * (z + 1);
    return new THREE.Vector3(
      2 * x / denom,
      2 * y / denom,
      (rr + z * z - 1) / denom,
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
  vSegments: 1024,
});

app.scene.add(mesh);

// --- Rebuild helpers ---

let currentUMax = initialUMax;

function rebuild() {
  const points = solveProfile(currentUMax);
  profileCurve.updatePoints(points);
  mesh.rebuild();
}

// --- Slider ---

app.overlay.addSlider({
  label: 'uMax',
  min: 0.5, max: 20, step: 0.1, value: initialUMax,
  format: (v) => `uMax = ${v.toFixed(1)}`,
  onChange: (v) => { currentUMax = v; rebuild(); },
});

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
