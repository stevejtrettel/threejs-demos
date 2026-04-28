/**
 * `SL(2, ℂ)` Möbius transformations of the **Riemann sphere** `Ĉ = S²`.
 *
 * `SL(2, ℂ)` acts on `Ĉ` by `g · z = (az + b)/(cz + d)`. We visualize
 * the action by stereographically lifting points from `ℂ̂` onto `S²` in
 * 3D and drawing iterated orbits.
 *
 * Six sliders set the algebra vector `ξ = (a_re, a_im, b_re, b_im,
 * c_re, c_im) ∈ 𝔰𝔩(2, ℂ)`; we exponentiate to get `g = exp(ξ)`. The
 * four conjugacy classes of `SL(2, ℂ)` (by trace) produce visibly
 * different orbit topologies on the sphere:
 *
 *   elliptic    real, |tr| < 2    rotation about an axis  → orbits are circles
 *   parabolic   real, |tr| = 2    one fixed point         → orbits accumulate
 *   hyperbolic  real, |tr| > 2    two antipodal fps       → orbits flow great-circle-ish
 *   loxodromic  complex tr        two fps + spin          → orbits SPIRAL on the sphere
 *
 * Loxodromic motion is the single thing that's not available in
 * `SL(2, ℝ)` — it requires the `i ⋅ axial` part of the algebra.
 *
 * Stereographic projection: `(u + iv) ∈ ℂ ↦ (X, Y, Z) ∈ S²` with
 *   `X = 2u / (u² + v² + 1)`,
 *   `Y = 2v / (u² + v² + 1)`,
 *   `Z = (u² + v² − 1) / (u² + v² + 1)`.
 * The point at infinity maps to the north pole `(0, 0, 1)`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SL2C, mobiusSL2C, classifySL2C, type SL2CClass } from '@/math';
import type { ComplexMatrix } from '@/math/linear-algebra';

// ── Stereographic lift ℂ → S² ──────────────────────────────────────

function stereoLift(z: [number, number]): THREE.Vector3 {
  const [u, v] = z;
  const denom = u * u + v * v + 1;
  return new THREE.Vector3(
    2 * u / denom,
    2 * v / denom,
    (u * u + v * v - 1) / denom,
  );
}

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(2.4, 1.6, 2.4);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0x171a22);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-3, -1, -3);
app.scene.add(fill);

// Riemann sphere — translucent so orbits on the back are visible.
const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 48),
  new THREE.MeshStandardMaterial({
    color: 0x4a6688,
    roughness: 0.55,
    transparent: true,
    opacity: 0.4,
  }),
);
app.scene.add(sphereMesh);

// Reference: equator, a couple meridians.
function buildReference() {
  const matLight = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.6 });
  const N = 96;
  // Equator
  const equator: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    equator.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
  }
  app.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(equator), matLight));
  // Two meridians (XZ and YZ planes)
  const m1: THREE.Vector3[] = [];
  const m2: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    m1.push(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
    m2.push(new THREE.Vector3(0, Math.cos(t), Math.sin(t)));
  }
  app.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(m1), matLight));
  app.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(m2), matLight));
}
buildReference();

// ── Seed points + orbit lines ──────────────────────────────────────

interface Seed {
  z0: [number, number];   // initial point in ℂ (will be stereo-lifted)
  color: number;
}

// Spread seeds around the sphere by picking diverse stereo coords.
const SEEDS: Seed[] = [
  { z0: [ 0.5,  0.0], color: 0xdd3344 },
  { z0: [-0.5,  0.0], color: 0xee7733 },
  { z0: [ 0.0,  0.5], color: 0x33aa55 },
  { z0: [ 0.0, -0.5], color: 0x3366cc },
  { z0: [ 1.5,  0.0], color: 0x9944aa },
  { z0: [ 0.0,  1.5], color: 0xc83366 },
  { z0: [-1.5,  0.0], color: 0x118888 },
  { z0: [ 0.0, -1.5], color: 0xaa6622 },
  { z0: [ 0.7,  0.7], color: 0x9966cc },
  { z0: [-0.7, -0.7], color: 0xcc9966 },
];

const ITERATIONS = 80;

const orbitLines: THREE.Line[] = [];
const orbitDots: THREE.Mesh[] = [];

for (const seed of SEEDS) {
  const positions = new Float32Array((ITERATIONS + 1) * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
    color: seed.color, transparent: true, opacity: 0.85,
  }));
  app.scene.add(line);
  orbitLines.push(line);

  // Dot at the seed itself (so user can see where each orbit starts).
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 12, 8),
    new THREE.MeshBasicMaterial({ color: seed.color }),
  );
  app.scene.add(dot);
  orbitDots.push(dot);
}

// ── Fixed-point markers (up to 2) ──────────────────────────────────

const fpMarkers: THREE.Mesh[] = [];
for (let i = 0; i < 2; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222, roughness: 0.3 }),
  );
  m.visible = false;
  app.scene.add(m);
  fpMarkers.push(m);
}

// ── Möbius fixed-point computation ────────────────────────────────
//
// Solve `c z² + (d − a) z − b = 0` for `g = [[a, b], [c, d]] ∈ SL(2, ℂ)`.
// Discriminant `(a + d)² − 4 = tr²(g) − 4` (works the same way as for
// SL(2,ℝ), but with complex `tr`).

function fixedPointsSL2C(g: ComplexMatrix): [number, number][] {
  const a = g.get(0, 0), b = g.get(0, 1);
  const c = g.get(1, 0), d = g.get(1, 1);

  // tr² − 4
  const trR = a[0] + d[0], trI = a[1] + d[1];
  const tr2_R = trR * trR - trI * trI;
  const tr2_I = 2 * trR * trI;
  const discR = tr2_R - 4;
  const discI = tr2_I;
  const discMag = Math.hypot(discR, discI);

  // Complex sqrt of discriminant
  const sqMag = Math.sqrt(discMag);
  const sqAng = Math.atan2(discI, discR) / 2;
  const sR = sqMag * Math.cos(sqAng);
  const sI = sqMag * Math.sin(sqAng);

  // Quadratic: c z² + (d − a) z − b = 0  →  z = [(a − d) ± √disc] / (2c)
  // Need `c ≠ 0`. If `c = 0`, the Möbius fixes ∞ and one finite point at z = b/(d − a).
  if (Math.hypot(c[0], c[1]) < 1e-12) {
    // c ≈ 0: fixed at ∞ (north pole) and at z = b / (d − a) if a ≠ d
    const denomR = d[0] - a[0], denomI = d[1] - a[1];
    if (Math.hypot(denomR, denomI) < 1e-12) return [];   // both fixed at ∞
    const denom2 = denomR * denomR + denomI * denomI;
    const fpR = (b[0] * denomR + b[1] * denomI) / denom2;
    const fpI = (b[1] * denomR - b[0] * denomI) / denom2;
    return [[fpR, fpI]];
  }

  // Numerator for + branch:  (a − d) + sqDisc
  const numPlusR = a[0] - d[0] + sR;
  const numPlusI = a[1] - d[1] + sI;
  const numMinusR = a[0] - d[0] - sR;
  const numMinusI = a[1] - d[1] - sI;

  // Divide each by 2c.
  const twoCR = 2 * c[0], twoCI = 2 * c[1];
  const cMag2 = twoCR * twoCR + twoCI * twoCI;

  const fp1R = (numPlusR * twoCR + numPlusI * twoCI) / cMag2;
  const fp1I = (numPlusI * twoCR - numPlusR * twoCI) / cMag2;
  const fp2R = (numMinusR * twoCR + numMinusI * twoCI) / cMag2;
  const fp2I = (numMinusI * twoCR - numMinusR * twoCI) / cMag2;

  // If discriminant ≈ 0 (parabolic), the two roots coincide.
  if (discMag < 1e-9) return [[fp1R, fp1I]];
  return [[fp1R, fp1I], [fp2R, fp2I]];
}

// ── State ───────────────────────────────────────────────────────────

let xi: number[] = [0, 0, 0.4, 0, -0.4, 0];   // start with sl(2,ℝ) elliptic

// ── Update ──────────────────────────────────────────────────────────

function update() {
  const g = SL2C.exp(xi);

  // Iterate each seed, lift to sphere.
  for (let si = 0; si < SEEDS.length; si++) {
    const seed = SEEDS[si];
    const line = orbitLines[si];
    const positions = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;

    let z: [number, number] = [seed.z0[0], seed.z0[1]];
    for (let i = 0; i <= ITERATIONS; i++) {
      const p = stereoLift(z);
      positions[i * 3]     = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      if (i < ITERATIONS) z = mobiusSL2C(g, z);
    }
    line.geometry.setDrawRange(0, ITERATIONS + 1);
    (line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Place the seed dot at the lifted seed point.
    const seedP = stereoLift(seed.z0);
    orbitDots[si].position.copy(seedP);
  }

  // Fixed points
  const fps = fixedPointsSL2C(g);
  for (let i = 0; i < fpMarkers.length; i++) {
    if (i < fps.length) {
      const p = stereoLift(fps[i]);
      fpMarkers[i].visible = true;
      fpMarkers[i].position.copy(p);
    } else {
      fpMarkers[i].visible = false;
    }
  }

  // Readouts
  const cls = classifySL2C(g);
  const tr = SL2C.trace(g);
  readoutTrace.textContent = `(${tr[0].toFixed(3)}, ${tr[1].toFixed(3)})`;
  readoutClass.textContent = cls;
  readoutClass.style.color = colorForClass(cls);
  readoutFP.textContent = fps.length === 0
    ? 'both at ∞'
    : fps.map((p) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`).join('  ');
}

function colorForClass(cls: SL2CClass): string {
  switch (cls) {
    case 'elliptic':   return '#3366cc';
    case 'parabolic':  return '#aa6622';
    case 'hyperbolic': return '#cc3333';
    case 'loxodromic': return '#cc44cc';
  }
}

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#e8e8ee;font:11px/1.3 monospace;' +
  'background:rgba(15,15,22,0.9);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:240px;z-index:10;';
panel.innerHTML = `
  <div style="font-weight:bold;">Möbius on the Riemann sphere</div>
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>α  (re, im)</span>
    <span>
      <input id="rs-ar" type="number" step="0.05" value="0" style="width:48px;font:11px monospace;">
      <input id="rs-ai" type="number" step="0.05" value="0" style="width:48px;font:11px monospace;">
    </span>
  </label>
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>β  (re, im)</span>
    <span>
      <input id="rs-br" type="number" step="0.05" value="0.4" style="width:48px;font:11px monospace;">
      <input id="rs-bi" type="number" step="0.05" value="0" style="width:48px;font:11px monospace;">
    </span>
  </label>
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>γ  (re, im)</span>
    <span>
      <input id="rs-cr" type="number" step="0.05" value="-0.4" style="width:48px;font:11px monospace;">
      <input id="rs-ci" type="number" step="0.05" value="0" style="width:48px;font:11px monospace;">
    </span>
  </label>
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#aaa;margin-top:6px;">
    <span>tr g</span><span id="rs-tr">—</span>
    <span>class</span><span id="rs-class">—</span>
    <span>fp(s)</span><span id="rs-fp">—</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;">
    <button id="rs-elliptic"  style="padding:3px 6px;font-size:10px;">elliptic</button>
    <button id="rs-parabolic" style="padding:3px 6px;font-size:10px;">parabolic</button>
    <button id="rs-hyperbolic" style="padding:3px 6px;font-size:10px;">hyperbolic</button>
    <button id="rs-loxodromic" style="padding:3px 6px;font-size:10px;">loxodromic</button>
  </div>
  <div style="font-size:10px;color:#888;margin-top:6px;line-height:1.5;">
    g = exp([α, β, γ]) ∈ SL(2,ℂ),  X = [[α, β], [γ, −α]]<br>
    seeds in ℂ stereo-lifted to S²;<br>
    fixed points marked white.
  </div>
`;
document.body.appendChild(panel);

const inputs = {
  ar: panel.querySelector<HTMLInputElement>('#rs-ar')!,
  ai: panel.querySelector<HTMLInputElement>('#rs-ai')!,
  br: panel.querySelector<HTMLInputElement>('#rs-br')!,
  bi: panel.querySelector<HTMLInputElement>('#rs-bi')!,
  cr: panel.querySelector<HTMLInputElement>('#rs-cr')!,
  ci: panel.querySelector<HTMLInputElement>('#rs-ci')!,
};

const readoutTrace = panel.querySelector<HTMLSpanElement>('#rs-tr')!;
const readoutClass = panel.querySelector<HTMLSpanElement>('#rs-class')!;
const readoutFP    = panel.querySelector<HTMLSpanElement>('#rs-fp')!;

function syncFromInputs() {
  xi = [
    parseFloat(inputs.ar.value) || 0,
    parseFloat(inputs.ai.value) || 0,
    parseFloat(inputs.br.value) || 0,
    parseFloat(inputs.bi.value) || 0,
    parseFloat(inputs.cr.value) || 0,
    parseFloat(inputs.ci.value) || 0,
  ];
  update();
}
for (const k of Object.keys(inputs) as Array<keyof typeof inputs>) {
  inputs[k].addEventListener('input', syncFromInputs);
}

function setXi(newXi: number[]) {
  xi = newXi;
  inputs.ar.value = String(xi[0]);
  inputs.ai.value = String(xi[1]);
  inputs.br.value = String(xi[2]);
  inputs.bi.value = String(xi[3]);
  inputs.cr.value = String(xi[4]);
  inputs.ci.value = String(xi[5]);
  update();
}

panel.querySelector<HTMLButtonElement>('#rs-elliptic')!  .addEventListener('click', () => setXi([0, 0,  0.5, 0, -0.5, 0]));
panel.querySelector<HTMLButtonElement>('#rs-parabolic')! .addEventListener('click', () => setXi([0, 0,  0.6, 0,  0.0, 0]));
panel.querySelector<HTMLButtonElement>('#rs-hyperbolic')!.addEventListener('click', () => setXi([0.6, 0, 0, 0, 0, 0]));
panel.querySelector<HTMLButtonElement>('#rs-loxodromic')!.addEventListener('click', () => setXi([0.4, 0.4, 0, 0, 0, 0]));

// ── Boot ────────────────────────────────────────────────────────────

update();
app.start();
