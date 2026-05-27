/**
 * Pseudosphere reconstructed from the sine-Gordon 1-soliton.
 *
 * The angle function ω(u, v) = 4 arctan(exp(u + v)) solves ω_uv = sin ω
 * on the domain u + v < 0. Integrating the moving frame for this ω on a
 * Chebyshev net produces the classical K = -1 surface of revolution.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SineGordonSurface, PseudosphereOmega } from '@/math/sine-gordon';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';

// --- App setup ---

const app = new App({ antialias: true });
app.camera.position.set(4, 2, 4);
app.controls.target.set(0.5, -0.5, 0);
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

const N = 128;
const omega = new PseudosphereOmega();
const surface = new SineGordonSurface({
  omega,
  uMin: -3, uMax: -0.1,
  vMin: -3, vMax: -0.1,
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
// `tip` controls how far down the axial direction we integrate (u + v → -∞).
// `edge` controls how close to the cuspidal equator u + v = 0 the surface
// approaches.  Both bounds are kept symmetric in u and v.

app.overlay.addSlider({
  label: 'tip',
  min: -5, max: -1, step: 0.05, value: -3,
  format: (v) => `tip = ${v.toFixed(2)}`,
  onChange: (v) => {
    surface.uMin = v;
    surface.vMin = v;
  },
});

app.overlay.addSlider({
  label: 'edge',
  min: -0.5, max: -0.02, step: 0.005, value: -0.1,
  format: (v) => `edge = ${v.toFixed(3)}`,
  onChange: (v) => {
    surface.uMax = v;
    surface.vMax = v;
  },
});

app.start();
