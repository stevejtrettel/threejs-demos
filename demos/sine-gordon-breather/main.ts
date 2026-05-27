/**
 * Sine-Gordon breather as a K = -1 surface.
 *
 * The breather is a spatially localized, "time"-periodic ω-solution; as
 * an immersion it exhibits cuspidal-edge folds along the curves where ω
 * crosses 0 or π. Slider controls the breather mass m ∈ (0, 1), with
 * n = √(1 − m²).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SineGordonSurface, BreatherOmega } from '@/math/sine-gordon';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';

// --- App setup ---

const app = new App({ antialias: true });
app.camera.position.set(0, 2, 6);
app.controls.target.set(0, 0, 0);
app.controls.update();

app.scene.background = new THREE.Color(0x111111);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Surface ---

const N = 160;
const omega = new BreatherOmega({ m: 0.5 });
const surface = new SineGordonSurface({
  omega,
  uMin: -4, uMax: 4,
  vMin: -4, vMax: 4,
  Nu: N, Nv: N,
});

const mesh = new SurfaceMesh(surface, {
  uSegments: N - 1,
  vSegments: N - 1,
  color: 0xc9eaff,
  roughness: 0.35,
  metalness: 0.05,
});
app.scene.add(mesh);

// --- Slider for m ---

app.overlay.addSlider({
  label: 'm',
  min: 0.1, max: 0.95, step: 0.01, value: 0.5,
  format: (v) => `m = ${v.toFixed(2)}`,
  onChange: (v) => { omega.m = v; },
});

app.start();
