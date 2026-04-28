/**
 * m4-gaussK — intrinsic curvature of M⁴_L
 *
 * Left panel: M⁴_L visualization sphere colored by Gaussian curvature K(φ, t)
 * computed from `metric4` via Brioschi (handled by the library's
 * `gaussianCurvatureFromMetric`). Diverging white-red-blue colormap centered
 * at 0; non-finite cells render gray.
 *
 * Right panel: live 4-rod chain at the current (φ, t), built from
 * `psi4Position`. Drag the burgundy marker on the sphere to reposition.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, MetricSurface } from '@/math';
import { gaussianCurvatureFromMetric } from '@/math/surfaces/christoffel';
import { Matrix } from '@/math/linear-algebra';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- palette (matches m4-geodesic) ----------------------------------------

const BG       = 0xF0EDE8;
const BURGUNDY = 0xB02A3E;
const SILVER   = 0xD8D0C2;

// --- ψ4 embedding ----------------------------------------------------------

function psi4Position(phi: number, t: number, L: number): {
  p1: [number, number]; p2: [number, number]; p3: [number, number];
} {
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const theta = alpha * Math.sin(phi);

  const p3_re = L - Math.cos(theta);
  const p3_im =   - Math.sin(theta);
  const d     = Math.hypot(p3_re, p3_im);
  const p3_hat_re = p3_re / d;
  const p3_hat_im = p3_im / d;

  const c        = Math.cos(t);
  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const theta_in = alpha_in * Math.sin(t);

  const num   = 2 * d * (Math.cos(theta_in) - (d * d - 3) / (2 * d));
  const nu_in = Math.abs(c) < 1e-6
              ? Math.sign(c || 1) * Math.sqrt(d * alpha_in * Math.sin(alpha_in))
              : c * Math.sqrt(num / (c * c));

  const e_re   = Math.cos(theta_in);
  const e_im   = Math.sin(theta_in);
  const rot_re = p3_hat_re * e_re - p3_hat_im * e_im;
  const rot_im = p3_hat_re * e_im + p3_hat_im * e_re;
  const p2_re  = p3_re - rot_re;
  const p2_im  = p3_im - rot_im;
  const p2_abs = Math.hypot(p2_re, p2_im);

  const k     = nu_in / (2 * p2_abs);
  const p1_re = p2_re / 2 - k * p2_im;
  const p1_im = p2_im / 2 + k * p2_re;

  return { p1: [p1_re, p1_im], p2: [p2_re, p2_im], p3: [p3_re, p3_im] };
}

// --- analytic metric4 ------------------------------------------------------

function metric4(phi: number, t: number, L: number): { h_pp: number; h_pt: number; h_tt: number } {
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  const theta = alpha * sphi;
  const ctheta = Math.cos(theta);
  const stheta = Math.sin(theta);
  const d = Math.sqrt(L * L - 2 * L * ctheta + 1);
  const R = Math.atan2(-stheta, L - ctheta);
  const dthetaP = alpha * cphi;
  const ddP = (L * stheta / d) * dthetaP;
  const dRP = ((1 - L * ctheta) / (d * d)) * dthetaP;

  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const sin_ai = Math.sqrt(Math.max((d * d - 1) * (9 - d * d), 0)) / (2 * d);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const theta_in = alpha_in * st;
  const ctin = Math.cos(theta_in);

  const dthetainT = alpha_in * ct;
  const dalphainP = -((d * d + 3) / (2 * d * d * sin_ai)) * ddP;
  const dthetainP = dalphainP * st;

  const u4 = [ctheta, stheta];
  const u3_arg = R + theta_in;
  const u3 = [Math.cos(u3_arg), Math.sin(u3_arg)];
  const p2 = [(L - ctheta) - u3[0], -stheta - u3[1]];
  const p2_abs = Math.hypot(p2[0], p2[1]);

  const num = 2 * d * (ctin - (d * d - 3) / (2 * d));
  const nu_in = Math.abs(ct) < 1e-6
              ? Math.sign(ct || 1) * Math.sqrt(d * alpha_in * sin_ai * 2 * d)
              : ct * Math.sqrt(num / (ct * ct));

  const dt_p2: [number, number] = [u3[1] * dthetainT, -u3[0] * dthetainT];
  const c1 = dthetaP, c2 = dRP + dthetainP;
  const dphi_p2: [number, number] = [u4[1] * c1 + u3[1] * c2, -(u4[0] * c1 + u3[0] * c2)];

  const Omega = (v: [number, number]): number => {
    const im = (p2[0] * v[1] - p2[1] * v[0]) / (p2_abs * p2_abs);
    const re = (p2[0] * v[0] + p2[1] * v[1]) / (p2_abs * nu_in);
    return im - re;
  };
  const Omega_t = Omega(dt_p2);
  const Omega_phi = Omega(dphi_p2);

  const u34_dot = u3[0] * u4[0] + u3[1] * u4[1];

  const h_tt = Omega_t * Omega_t + dthetainT * dthetainT;
  const h_pp = Omega_phi * Omega_phi
             + 2 * dthetaP * dthetaP
             + (dRP + dthetainP) * (dRP + dthetainP)
             + 2 * dthetaP * (dRP + dthetainP) * u34_dot;
  const h_pt = Omega_t * Omega_phi
             + dthetainT * (dthetaP * u34_dot + dRP + dthetainP);

  return { h_pp, h_pt, h_tt };
}

// --- domain & visualization sphere ----------------------------------------

const SPHERE_R = Math.PI;
const CONFIG_DOMAIN: SurfaceDomain = {
  uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI,
};

const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain: () => CONFIG_DOMAIN,
};

function buildPatch(L: number): MetricSurface {
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi: number, t: number): Matrix => {
      const { h_pp, h_pt, h_tt } = metric4(phi, t, L);
      const m = new Matrix(2, 2);
      m.data[0] = h_pp; m.data[1] = h_pt; m.data[2] = h_pt; m.data[3] = h_tt;
      return m;
    },
    display: sphereSurface,
  });
}

// --- field grid ------------------------------------------------------------

const GRID_N = 256;

function buildKGrid(L: number): {
  data: Float32Array; scalePos: number; scaleNeg: number; min: number; max: number;
} {
  const patch = buildPatch(L);
  const data = new Float32Array(GRID_N * GRID_N);
  const samples: number[] = [];

  for (let j = 0; j < GRID_N; j++) {
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;
    for (let i = 0; i < GRID_N; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      const k = gaussianCurvatureFromMetric(patch, phi, tVal);
      data[j * GRID_N + i] = Number.isFinite(k) ? k : NaN;
      if (Number.isFinite(k)) samples.push(k);
    }
  }

  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 0;

  // Separate scales for positive and negative K: K is asymmetric (mostly
  // positive on a topological sphere), so a single |K|-percentile scale
  // crushes the negative side. With per-sign scales both halves of the
  // colormap reach saturation.
  const pos = samples.filter((v) => v > 0);
  const neg = samples.filter((v) => v < 0).map((v) => -v).sort((a, b) => a - b);
  const scalePos = pos[Math.floor(pos.length * 0.98)] ?? 1;
  const scaleNeg = neg.length > 0 ? (neg[Math.floor(neg.length * 0.98)] ?? scalePos) : scalePos;
  return { data, scalePos: scalePos || 1, scaleNeg: scaleNeg || 1, min: lo, max: hi };
}

function makeFieldTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, GRID_N, GRID_N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// --- scene -----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 14);
(app.camera as THREE.PerspectiveCamera).fov = 25;
(app.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 5, 6);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffe6c4, 0.6);
fill.position.set(-5, -2, 4);
app.scene.add(fill);

// --- left: K-colored sphere -----------------------------------------------

const fragmentShader = `
uniform sampler2D uK;
uniform float uKScalePos;
uniform float uKScaleNeg;

void main() {
  float k = texture2D(uK, vMapUv).r;
  if (!(k == k)) {
    csm_DiffuseColor = vec4(0.55, 0.55, 0.55, 1.0);
    csm_Emissive = vec3(0.0);
    return;
  }
  float s;
  if (k >= 0.0) s =  clamp( k / uKScalePos, 0.0, 1.0);
  else          s = -clamp(-k / uKScaleNeg, 0.0, 1.0);
  float ss = sign(s) * pow(abs(s), 0.2);
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 red   = vec3(0.85, 0.05, 0.10);
  vec3 blue  = vec3(0.05, 0.20, 0.85);
  vec3 color = ss >= 0.0 ? mix(white, red, ss) : mix(white, blue, -ss);
  // Push the color into emissive so PBR lighting doesn't mute it.
  csm_DiffuseColor = vec4(color, 1.0);
  csm_Emissive = color * 0.85;
}
`;

let L = 3.0;
const initial = buildKGrid(L);

const uniforms: Record<string, { value: any }> = {
  uK: { value: makeFieldTexture(initial.data) },
  uKScalePos: { value: initial.scalePos },
  uKScaleNeg: { value: initial.scaleNeg },
};

const SPHERE_PANEL_SCALE = 0.40;
const sphereGroup = new THREE.Group();
sphereGroup.position.set(-2.9, 0, 0);
sphereGroup.scale.setScalar(SPHERE_PANEL_SCALE);
app.scene.add(sphereGroup);

const sphereMesh = new SurfaceMesh(sphereSurface, {
  uSegments: 96,
  vSegments: 192,
  roughness: 0.4,
  metalness: 0.05,
  fragmentShader,
  uniforms,
});
sphereGroup.add(sphereMesh);

const markerBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
);
sphereGroup.add(markerBall);

// --- right: 4-rod chain ---------------------------------------------------

const CHAIN_SCALE = 1.55;
const chainGroup = new THREE.Group();
chainGroup.position.set(1.7, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS    = 0.05;
const JOINT_RADIUS  = 0.10;
const PINNED_RADIUS = 0.13;

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER, roughness: 0.32, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.25,
});
const ballMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18,
});

const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 16, 1);
const rod1 = new THREE.Mesh(rodGeo, rodMat);
const rod2 = new THREE.Mesh(rodGeo, rodMat);
const rod3 = new THREE.Mesh(rodGeo, rodMat);
const rod4 = new THREE.Mesh(rodGeo, rodMat);
chainGroup.add(rod1, rod2, rod3, rod4);

const pinSphereGeo   = new THREE.SphereGeometry(PINNED_RADIUS, 24, 24);
const jointSphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 24, 24);
const pinA   = new THREE.Mesh(pinSphereGeo, ballMat);
const pinB   = new THREE.Mesh(pinSphereGeo, ballMat);
const joint1 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint2 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint3 = new THREE.Mesh(jointSphereGeo, ballMat);
chainGroup.add(pinA, pinB, joint1, joint2, joint3);

const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- state -----------------------------------------------------------------

let phi = 0;
let t = Math.PI / 2; // off the σ-flip meridians

function applyConfig() {
  markerBall.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );

  const { p1, p2, p3 } = psi4Position(phi, t, L);
  const dx = -L / 2;
  const ax = 0 + dx,     ay = 0;
  const px = p1[0] + dx, py = p1[1];
  const qx = p2[0] + dx, qy = p2[1];
  const rx = p3[0] + dx, ry = p3[1];
  const bx = L + dx,     by = 0;

  pinA.position.set(ax, ay, 0);
  pinB.position.set(bx, by, 0);
  joint1.position.set(px, py, 0);
  joint2.position.set(qx, qy, 0);
  joint3.position.set(rx, ry, 0);
  placeRod(rod1, ax, ay, px, py);
  placeRod(rod2, px, py, qx, qy);
  placeRod(rod3, qx, qy, rx, ry);
  placeRod(rod4, rx, ry, bx, by);
}

function rebuildField() {
  const { data, scalePos, scaleNeg, min, max } = buildKGrid(L);
  (uniforms.uK.value as THREE.DataTexture).dispose();
  uniforms.uK.value = makeFieldTexture(data);
  uniforms.uKScalePos.value = scalePos;
  uniforms.uKScaleNeg.value = scaleNeg;
  rangeReadout.textContent = `K ∈ [${min.toFixed(2)}, ${max.toFixed(2)}]`;
}

applyConfig();

// --- drag interaction (read uv directly off the SurfaceMesh hit) ----------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function uvToConfig(uv: THREE.Vector2) {
  phi = CONFIG_DOMAIN.uMin + uv.x * (CONFIG_DOMAIN.uMax - CONFIG_DOMAIN.uMin);
  t   = CONFIG_DOMAIN.vMin + uv.y * (CONFIG_DOMAIN.vMax - CONFIG_DOMAIN.vMin);
  applyConfig();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  if (hits.length === 0 || !hits[0].uv) return;
  dragging = true;
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  uvToConfig(hits[0].uv);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  if (hits.length > 0 && hits[0].uv) uvToConfig(hits[0].uv);
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- HUD -------------------------------------------------------------------

const sliderStyle = document.createElement('style');
sliderStyle.textContent = `
  .thin-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; margin: 0; background: transparent; outline: none; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
  .thin-slider::-webkit-slider-runnable-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-moz-range-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider:focus { outline: none; }
`;
document.head.appendChild(sliderStyle);

const rangeReadout = document.createElement('div');
rangeReadout.style.cssText =
  'position:fixed;top:16px;right:16px;color:#333;font:13px/1 monospace;' +
  'pointer-events:none;z-index:10;';
rangeReadout.textContent = `K ∈ [${initial.min.toFixed(2)}, ${initial.max.toFixed(2)}]`;
document.body.appendChild(rangeReadout);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:16px;right:16px;width:280px;padding:8px 10px;' +
  'background:transparent;pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <input id="gk-L" type="range" class="thin-slider" min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const slider = sliderWrap.querySelector<HTMLInputElement>('#gk-L')!;

slider.addEventListener('input', () => {
  L = parseFloat(slider.value);
  rebuildField();
  applyConfig();
});

app.start();
