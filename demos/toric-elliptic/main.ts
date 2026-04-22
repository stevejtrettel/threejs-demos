/**
 * Toric Elliptic Curve — level-3 theta embedding
 *
 * Embeds E = ℂ/(ℤ+τℤ) into CP² via z → [θ₀(z):θ₁(z):θ₂(z)],
 * then projects via the toric moment map to barycentric coordinates
 * in a triangle: z → [|θ₀|², |θ₁|², |θ₂|²].
 *
 * A U(3) rotation can be applied in CP² before the moment map,
 * visibly moving the toric image around the triangle.
 */

import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { App } from '@/app/App';
import { thetaLevel, momentMap, unitaryAction, givensRotation, matMul, cabs2 } from '@/math';
import type { Complex } from '@/math';

const toricVertShader = /* glsl */ `
attribute float aPhase;
varying float vPhase;

void main() {
  vPhase = aPhase;
}
`;

const toricFragShader = /* glsl */ `
uniform float uGridCount;
uniform float uLineWidth;
uniform vec3 uLineColor;

varying float vPhase;

vec3 hsb2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

float line(float x, float count, float width) {
  float cell = fract(x * count);
  float fw = fwidth(x * count);
  float w = max(width, fw);
  return 1.0 - smoothstep(w - fw, w + fw, cell)
             * smoothstep(w - fw, w + fw, 1.0 - cell);
}

void main() {
  // Phase → hue (smooth, no branch cuts)
  float hue = vPhase * 0.8 + 0.55;
  vec3 fill = hsb2rgb(vec3(hue, 0.45, 0.9));

  float lU = line(vMapUv.x, uGridCount, uLineWidth);
  float lV = line(vMapUv.y, uGridCount, uLineWidth);
  float grid = max(lU, lV);

  vec3 color = mix(fill, uLineColor, grid);
  csm_DiffuseColor = vec4(color, 1.0);
}
`;

// ── Triangle vertices (equilateral in XZ plane) ─────────

const R = 4;
const TRI_X = [0, -R * Math.sqrt(3) / 2, R * Math.sqrt(3) / 2];
const TRI_Z = [R, -R / 2, -R / 2];

function baryToWorld(b: number[], y: number, out: THREE.Vector3) {
  out.set(
    b[0] * TRI_X[0] + b[1] * TRI_X[1] + b[2] * TRI_X[2],
    y,
    b[0] * TRI_Z[0] + b[1] * TRI_Z[1] + b[2] * TRI_Z[2],
  );
}

// ── Reference triangle wireframe ─────────────────────────

function makeTriangleWireframe(): THREE.LineLoop {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(TRI_X[0], 0, TRI_Z[0]),
    new THREE.Vector3(TRI_X[1], 0, TRI_Z[1]),
    new THREE.Vector3(TRI_X[2], 0, TRI_Z[2]),
  ]);
  return new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0x333333 }));
}

// ── Toroidal geometry ────────────────────────────────────
// SEGMENTS × SEGMENTS vertices (no duplicate boundary row/col).
// Index buffer wraps: last col connects to col 0, last row to row 0.

const SEGMENTS = 128;
const VERTS = SEGMENTS * SEGMENTS;

function buildToroidalGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(VERTS * 3);
  const uvs = new Float32Array(VERTS * 2);
  const phase = new Float32Array(VERTS);

  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const idx = i * SEGMENTS + j;
      uvs[idx * 2] = j / SEGMENTS;
      uvs[idx * 2 + 1] = i / SEGMENTS;
    }
  }

  // Indices: each quad wraps at boundaries
  const indices: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const ni = (i + 1) % SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const nj = (j + 1) % SEGMENTS;
      const v0 = i * SEGMENTS + j;
      const v1 = ni * SEGMENTS + j;
      const v2 = i * SEGMENTS + nj;
      const v3 = ni * SEGMENTS + nj;

      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geom.setIndex(indices);
  return geom;
}

// ── Theta cache ──────────────────────────────────────────

let thetaCache: Complex[][] = []; // flat [VERTS] → Complex[3]

function rebuildThetaCache(tau: Complex) {
  // More terms needed when Im(τ) is small (slow convergence near cusp)
  // More terms for small Im(τ) — only runs on τ change, not per-frame
  const terms = Math.max(20, Math.ceil(8 / tau[1]));
  const th = thetaLevel(tau, 3, terms);

  thetaCache = new Array(VERTS);
  for (let i = 0; i < SEGMENTS; i++) {
    const v = i / SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const u = j / SEGMENTS;
      const z: Complex = [u + v * tau[0], v * tau[1]];
      thetaCache[i * SEGMENTS + j] = th.thetaAll(z);
    }
  }
}

// ── Update positions from cache + rotation ───────────────

const _p = new THREE.Vector3();
const PHASE_SCALE = 4; // height scale for phase-augmented mode
let phaseMode = false;

function updatePositions(geometry: THREE.BufferGeometry, U: Complex[][]) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const phaseAttr = geometry.getAttribute('aPhase') as THREE.BufferAttribute;

  for (let k = 0; k < VERTS; k++) {
    const rotated = unitaryAction(U, thetaCache[k]);
    const bary = momentMap(rotated);
    const w0 = rotated[0], w1 = rotated[1], w2 = rotated[2];
    const norm2 = cabs2(w0) + cabs2(w1) + cabs2(w2);

    // Height: Im(w₁ · w̄₀) / |w|² — first phase direction
    let y = 0;
    if (phaseMode) {
      const imW1W0bar = w1[0] * w0[1] - w1[1] * w0[0];
      y = (imW1W0bar / norm2) * PHASE_SCALE;
    }

    // Color: Im(w₂ · w̄₀) / |w|² — second phase direction
    const imW2W0bar = w2[0] * w0[1] - w2[1] * w0[0];
    phaseAttr.setX(k, imW2W0bar / norm2);

    baryToWorld(bary, y, _p);
    pos.setXYZ(k, _p.x, _p.y, _p.z);
  }

  pos.needsUpdate = true;
  phaseAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

// ── Build rotation matrix from two angles ────────────────

function buildRotation(a01: number, a12: number): Complex[][] {
  return matMul(givensRotation(3, 0, 1, a01), givensRotation(3, 1, 2, a12));
}

// ── Scene setup ──────────────────────────────────────────

const app = new App({ antialias: true });
app.backgrounds.setColor(0xf5f5f0);

app.camera.position.set(0, 12, 0);
app.controls.target.set(0, 0, 0);
app.controls.update();

app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 3);
app.scene.add(dirLight);
app.scene.add(makeTriangleWireframe());

// ── Mesh with grid shader ────────────────────────────────

const gridUniforms = {
  uGridCount: { value: 48 },
  uLineWidth: { value: 0.02 },
  uLineColor: { value: new THREE.Color(0x222222) },
};

const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
uvTex.needsUpdate = true;

const material = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  vertexShader: toricVertShader,
  fragmentShader: toricFragShader,
  uniforms: gridUniforms,
  side: THREE.DoubleSide,
  roughness: 0.3,
  metalness: 0.05,
  map: uvTex,
});

let geometry = buildToroidalGeometry();
let mesh = new THREE.Mesh(geometry, material);

let tau: Complex = [0, 1.0];
let angle01 = 0;
let angle12 = 0;

rebuildThetaCache(tau);
updatePositions(geometry, buildRotation(0, 0));
app.scene.add(mesh);

// ── Rotation update ──────────────────────────────────────

function applyRotation() {
  updatePositions(geometry, buildRotation(angle01, angle12));
}

function rebuildAll() {
  rebuildThetaCache(tau);
  applyRotation();
}

// ── τ half-plane control ─────────────────────────────────
// Simple rectangle representing the upper half-plane.

const TAU_W = 160, TAU_H = 200;
const TAU_RE_MIN = -0.4, TAU_RE_MAX = 1.4;
const TAU_IM_MIN = 0.05, TAU_IM_MAX = 1.1;

const tauCanvas = document.createElement('canvas');
tauCanvas.width = TAU_W; tauCanvas.height = TAU_H;
tauCanvas.style.cssText = `
  position:fixed; bottom:24px; left:24px;
  border-radius:6px; border:2px solid #888;
  cursor:crosshair; touch-action:none;
  background:rgba(245,245,240,0.95);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
`;
document.body.appendChild(tauCanvas);

const tauLabel = document.createElement('div');
tauLabel.style.cssText = `position:fixed;bottom:${TAU_H + 34}px;left:24px;font:12px/1 monospace;color:#555;`;
document.body.appendChild(tauLabel);

const tauCtx = tauCanvas.getContext('2d')!;

function tauToPixel(re: number, im: number): [number, number] {
  const px = (re - TAU_RE_MIN) / (TAU_RE_MAX - TAU_RE_MIN) * TAU_W;
  const py = (1 - (im - TAU_IM_MIN) / (TAU_IM_MAX - TAU_IM_MIN)) * TAU_H;
  return [px, py];
}

function pixelToTau(px: number, py: number): [number, number] {
  const re = TAU_RE_MIN + (px / TAU_W) * (TAU_RE_MAX - TAU_RE_MIN);
  const im = TAU_IM_MAX - (py / TAU_H) * (TAU_IM_MAX - TAU_IM_MIN);
  return [re, Math.max(0.01, im)];
}

function drawTauPlane() {
  const ctx = tauCtx;
  ctx.clearRect(0, 0, TAU_W, TAU_H);

  // τ dot
  const [tx, ty] = tauToPixel(tau[0], tau[1]);
  ctx.beginPath();
  ctx.arc(tx, ty, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#e44';
  ctx.fill();
  ctx.strokeStyle = '#a00';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  tauLabel.textContent = `τ = ${tau[0].toFixed(2)} + ${tau[1].toFixed(2)}i`;
}

drawTauPlane();

let tauDragging = false;
tauCanvas.addEventListener('pointerdown', (e) => {
  tauDragging = true;
  tauCanvas.setPointerCapture(e.pointerId);
  const rect = tauCanvas.getBoundingClientRect();
  const [re, im] = pixelToTau(e.clientX - rect.left, e.clientY - rect.top);
  tau = [re, im];
  drawTauPlane();
  rebuildAll();
});

tauCanvas.addEventListener('pointermove', (e) => {
  if (!tauDragging) return;
  const rect = tauCanvas.getBoundingClientRect();
  const [re, im] = pixelToTau(e.clientX - rect.left, e.clientY - rect.top);
  tau = [re, im];
  drawTauPlane();
  rebuildAll();
});

tauCanvas.addEventListener('pointerup', () => { tauDragging = false; });

// ── 2D rotation joystick ─────────────────────────────────
// Displacement from center = angular velocity (θ̇₀₁, θ̇₁₂).
// Dragging sets velocity; releasing snaps back to center (stops).

const PAD_SIZE = 120;
const MAX_SPEED = 2.0; // rad/s at edge

const pad = document.createElement('div');
pad.style.cssText = `
  position:fixed; bottom:24px; right:24px;
  width:${PAD_SIZE}px; height:${PAD_SIZE}px;
  border-radius:50%; border:2px solid #888;
  background:rgba(255,255,255,0.75);
  cursor:crosshair; touch-action:none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
`;

const dot = document.createElement('div');
dot.style.cssText = `
  position:absolute; width:16px; height:16px;
  border-radius:50%; background:#444;
  top:50%; left:50%;
  transform:translate(-50%,-50%);
  pointer-events:none;
`;
pad.appendChild(dot);

const padLabel = document.createElement('div');
padLabel.style.cssText = 'position:absolute;top:-20px;left:0;right:0;text-align:center;font:11px/1 monospace;color:#666;';
padLabel.textContent = 'U(3) rotation';
pad.appendChild(padLabel);

document.body.appendChild(pad);

let velX = 0, velY = 0;
let dragging = false;
let sticky = false; // if true, velocity persists after release

function padMove(clientX: number, clientY: number) {
  const rect = pad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const half = PAD_SIZE / 2;

  let dx = (clientX - cx) / half;
  let dy = (clientY - cy) / half;

  // clamp to unit circle
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) { dx /= len; dy /= len; }

  velX = dx * MAX_SPEED;
  velY = dy * MAX_SPEED;

  dot.style.left = `${50 + dx * 42}%`;
  dot.style.top = `${50 + dy * 42}%`;
}

function resetPad() {
  velX = 0; velY = 0;
  dot.style.left = '50%';
  dot.style.top = '50%';
}

pad.addEventListener('pointerdown', (e) => {
  dragging = true;
  pad.setPointerCapture(e.pointerId);
  padMove(e.clientX, e.clientY);
});

pad.addEventListener('pointermove', (e) => {
  if (dragging) padMove(e.clientX, e.clientY);
});

pad.addEventListener('pointerup', () => {
  dragging = false;
  if (!sticky) resetPad();
});

// S key toggles sticky mode (velocity persists after release)
window.addEventListener('keydown', (e) => {
  if (e.key === 's' || e.key === 'S') {
    sticky = !sticky;
    padLabel.textContent = sticky ? 'U(3) rotation [sticky]' : 'U(3) rotation';
    if (!sticky && !dragging) resetPad();
  }
});

// ── Phase mode toggle ────────────────────────────────────

const label = document.createElement('div');
label.style.cssText = 'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:4px;pointer-events:none;';
document.body.appendChild(label);

function updateLabel() {
  label.textContent = phaseMode
    ? 'Phase-augmented  [P to toggle]'
    : 'Moment map  [P to toggle]';
}
updateLabel();

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    phaseMode = !phaseMode;
    updateLabel();
    applyRotation();
  }
});

// ── Animation loop ───────────────────────────────────────

app.addAnimateCallback((_time: number, delta: number) => {
  if (velX === 0 && velY === 0) return;
  angle01 += velX * delta;
  angle12 += velY * delta;
  applyRotation();
});

// ── Start ────────────────────────────────────────────────

app.start();
