/**
 * Hénon-Heiles — Poincaré section of the canonical 2-DOF chaotic Hamiltonian.
 *
 *   H(q₁, q₂, p₁, p₂) = ½(p₁² + p₂²) + ½(q₁² + q₂²) + q₁² q₂ − ⅓ q₂³
 *
 * Motion on the energy surface H = E is 3D. The section `q₁ = 0, p₁ > 0`
 * cuts that surface transversally, giving a 2D picture in (q₂, p₂). For
 * small E the section is filled with nested KAM tori (closed curves); at
 * E ≈ 1/6 (the saddle energy) the tori break down and chaos fills most
 * of the allowed region.
 *
 * The demo accumulates crossings continuously, a few per orbit per frame,
 * so the section fills in as you watch. Slide E to reset and start a new
 * section — the structure appears live rather than on a precompute pause.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { poincareSection, gaussLegendre4 } from '@/math';

// --- Equations of motion ----------------------------------------------------

function deriv(s: number[]): number[] {
  const [q1, q2, p1, p2] = s;
  return [
    p1,
    p2,
    -q1 - 2 * q1 * q2,
    -q2 - q1 * q1 + q2 * q2,
  ];
}

function energy(s: number[]): number {
  const [q1, q2, p1, p2] = s;
  return 0.5 * (p1 * p1 + p2 * p2) + 0.5 * (q1 * q1 + q2 * q2) + q1 * q1 * q2 - q2 * q2 * q2 / 3;
}

/**
 * Given E and (q₂, p₂) on the section plane q₁ = 0, return p₁ (> 0)
 * or null if the energy surface doesn't reach this point.
 *   p₁² = 2E − p₂² − q₂² + 2 q₂³/3
 */
function p1FromEnergy(E: number, q2: number, p2: number): number | null {
  const p1sq = 2 * E - p2 * p2 - q2 * q2 + 2 * q2 * q2 * q2 / 3;
  if (p1sq <= 0) return null;
  return Math.sqrt(p1sq);
}

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 3.5);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.controls.controls.enabled = false;
app.backgrounds.setColor(0x0a0c12);
app.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

// --- Section plot layout ----------------------------------------------------

const PLOT_W = 3.0;
const PLOT_H = 3.0;
const PLOT_Q2_MIN = -0.6, PLOT_Q2_MAX = 0.8;
const PLOT_P2_MIN = -0.6, PLOT_P2_MAX = 0.6;

function sectionToWorld(q2: number, p2: number): [number, number] {
  const x = (q2 - PLOT_Q2_MIN) / (PLOT_Q2_MAX - PLOT_Q2_MIN) * PLOT_W - PLOT_W / 2;
  const y = (p2 - PLOT_P2_MIN) / (PLOT_P2_MAX - PLOT_P2_MIN) * PLOT_H - PLOT_H / 2;
  return [x, y];
}

// Frame + zero axes.
const frameMat = new THREE.LineBasicMaterial({ color: 0x666666 });
app.scene.add(new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-PLOT_W / 2, -PLOT_H / 2, 0),
    new THREE.Vector3( PLOT_W / 2, -PLOT_H / 2, 0),
    new THREE.Vector3( PLOT_W / 2,  PLOT_H / 2, 0),
    new THREE.Vector3(-PLOT_W / 2,  PLOT_H / 2, 0),
  ]),
  frameMat,
));

const axisMat = new THREE.LineBasicMaterial({ color: 0x3a3f4a });
const [ax0, ay0] = sectionToWorld(0, 0);
app.scene.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(ax0, -PLOT_H / 2, 0),
    new THREE.Vector3(ax0,  PLOT_H / 2, 0),
  ]),
  axisMat,
));
app.scene.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-PLOT_W / 2, ay0, 0),
    new THREE.Vector3( PLOT_W / 2, ay0, 0),
  ]),
  axisMat,
));

// --- Per-orbit state (live integration + preallocated Points buffer) --------

interface Orbit {
  state: number[];                        // continuation state in (q₁, q₂, p₁, p₂)
  t: number;
  color: THREE.Color;
  // Rendering: preallocated position buffer, grown by updating draw range.
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  count: number;
  points: THREE.Points;
}

const MAX_POINTS_PER_ORBIT = 6000;
const STEPS_PER_FRAME_PER_ORBIT = 250;    // integration budget per orbit per frame
const MAX_CROSSINGS_PER_CALL = 8;
const DT = 0.02;

const orbits: Orbit[] = [];

function disposeOrbits() {
  for (const o of orbits) {
    app.scene.remove(o.points);
    o.geometry.dispose();
    (o.points.material as THREE.Material).dispose();
  }
  orbits.length = 0;
}

function hueColor(i: number, n: number): THREE.Color {
  const hue = (i / Math.max(1, n)) * 0.78;
  return new THREE.Color().setHSL(hue, 0.85, 0.62);
}

function createOrbit(state: number[], color: THREE.Color): Orbit {
  const positions = new Float32Array(MAX_POINTS_PER_ORBIT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({ color, size: 0.018, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  app.scene.add(points);
  return {
    state: state.slice(), t: 0, color,
    geometry, positions, count: 0, points,
  };
}

function seedOrbits(E: number) {
  disposeOrbits();

  // Seed along p₂ = 0, vary q₂ across the allowed range.
  const desired = 14;
  const candidates: number[][] = [];
  for (let i = 0; i < 4 * desired; i++) {
    const q2 = -0.55 + (1.35 * (i + 0.5)) / (4 * desired);
    const p1 = p1FromEnergy(E, q2, 0);
    if (p1 === null) continue;
    candidates.push([0, q2, p1, 0]);
    if (candidates.length >= desired) break;
  }

  for (let k = 0; k < candidates.length; k++) {
    orbits.push(createOrbit(candidates[k], hueColor(k, candidates.length)));
  }
  updateCountReadout();
}

function updateCountReadout() {
  let total = 0;
  for (const o of orbits) total += o.count;
  countReadout.textContent = `${orbits.length} orbits · ${total} crossings`;
}

/** Append crossings to an orbit's point buffer. */
function appendCrossings(o: Orbit, crossings: number[][]) {
  if (crossings.length === 0) return;
  let room = MAX_POINTS_PER_ORBIT - o.count;
  if (room <= 0) return;
  const toAdd = Math.min(room, crossings.length);
  for (let i = 0; i < toAdd; i++) {
    const [x, y] = sectionToWorld(crossings[i][1], crossings[i][3]);
    const idx = (o.count + i) * 3;
    o.positions[idx + 0] = x;
    o.positions[idx + 1] = y;
    o.positions[idx + 2] = 0;
  }
  o.count += toAdd;
  o.geometry.attributes.position.needsUpdate = true;
  o.geometry.setDrawRange(0, o.count);
}

// --- UI ---------------------------------------------------------------------

const E_SADDLE = 1 / 6;
let currentE = 0.1;

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#e8e8ee;font:14px/1.4 monospace;' +
  'background:rgba(15,15,22,0.88);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:240px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>energy E</span>
    <span id="hh-e-value">${currentE.toFixed(3)}</span>
  </label>
  <input id="hh-e-slider" type="range" min="0.02" max="0.166" step="0.002" value="${currentE}" />
  <div style="font-size:11px;color:#888;">
    saddle at E = 1/6 ≈ ${E_SADDLE.toFixed(3)}
  </div>
  <div style="font-size:11px;color:#888;" id="hh-count"></div>
  <div style="font-size:11px;color:#888;margin-top:4px;">
    low E: nested tori (regular).<br>
    E → 1/6: tori break, chaos spreads.
  </div>
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#hh-e-slider')!;
const readout = panel.querySelector<HTMLSpanElement>('#hh-e-value')!;
const countReadout = panel.querySelector<HTMLSpanElement>('#hh-count')!;

slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(3);
  currentE = v;
  seedOrbits(currentE);
});

seedOrbits(currentE);

// --- Per-frame integration --------------------------------------------------
//
// Advance every orbit by a bounded number of steps each frame. Crossings
// captured during those steps are appended to the Points buffer.

app.addAnimateCallback(() => {
  let anyAdded = false;
  for (const o of orbits) {
    if (o.count >= MAX_POINTS_PER_ORBIT) continue;
    const res = poincareSection({
      deriv,
      initial: o.state,
      t0: o.t,
      section: (s) => s[0],
      direction: 'up',
      maxCrossings: MAX_CROSSINGS_PER_CALL,
      maxSteps: STEPS_PER_FRAME_PER_ORBIT,
      dt: DT,
      stepper: gaussLegendre4,
    });
    appendCrossings(o, res.crossings);
    o.state = res.finalState;
    o.t = res.finalTime;
    if (res.crossings.length > 0) anyAdded = true;
  }
  if (anyAdded) updateCountReadout();
});

app.start();

(window as any).setE = (E: number) => { currentE = E; seedOrbits(E); };
(window as any).energy = energy;
