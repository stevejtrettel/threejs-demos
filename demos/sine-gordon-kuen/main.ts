/**
 * Sine-Gordon 2-soliton — the Kuen surface.
 *
 * Two solitons with spectral parameters λ₁, λ₂ superposed via the Bäcklund
 * permutability relation. Sliders adjust both λᵢ; the (λ₁, λ₂) → (λ₂, λ₁)
 * symmetry just permutes the two solitons, but as either parameter
 * approaches the other the prefactor (λ₁ + λ₂) / (λ₁ − λ₂) blows up.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SineGordonSurface, Kuen2Soliton } from '@/math/sine-gordon';
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
const omega = new Kuen2Soliton({ lambda1: 1.0, lambda2: 2.0 });
const surface = new SineGordonSurface({
  omega,
  uMin: -3, uMax: 3,
  vMin: -3, vMax: 3,
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

// --- Sliders ---

app.overlay.addSlider({
  label: 'lambda1',
  min: 0.3, max: 3.0, step: 0.01, value: 1.0,
  format: (v) => `λ₁ = ${v.toFixed(2)}`,
  onChange: (v) => {
    // Avoid the degenerate λ₁ = λ₂ ridge.
    if (Math.abs(v - omega.lambda2) > 1e-3) omega.lambda1 = v;
  },
});

app.overlay.addSlider({
  label: 'lambda2',
  min: 0.3, max: 3.0, step: 0.01, value: 2.0,
  format: (v) => `λ₂ = ${v.toFixed(2)}`,
  onChange: (v) => {
    if (Math.abs(v - omega.lambda1) > 1e-3) omega.lambda2 = v;
  },
});

app.start();
