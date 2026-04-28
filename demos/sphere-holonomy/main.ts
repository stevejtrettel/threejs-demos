/**
 * Sphere holonomy — parallel transport around a latitude loop.
 *
 * Classical visualization of curvature: on the unit 2-sphere, transport a
 * tangent vector around a circle at fixed colatitude θ₀, back to the
 * starting point. The transported vector differs from the original by
 * an angle
 *
 *   α = 2π (1 − cos θ₀)
 *
 * equal to the solid angle enclosed by the loop (Gauss-Bonnet). At
 * θ₀ = π/2 (equator, a geodesic) the vector returns to itself; near the
 * poles the cap is small and the holonomy vanishes; in between, the
 * vector visibly rotates.
 *
 * Under the hood: `parallelTransportOperator` integrates the transport
 * operator `R(t)` in orthonormal frames — for a 2-surface this sits in
 * SO(2). The accumulated holonomy after one loop is `R(2π) ∈ SO(2)`;
 * its angle is `SO2.log(R(2π))`. The sampled arrows along the loop come
 * from applying `R(t)` to the initial orthonormal-frame vector, then
 * pushing back through the Cholesky frame to the coordinate basis and on
 * through the surface embedding to 3D.
 *
 * Drag the slider to change θ₀; arrows along the loop update live.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { MetricSurface, SurfaceMesh, ArrowGlyphs, SO2 } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { Matrix } from '@/math/linear-algebra';
import { parallelTransportOperator } from '@/math/manifolds';

// --- Sphere geometry: (θ, φ) → (sin θ cos φ, sin θ sin φ, cos θ). ----------
//
// θ is the polar angle from +z (0 at north pole, π at south); φ is azimuth.
// Induced metric is g = diag(1, sin²θ). Same chart for both the display
// and the intrinsic parallel-transport calculation.

const SPHERE_R = 1.5;

function spherePoint(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(theta), c = Math.cos(theta);
  return new THREE.Vector3(
    SPHERE_R * s * Math.cos(phi),
    SPHERE_R * s * Math.sin(phi),
    SPHERE_R * c,
  );
}

function sphereThetaTangent(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(theta), c = Math.cos(theta);
  return new THREE.Vector3(
    SPHERE_R * c * Math.cos(phi),
    SPHERE_R * c * Math.sin(phi),
    -SPHERE_R * s,
  );
}

function spherePhiTangent(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(theta);
  return new THREE.Vector3(
    -SPHERE_R * s * Math.sin(phi),
     SPHERE_R * s * Math.cos(phi),
     0,
  );
}

const sphereDisplay: Surface = {
  evaluate: (u, v) => spherePoint(u, v),
  getDomain: (): SurfaceDomain => ({
    uMin: 0.01, uMax: Math.PI - 0.01,
    vMin: 0, vMax: 2 * Math.PI,
  }),
};

const sphereIntrinsic = new MetricSurface({
  domain: {
    uMin: 0.01, uMax: Math.PI - 0.01,
    vMin: 0, vMax: 2 * Math.PI,
  },
  metric: (theta, _phi) => {
    const s = Math.sin(theta);
    const m = new Matrix(2, 2);
    m.data[0] = 1; m.data[3] = s * s;
    return m;
  },
});

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(3.5, 2.5, 3.5);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0x181b22);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-2, -1, -3);
app.scene.add(fill);

const sphereMesh = new SurfaceMesh(sphereDisplay, {
  uSegments: 96,
  vSegments: 192,
  color: 0x5577aa,
  roughness: 0.55,
  metalness: 0.0,
});
app.scene.add(sphereMesh);

// --- Loop curve + transport sampling ----------------------------------------

const TRANSPORT_STEPS = 400;
const ARROW_COUNT = 48;
const ARROW_LEN = 0.28;

const loopLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }),
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

// --- Rebuild on slider change -----------------------------------------------

function rebuild(theta0: number) {
  // Parallel-transport operator around γ(φ) = (θ₀, φ), φ ∈ [0, 2π].
  const result = parallelTransportOperator({
    patch: sphereIntrinsic,
    curve: (phi) => [theta0, phi],
    tangent: () => [0, 1],          // γ̇ = ∂/∂φ, avoids FD
    tMin: 0,
    tMax: 2 * Math.PI,
    steps: TRANSPORT_STEPS,
  });

  // Initial vector in the orthonormal frame at p(0).
  //   metric g = diag(1, sin²θ₀), Cholesky L = diag(1, sin θ₀)
  //   coord basis V = (1, 0) (i.e. the ∂_θ direction)
  //   orthonormal components v̂ = Lᵀ · V = (1, 0)
  const vHat0 = [1, 0];

  // Loop line at full integration resolution.
  const loopPositions = new Float32Array((TRANSPORT_STEPS + 1) * 3);
  for (let i = 0; i <= TRANSPORT_STEPS; i++) {
    const [t, p] = result.points[i];
    const pos = spherePoint(t, p);
    loopPositions[i * 3 + 0] = pos.x;
    loopPositions[i * 3 + 1] = pos.y;
    loopPositions[i * 3 + 2] = pos.z;
  }
  loopLine.geometry.dispose();
  loopLine.geometry = new THREE.BufferGeometry();
  loopLine.geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(loopPositions, 3),
  );

  // Arrows: apply R(t) to v̂(0), convert back to coord basis via L(t)⁻ᵀ,
  // pushforward through the embedding's partials.
  const tmp = new THREE.Vector3();
  for (let i = 0; i < ARROW_COUNT; i++) {
    const sampleIdx = Math.round((i * TRANSPORT_STEPS) / ARROW_COUNT);
    const [theta, phi] = result.points[sampleIdx];
    const R = result.operators[sampleIdx];
    const L = result.choleskys[sampleIdx];

    // v̂(t) = R(t) · v̂(0)
    const vHat = R.mulVec(vHat0);
    // V(t) = L(t)⁻ᵀ · v̂(t) — i.e., solve Lᵀ · V = v̂.
    //   For a diagonal L on the sphere, this is trivially
    //     V^0 = v̂^0 / L[0][0],  V^1 = v̂^1 / L[1][1].
    //   Using the general solve for correctness in any surface chart.
    const V = L.transpose().solve(vHat);

    const base = spherePoint(theta, phi);
    const dTheta = sphereThetaTangent(theta, phi);
    const dPhi = spherePhiTangent(theta, phi);
    tmp.copy(dTheta).multiplyScalar(V[0]).addScaledVector(dPhi, V[1]);
    loopArrows.setArrow(i, base, tmp);
  }

  // Initial + final at the base point γ(0) = γ(2π).
  const basePoint = spherePoint(theta0, 0);
  const dTheta0 = sphereThetaTangent(theta0, 0);
  const dPhi0 = spherePhiTangent(theta0, 0);

  const Rfinal = result.operators[result.operators.length - 1];
  const vHatFinal = Rfinal.mulVec(vHat0);
  const Vfinal = result.choleskys[result.choleskys.length - 1]
    .transpose()
    .solve(vHatFinal);

  // Initial coord-basis vector is still (1, 0).
  const v0 = dTheta0.clone().multiplyScalar(1);
  const vF = dTheta0.clone().multiplyScalar(Vfinal[0])
    .addScaledVector(dPhi0, Vfinal[1]);
  initialArrow.setArrow(0, basePoint, v0);
  finalArrow.setArrow(0, basePoint, vF);

  // Holonomy angle — direct from the Lie group.
  const measured = SO2.log(Rfinal)[0];
  const expectedRaw = 2 * Math.PI * (1 - Math.cos(theta0));
  // Fold expected into the principal branch (−π, π] to match `log`.
  let expected = ((expectedRaw + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (expected <= -Math.PI) expected += 2 * Math.PI;

  let diff = measured - expected;
  if (diff >  Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;

  readoutTheta.textContent = `${theta0.toFixed(3)}  rad  (${(theta0 * 180 / Math.PI).toFixed(1)}°)`;
  readoutMeasured.textContent = `${measured.toFixed(4)}  rad`;
  readoutExpected.textContent = `${expected.toFixed(4)}  rad  (from 2π(1−cos θ₀))`;
  readoutDiff.textContent = `${diff.toExponential(2)}`;
}

// --- UI ---------------------------------------------------------------------

let theta0 = Math.PI / 3;

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#e8e8ee;font:14px/1.4 monospace;' +
  'background:rgba(15,15,22,0.88);padding:12px 16px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:8px;min-width:340px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>colatitude θ₀</span>
    <span id="h-theta"></span>
  </label>
  <input id="h-theta-slider" type="range" min="0.05" max="3.09" step="0.01" value="${theta0}" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:2px;font-size:12px;color:#aaa;margin-top:4px;">
    <span>holonomy</span><span id="h-measured"></span>
    <span>expected</span><span id="h-expected"></span>
    <span>diff</span><span id="h-diff"></span>
  </div>
  <div style="font-size:11px;color:#888;margin-top:4px;line-height:1.5;">
    <span style="color:#33ff88;">green</span> = initial vector, <span style="color:#ff3366;">red</span> = after one loop
  </div>
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#h-theta-slider')!;
const readoutTheta = panel.querySelector<HTMLSpanElement>('#h-theta')!;
const readoutMeasured = panel.querySelector<HTMLSpanElement>('#h-measured')!;
const readoutExpected = panel.querySelector<HTMLSpanElement>('#h-expected')!;
const readoutDiff = panel.querySelector<HTMLSpanElement>('#h-diff')!;

slider.addEventListener('input', () => {
  theta0 = parseFloat(slider.value);
  rebuild(theta0);
});

rebuild(theta0);

app.start();

(window as any).setTheta = (t: number) => { theta0 = t; slider.value = String(t); rebuild(t); };
