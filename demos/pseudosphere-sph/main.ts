/**
 * Pseudosphere embedded in S³(R), stereographically projected to R³.
 *
 * Profile curve in (r, h) coordinates, parameterised by u ∈ [uMin, uMax]:
 *   r(u) = R arcsin(1/(Ru))
 *   h'(u) = R √(R²u² − (1+R²)) / (R²u² − 1)
 *   uMin = √(1 + 1/R²)
 *
 * S³(R) embedding  (r, h, θ) ↦ R·(cos r cos h,  cos r sin h,  sin r cos θ,  sin r sin θ)
 *
 * Stereographic projection from pole (0,0,0,R):
 *   (x₁, x₂, x₃, x₄) ↦ R·(x₁, x₂, x₃) / (R − x₄)
 *
 * The core circle (r=0) maps to the unit circle in the xy-plane (radius R).
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

let R = 1;

function uMinForR(R: number) {
  return Math.sqrt(1 + 1 / (R * R));
}

function solveProfile(uMax: number) {
  const uMin = uMinForR(R);
  const R2 = R * R;

  const { states, times } = integrate({
    deriv: (_state: number[], t: number) => {
      const u = uMin + t;
      const R2u2 = R2 * u * u;
      return [R * Math.sqrt(Math.max(0, R2u2 - (1 + R2))) / (R2u2 - 1)];
    },
    initial: [0],
    dt: (uMax - uMin) / NUM_STEPS,
    steps: NUM_STEPS,
  });

  // Profile points: x = r, y = h
  return states.map(([h], i) => {
    const u = uMin + times[i];
    const r = R * Math.asin(1 / (R * u));
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

// --- Surface: S³(R) embedding + stereographic projection ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const p = profileCurve.evaluate(v); // p.x = r, p.y = h
    const r = p.x;
    const h = p.y;
    const theta = u;

    // Place on unit S³ using R-dependent angles, then stereographic project
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const x4 = sr * Math.sin(theta);
    const denom = 1 - x4;
    return new THREE.Vector3(
      cr * Math.cos(h) / denom,
      cr * Math.sin(h) / denom,
      sr * Math.cos(theta) / denom,
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

// --- Sliders ---

app.overlay.addSlider({
  label: 'uMax',
  min: 2, max: 10000, step: 0.5, value: initialUMax,
  format: (v) => `uMax = ${v.toFixed(1)}`,
  onChange: (v) => { currentUMax = v; rebuild(); },
});

app.overlay.addSlider({
  label: 'R',
  min: 0.001, max: 1, step: 0.001, value: R,
  format: (v) => `R = ${v.toFixed(3)}`,
  onChange: (v) => { R = v; rebuild(); },
});

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
