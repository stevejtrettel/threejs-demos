/**
 * Graph-surface holonomy — parallel transport around a loop on z = f(x, y).
 *
 * The surface's metric is induced from ℝ³; transporting a vector around a
 * circle and back gives holonomy equal to the integrated Gauss curvature
 * over the enclosed region (Gauss-Bonnet).
 *
 * The height field is a 2D sinusoid `A · sin(kx + φ) · sin(ky + φ)`. The
 * resulting surface is a checkerboard of hills and valleys — K flips sign
 * between peaks (positive) and saddles (negative). Move the loop around
 * the landscape and watch the holonomy change sign and magnitude.
 *
 * Under the hood: `parallelTransportOperator` integrates the transport
 * operator `R(t)` in orthonormal frames (SO(2) for a 2-surface); the
 * accumulated holonomy after one loop is `R(2π)`, and the angle is read
 * straight from `SO2.log(R(2π))`.
 *
 * Interactions:
 *   - Click / drag anywhere on the surface to reposition the loop center.
 *   - Sliders for amplitude, wave frequency, phase, and loop radius.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import { App } from '@/app/App';
import { FunctionGraph, SurfaceMesh, ArrowGlyphs, SO2 } from '@/math';
import {
  ScalarField2D,
  type SurfaceDomainLite,
  type Hessian2D,
} from '@/math/functions';
import type { Parametric } from '@/math/types';
import { parallelTransportOperator } from '@/math/manifolds';

// --- Scalar field: 2D sinusoid with reactive amplitude/frequency/phase -----

class WavyField extends ScalarField2D implements Parametric {
  readonly params = new Params(this);
  declare amplitude: number;
  declare frequency: number;
  declare phase: number;

  constructor(opts: { amplitude?: number; frequency?: number; phase?: number } = {}) {
    super();
    this.params
      .define('amplitude', opts.amplitude  ?? 0.6, { triggers: 'rebuild' })
      .define('frequency', opts.frequency  ?? 1.4, { triggers: 'rebuild' })
      .define('phase',     opts.phase      ?? 0.0, { triggers: 'rebuild' });
  }

  evaluateAt(x: number, y: number): number {
    const k = this.frequency, p = this.phase;
    return this.amplitude * Math.sin(k * x + p) * Math.sin(k * y + p);
  }

  partialsAt(x: number, y: number): [number, number] {
    const A = this.amplitude, k = this.frequency, p = this.phase;
    const X = k * x + p, Y = k * y + p;
    return [
      A * k * Math.cos(X) * Math.sin(Y),
      A * k * Math.sin(X) * Math.cos(Y),
    ];
  }

  hessianAt(x: number, y: number): Hessian2D {
    const A = this.amplitude, k = this.frequency, p = this.phase;
    const X = k * x + p, Y = k * y + p;
    const Ak2 = A * k * k;
    const fxx = -Ak2 * Math.sin(X) * Math.sin(Y);
    const fyy = -Ak2 * Math.sin(X) * Math.sin(Y);
    const fxy =  Ak2 * Math.cos(X) * Math.cos(Y);
    return [fxx, fxy, fyy];
  }

  domain2D(): SurfaceDomainLite {
    return { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };
  }
}

// --- Surface (graph) --------------------------------------------------------

const heightField = new WavyField({ amplitude: 0.6, frequency: 1.4, phase: 0 });
const surface = new FunctionGraph(heightField);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(4.5, 5.5, 5.5);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0x181b22);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 7, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-3, -1, -2);
app.scene.add(fill);

const mesh = new SurfaceMesh(surface, {
  color: 0x4477aa,
  uSegments: 128,
  vSegments: 128,
  roughness: 0.5,
  metalness: 0.0,
});
app.scene.add(mesh);

// --- Loop + transport --------------------------------------------------------

let loopCenter: [number, number] = [0, 0];
let loopRadius = 1.0;
const TRANSPORT_STEPS = 400;
const ARROW_COUNT = 40;
const ARROW_LEN = 0.25;

const loopLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
app.scene.add(loopLine);

const loopArrows = new ArrowGlyphs({
  count: ARROW_COUNT,
  color: 0xffaa33,
  length: ARROW_LEN,
  coneRadiusRatio: 0.22,
});
app.scene.add(loopArrows);

const initialArrow = new ArrowGlyphs({
  count: 1, color: 0x33ff88, length: ARROW_LEN * 1.4, coneRadiusRatio: 0.24,
});
const finalArrow = new ArrowGlyphs({
  count: 1, color: 0xff3366, length: ARROW_LEN * 1.4, coneRadiusRatio: 0.24,
});
app.scene.add(initialArrow);
app.scene.add(finalArrow);

// --- Rebuild: run parallel transport, re-draw everything -------------------

function rebuild() {
  const [cx, cy] = loopCenter;
  const r = loopRadius;
  const curve = (t: number): number[] => [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  const tangent = (t: number): number[] => [-r * Math.sin(t), r * Math.cos(t)];

  const result = parallelTransportOperator({
    patch: surface,
    curve, tangent,
    tMin: 0,
    tMax: 2 * Math.PI,
    steps: TRANSPORT_STEPS,
  });

  // Initial vector in coord basis = ∂_u (the +x direction on the graph chart).
  // Convert to orthonormal-frame components once, up front.
  const V_init = [1, 0];
  const L0 = result.choleskys[0];
  const vHat_init = L0.transpose().mulVec(V_init);

  // Lifted loop — sampled at full transport resolution for smoothness.
  const loopPositions = new Float32Array((TRANSPORT_STEPS + 1) * 3);
  for (let i = 0; i <= TRANSPORT_STEPS; i++) {
    const [x, y] = result.points[i];
    const p = surface.evaluate(x, y);
    loopPositions[i * 3 + 0] = p.x;
    loopPositions[i * 3 + 1] = p.y;
    loopPositions[i * 3 + 2] = p.z;
  }
  loopLine.geometry.dispose();
  loopLine.geometry = new THREE.BufferGeometry();
  loopLine.geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(loopPositions, 3),
  );

  // Arrows — apply R(t) in the orthonormal frame, push back to coord basis,
  // pushforward through the surface partials.
  const tmp = new THREE.Vector3();
  for (let i = 0; i < ARROW_COUNT; i++) {
    const idx = Math.round((i * TRANSPORT_STEPS) / ARROW_COUNT);
    const [x, y] = result.points[idx];
    const R = result.operators[idx];
    const L = result.choleskys[idx];

    const vHat = R.mulVec(vHat_init);            // v̂(t) = R(t) · v̂(0)
    const V = L.transpose().solve(vHat);         // V(t) = L(t)⁻ᵀ · v̂(t)
    const [Vu, Vv] = V;

    const base = surface.evaluate(x, y);
    const { du, dv } = surface.computePartials(x, y);
    tmp.copy(du).multiplyScalar(Vu).addScaledVector(dv, Vv);
    loopArrows.setArrow(i, base, tmp);
  }

  // Initial / final marker arrows at γ(0).
  const [x0, y0] = result.points[0];
  const base0 = surface.evaluate(x0, y0);
  const { du: du0, dv: dv0 } = surface.computePartials(x0, y0);

  // Initial: V(0) = V_init = (1, 0).
  const v0 = du0.clone().multiplyScalar(V_init[0]).addScaledVector(dv0, V_init[1]);

  // Final: apply R(2π).
  const Rfinal = result.operators[result.operators.length - 1];
  const Lfinal = result.choleskys[result.choleskys.length - 1];
  const vHatF = Rfinal.mulVec(vHat_init);
  const VF = Lfinal.transpose().solve(vHatF);
  const vF = du0.clone().multiplyScalar(VF[0]).addScaledVector(dv0, VF[1]);

  initialArrow.setArrow(0, base0, v0);
  finalArrow.setArrow(0, base0, vF);

  // Holonomy angle — directly from SO(2).
  const measured = SO2.log(Rfinal)[0];
  readoutHolonomy.textContent = `${measured.toFixed(4)} rad  (${(measured * 180 / Math.PI).toFixed(1)}°)`;
}

// --- Click / drag to reposition the loop center -----------------------------

const canvas = app.renderManager.renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickOnSurface(): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(mesh, false);
  return hits.length > 0 ? hits[0].point : null;
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  const hit = pickOnSurface();
  if (!hit) return;  // clicked sky → let OrbitControls handle camera rotation
  dragging = true;
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  // FunctionGraph: parameter (u, v) == world (x, y).
  loopCenter = [hit.x, hit.y];
  rebuild();
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdc(e);
  const hit = pickOnSurface();
  if (!hit) return;
  loopCenter = [hit.x, hit.y];
  rebuild();
});

canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  dragging = false;
  app.controls.controls.enabled = true;
});

// --- UI ---------------------------------------------------------------------

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:12px;left:12px;color:#e8e8ee;font:11px/1.3 monospace;' +
  'background:rgba(15,15,22,0.85);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:180px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>amplitude A</span>
    <span id="gh-amp-value"></span>
  </label>
  <input id="gh-amp-slider" type="range" min="-1.5" max="1.5" step="0.02" value="0.6" style="height:14px;" />

  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>frequency k</span>
    <span id="gh-freq-value"></span>
  </label>
  <input id="gh-freq-slider" type="range" min="0.4" max="3.0" step="0.02" value="1.4" style="height:14px;" />

  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>phase φ</span>
    <span id="gh-phase-value"></span>
  </label>
  <input id="gh-phase-slider" type="range" min="0" max="6.283" step="0.01" value="0" style="height:14px;" />

  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>loop radius</span>
    <span id="gh-rad-value"></span>
  </label>
  <input id="gh-rad-slider" type="range" min="0.25" max="2.5" step="0.02" value="1.0" style="height:14px;" />

  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#aaa;margin-top:4px;">
    <span>holonomy</span><span id="gh-holo"></span>
    <span>center</span><span id="gh-center"></span>
  </div>
  <div style="font-size:10px;color:#777;margin-top:3px;line-height:1.4;">
    <span style="color:#33ff88;">green</span> = initial, <span style="color:#ff3366;">red</span> = after loop<br>
    click-drag surface to move loop
  </div>
`;
document.body.appendChild(panel);

const ampSlider  = panel.querySelector<HTMLInputElement>('#gh-amp-slider')!;
const freqSlider = panel.querySelector<HTMLInputElement>('#gh-freq-slider')!;
const phaseSlider= panel.querySelector<HTMLInputElement>('#gh-phase-slider')!;
const radSlider  = panel.querySelector<HTMLInputElement>('#gh-rad-slider')!;
const readoutAmp   = panel.querySelector<HTMLSpanElement>('#gh-amp-value')!;
const readoutFreq  = panel.querySelector<HTMLSpanElement>('#gh-freq-value')!;
const readoutPhase = panel.querySelector<HTMLSpanElement>('#gh-phase-value')!;
const readoutRad   = panel.querySelector<HTMLSpanElement>('#gh-rad-value')!;
const readoutHolonomy = panel.querySelector<HTMLSpanElement>('#gh-holo')!;
const readoutCenter   = panel.querySelector<HTMLSpanElement>('#gh-center')!;

function sync() {
  readoutAmp.textContent = heightField.amplitude.toFixed(2);
  readoutFreq.textContent = heightField.frequency.toFixed(2);
  readoutPhase.textContent = heightField.phase.toFixed(2);
  readoutRad.textContent = loopRadius.toFixed(2);
  readoutCenter.textContent = `(${loopCenter[0].toFixed(2)}, ${loopCenter[1].toFixed(2)})`;
  rebuild();
}

ampSlider.addEventListener('input', () => {
  heightField.params.set('amplitude', parseFloat(ampSlider.value));
  sync();
});
freqSlider.addEventListener('input', () => {
  heightField.params.set('frequency', parseFloat(freqSlider.value));
  sync();
});
phaseSlider.addEventListener('input', () => {
  heightField.params.set('phase', parseFloat(phaseSlider.value));
  sync();
});
radSlider.addEventListener('input', () => {
  loopRadius = parseFloat(radSlider.value);
  sync();
});

sync();
app.start();

(window as any).heightField = heightField;
