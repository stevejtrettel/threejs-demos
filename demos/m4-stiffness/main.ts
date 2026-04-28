/**
 * m4-stiffness — directional-stiffness ellipse field on M⁴_L
 *
 * At quasi-uniform points on the visualization sphere we draw an ellipse
 * summarizing the (constant + 2ψ) Fourier modes of the directional
 * stiffness |II(v(ψ), v(ψ))|². Major axis = principal stiffness direction
 * (in the metric-orthonormal frame); semi-axes ∝ √max, √min of the
 * stiffness function. The 4ψ modes are dropped — they're what the ellipse
 * summary can't represent.
 *
 * Glyphs are an InstancedMesh of a thin ring (TorusGeometry); per-instance
 * matrices place each ring in the tangent plane with the right orientation
 * and anisotropic scale.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- palette ---------------------------------------------------------------

const BG       = 0xF0EDE8;
const BURGUNDY = 0xB02A3E;
const CREAM    = 0xE2D8C0;
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

// --- combined first + second fundamental forms (single 9-point stencil) ---

function firstAndSecondFundamentalForms(phi: number, t: number, L: number): {
  E: number; F: number; G: number;
  II_pp: number[]; II_pt: number[]; II_tt: number[];
} {
  const eps = 1e-4;
  const e2 = eps * eps;

  const Q = (ph: number, tt: number): number[] => {
    const { p1, p2, p3 } = psi4Position(ph, tt, L);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]];
  };

  const p   = Q(phi,       t      );
  const pPh = Q(phi + eps, t      );
  const pPl = Q(phi - eps, t      );
  const pTh = Q(phi,       t + eps);
  const pTl = Q(phi,       t - eps);
  const pPP = Q(phi + eps, t + eps);
  const pPN = Q(phi + eps, t - eps);
  const pNP = Q(phi - eps, t + eps);
  const pNN = Q(phi - eps, t - eps);

  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

  const dPp: number[] = new Array(6);
  const dTp: number[] = new Array(6);
  const dPPp: number[] = new Array(6);
  const dTTp: number[] = new Array(6);
  const dPTp: number[] = new Array(6);
  for (let i = 0; i < 6; i++) {
    dPp[i]  = (pPh[i] - pPl[i]) / (2 * eps);
    dTp[i]  = (pTh[i] - pTl[i]) / (2 * eps);
    dPPp[i] = (pPh[i] - 2 * p[i] + pPl[i]) / e2;
    dTTp[i] = (pTh[i] - 2 * p[i] + pTl[i]) / e2;
    dPTp[i] = (pPP[i] - pPN[i] - pNP[i] + pNN[i]) / (4 * e2);
  }

  const E = dot(dPp, dPp);
  const F = dot(dPp, dTp);
  const G = dot(dTp, dTp);
  const D = E * G - F * F;

  const projectNormal = (v: number[]): number[] => {
    const bP = dot(v, dPp);
    const bT = dot(v, dTp);
    const cP = (G * bP - F * bT) / D;
    const cT = (E * bT - F * bP) / D;
    const out: number[] = new Array(6);
    for (let i = 0; i < 6; i++) out[i] = v[i] - cP * dPp[i] - cT * dTp[i];
    return out;
  };

  return {
    E, F, G,
    II_pp: projectNormal(dPPp),
    II_pt: projectNormal(dPTp),
    II_tt: projectNormal(dTTp),
  };
}

// --- ellipse parameters (constant + 2ψ summary of |II(v,v)|²) -------------
//
// Returns:
//   psiMax   — angle (in metric-orthonormal frame) of max stiffness
//   maxStiff — max value of (constant + 2ψ) part of |II(v,v)|²
//   minStiff — min value (clamped at 0; can dip negative for hyperbolic II)
//   chartU   — principal direction in (φ̇, ṫ) chart components, unit-metric
//   chartW   — perpendicular direction in (φ̇, ṫ) chart components, unit-metric
//
// Relations:
//   const = (3|A|² + 3|C|² + 4|B|² + 2⟨A,C⟩) / 8
//   α     = (|A|² − |C|²) / 2
//   β     = ⟨A,B⟩ + ⟨B,C⟩
//   R     = √(α² + β²)
//   max   = const + R, min = const − R
//   2ψmax = atan2(β, α)
// where A = II_11, B = II_12, C = II_22 in the orthonormal frame.

interface EllipseParams {
  ok: boolean;
  psiMax: number;
  maxStiff: number;
  minStiff: number;
  chartU: [number, number];
  chartW: [number, number];
}

function ellipseAt(phi: number, t: number, L: number): EllipseParams {
  const { E, F, G, II_pp, II_pt, II_tt } = firstAndSecondFundamentalForms(phi, t, L);
  const D = E * G - F * F;
  if (!(D > 0) || !Number.isFinite(D)) {
    return { ok: false, psiMax: 0, maxStiff: 0, minStiff: 0, chartU: [0, 0], chartW: [0, 0] };
  }
  const sqrtD = Math.sqrt(D);

  // Orthonormal-frame components A, B, C ∈ ℝ⁶.
  const A: number[] = new Array(6);
  const B: number[] = new Array(6);
  const C: number[] = new Array(6);
  for (let i = 0; i < 6; i++) {
    A[i] = II_pp[i] / E;
    B[i] = -F / (E * sqrtD) * II_pp[i] + II_pt[i] / sqrtD;
    C[i] = (F * F) / (E * D) * II_pp[i] - (2 * F / D) * II_pt[i] + (E / D) * II_tt[i];
  }
  let A2 = 0, B2 = 0, C2 = 0, AB = 0, AC = 0, BC = 0;
  for (let i = 0; i < 6; i++) {
    A2 += A[i] * A[i];
    B2 += B[i] * B[i];
    C2 += C[i] * C[i];
    AB += A[i] * B[i];
    AC += A[i] * C[i];
    BC += B[i] * C[i];
  }

  const cnst  = (3 * A2 + 3 * C2 + 4 * B2 + 2 * AC) / 8;
  const alpha = (A2 - C2) / 2;
  const beta  = AB + BC;
  const R     = Math.hypot(alpha, beta);
  const max   = cnst + R;
  const min   = Math.max(0, cnst - R);
  const psiMax = 0.5 * Math.atan2(beta, alpha);

  // Convert principal direction to (φ̇, ṫ) chart components via the
  // metric-orthonormal frame {e1, e2}:
  //   e1_chart = (1/√E, 0)
  //   e2_chart = (-F/√(ED), √(E/D))
  const cP = Math.cos(psiMax), sP = Math.sin(psiMax);
  const inv_sqrtE = 1 / Math.sqrt(E);
  const e1_x = inv_sqrtE,                e1_y = 0;
  const e2_x = -F / Math.sqrt(E * D),    e2_y = Math.sqrt(E / D);
  // Principal:    cosψ·e1 + sinψ·e2
  // Perpendicular: -sinψ·e1 + cosψ·e2
  const chartU: [number, number] = [cP * e1_x + sP * e2_x, cP * e1_y + sP * e2_y];
  const chartW: [number, number] = [-sP * e1_x + cP * e2_x, -sP * e1_y + cP * e2_y];

  return {
    ok: Number.isFinite(cnst) && Number.isFinite(R),
    psiMax, maxStiff: max, minStiff: min, chartU, chartW,
  };
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

// --- Fibonacci sphere glyph centers ---------------------------------------

const N_GLYPHS = 150;
const POLE_MARGIN = 0.08; // radians; skip glyphs this close to ±π/2

interface GlyphCenter {
  phi: number;
  t: number;
  pos3D: THREE.Vector3;
  // Tangent-plane basis on the unit visualization sphere at (phi, t).
  // Round-sphere param tangents:
  //   ∂_φ = (-sin φ cos t, -sin φ sin t, cos φ)
  //   ∂_t = (-cos φ sin t, cos φ cos t, 0)
  dphi3D: THREE.Vector3;
  dt3D: THREE.Vector3;
  // Outward normal (sphere is unit, so just the position direction).
  normal3D: THREE.Vector3;
}

function buildFibonacciCenters(): GlyphCenter[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: GlyphCenter[] = [];
  for (let k = 0; k < N_GLYPHS; k++) {
    const z = 1 - (2 * k + 1) / N_GLYPHS;
    const phi = Math.asin(z);
    if (Math.abs(phi) > Math.PI / 2 - POLE_MARGIN) continue;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = k * golden;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const t = Math.atan2(y, x);
    const tWrapped = (t + 2 * Math.PI) % (2 * Math.PI);

    const cphi = Math.cos(phi), sphi = Math.sin(phi);
    const ct = Math.cos(tWrapped), st = Math.sin(tWrapped);

    out.push({
      phi, t: tWrapped,
      pos3D:    new THREE.Vector3(SPHERE_R * cphi * ct, SPHERE_R * cphi * st, SPHERE_R * sphi),
      dphi3D:   new THREE.Vector3(-sphi * ct, -sphi * st, cphi),
      dt3D:     new THREE.Vector3(-cphi * st, cphi * ct, 0),
      normal3D: new THREE.Vector3(cphi * ct, cphi * st, sphi),
    });
  }
  return out;
}

const centers = buildFibonacciCenters();

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

// --- left: cream sphere + glyph field --------------------------------------

const SPHERE_PANEL_SCALE = 0.40;
const sphereGroup = new THREE.Group();
sphereGroup.position.set(-2.9, 0, 0);
sphereGroup.scale.setScalar(SPHERE_PANEL_SCALE);
app.scene.add(sphereGroup);

const sphereMesh = new SurfaceMesh(sphereSurface, {
  uSegments: 96, vSegments: 192,
  color: CREAM, roughness: 0.4, metalness: 0.05,
});
{
  const mat = sphereMesh.material as THREE.MeshPhysicalMaterial;
  mat.clearcoat = 0.6;
  mat.clearcoatRoughness = 0.25;
  // Polygon offset so glyphs sit slightly above the surface without z-fighting.
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
}
sphereGroup.add(sphereMesh);

const markerBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
);
sphereGroup.add(markerBall);

// --- glyph rendering -------------------------------------------------------
//
// Each ellipse is a TubeGeometry built along the actual ellipse path. This
// gives a uniform cross-section regardless of anisotropy (an InstancedMesh
// of a torus would radially squash the cross-section under per-instance
// anisotropic scale, pinching the tube at the minor-axis ends).
const TUBE_R = 0.025;       // tube cross-section radius (uniform along ring)
const GLYPH_BASE = 0.18;    // target median major-axis length
const ELLIPSE_SEGMENTS = 48;

const ringMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY, roughness: 0.32, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2,
});

const glyphMeshes: THREE.Mesh[] = [];

function buildEllipseTube(
  center: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3,
  a: number, b: number,
): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const theta = (2 * Math.PI * i) / ELLIPSE_SEGMENTS;
    const c = Math.cos(theta), s = Math.sin(theta);
    points.push(new THREE.Vector3(
      center.x + a * c * u.x + b * s * w.x,
      center.y + a * c * u.y + b * s * w.y,
      center.z + a * c * u.z + b * s * w.z,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, ELLIPSE_SEGMENTS * 2, TUBE_R, 8, true);
}

let L = 3.0;
const _u3 = new THREE.Vector3();
const _w3 = new THREE.Vector3();

function rebuildGlyphs() {
  // Dispose old geometries before swapping in new ones.
  for (const m of glyphMeshes) {
    sphereGroup.remove(m);
    m.geometry.dispose();
  }
  glyphMeshes.length = 0;

  // First pass: compute ellipse params + median max-stiffness for global scale.
  const cache: ({ params: EllipseParams } | null)[] = [];
  const maxStiffs: number[] = [];
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const p = ellipseAt(c.phi, c.t, L);
    if (!p.ok) { cache.push(null); continue; }
    cache.push({ params: p });
    maxStiffs.push(p.maxStiff);
  }
  const sorted = maxStiffs.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
  const gscale = GLYPH_BASE / Math.sqrt(Math.max(median, 1e-6));

  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const entry = cache[i];
    if (!entry) continue;
    const p = entry.params;

    // Chart components → 3D tangent vectors via param tangents.
    _u3.copy(c.dphi3D).multiplyScalar(p.chartU[0]).addScaledVector(c.dt3D, p.chartU[1]);
    _w3.copy(c.dphi3D).multiplyScalar(p.chartW[0]).addScaledVector(c.dt3D, p.chartW[1]);
    const uLen = _u3.length();
    const wLen = _w3.length();
    if (uLen < 1e-9 || wLen < 1e-9) continue;
    _u3.divideScalar(uLen);
    _w3.divideScalar(wLen);

    const a = Math.sqrt(p.maxStiff) * gscale;
    const b = Math.sqrt(p.minStiff) * gscale;
    if (a < 1e-6) continue;

    const geo = buildEllipseTube(c.pos3D, _u3, _w3, a, b);
    const mesh = new THREE.Mesh(geo, ringMat);
    sphereGroup.add(mesh);
    glyphMeshes.push(mesh);
  }
}

rebuildGlyphs();

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

let phi = 0;
let t = Math.PI / 2;

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

applyConfig();

// --- drag interaction -----------------------------------------------------

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

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:16px;right:16px;width:280px;padding:8px 10px;' +
  'background:transparent;pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <input id="st-L" type="range" class="thin-slider" min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const slider = sliderWrap.querySelector<HTMLInputElement>('#st-L')!;

slider.addEventListener('input', () => {
  L = parseFloat(slider.value);
  rebuildGlyphs();
  applyConfig();
});

app.start();
