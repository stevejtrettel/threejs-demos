/**
 * Asymmetric K = -1 surface via the Goursat problem.
 *
 * The left edge u = uMin carries the unperturbed pseudosphere 1-soliton
 * ω(uMin, v) = 4 arctan(exp(uMin + v)). The bottom edge v = vMin carries
 * the pseudosphere value plus a smooth Gaussian bump in u. With bump
 * strength = 0 the Goursat solver recovers the pseudosphere everywhere;
 * with strength ≠ 0 the perturbation propagates into the interior,
 * producing a K = -1 surface that agrees with the pseudosphere on the
 * left edge but diverges from it elsewhere.
 *
 * The bump envelope vanishes at u = uMin to enforce corner consistency
 * with the (unperturbed) left edge.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SineGordonSurface, GoursatOmega } from '@/math/sine-gordon';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';

// --- Domain & resolution ---

const uMin = -3, uMax = -0.3;
const vMin = -3, vMax = -0.3;
const N = 200;

// --- Pseudosphere baseline & bump perturbation ---

const pseudo = (u: number, v: number) => 4 * Math.atan(Math.exp(u + v));

let strength = 0.5;
let center = -1.5;
let width = 0.5;

function bump(u: number): number {
  // Envelope kills the bump at the (uMin, vMin) corner so that the
  // bottom-edge data matches the unperturbed left-edge data there.
  const envelope = 1 - Math.exp(-((u - uMin) * (u - uMin)) / 0.04);
  const gauss = Math.exp(-((u - center) * (u - center)) / (2 * width * width));
  return strength * envelope * gauss;
}

// --- ω and surface ---

const omega = new GoursatOmega({
  omegaBottomFn: (u) => pseudo(u, vMin) + bump(u),
  omegaLeftFn:   (v) => pseudo(uMin, v),
  uMin, uMax, vMin, vMax,
  Nu: N, Nv: N,
});

const surface = new SineGordonSurface({
  omega,
  uMin, uMax, vMin, vMax,
  Nu: N, Nv: N,
});

// The boundary closures capture `strength`, `center`, `width` by reference,
// so we just rebuild the chain explicitly. Sliders mutate locals (not Params)
// so the automatic cascade never fires — call all three rebuilds in order.
function refresh(): void {
  omega.rebuild();
  surface.rebuild();
  mesh.rebuild();
}

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
  label: 'bump strength',
  min: 0, max: 1.5, step: 0.01, value: strength,
  format: (v) => `strength = ${v.toFixed(2)}`,
  onChange: (v) => { strength = v; refresh(); },
});

app.overlay.addSlider({
  label: 'bump center',
  min: uMin + 0.3, max: uMax - 0.3, step: 0.02, value: center,
  format: (v) => `center = ${v.toFixed(2)}`,
  onChange: (v) => { center = v; refresh(); },
});

app.overlay.addSlider({
  label: 'bump width',
  min: 0.1, max: 1.0, step: 0.01, value: width,
  format: (v) => `width = ${v.toFixed(2)}`,
  onChange: (v) => { width = v; refresh(); },
});

app.start();
