/**
 * Möbius transformations of the upper half plane.
 *
 * `SL(2, ℝ)` acts on ℍ² by `g · z = (az + b)/(cz + d)`. Three sliders
 * select a Lie-algebra vector `ξ ∈ 𝔰𝔩(2,ℝ)` (in the standard `H, E, F`
 * basis); we exponentiate to get `g = exp(ξ) ∈ SL(2, ℝ)`. A handful of
 * seed points in ℍ² are then iterated under `g`, with each orbit drawn
 * as a polyline. Fixed point(s) of `g` are marked.
 *
 * The element classification — elliptic / parabolic / hyperbolic —
 * controls the orbit topology:
 *
 *   elliptic      |tr g| < 2    fixed point inside ℍ²; orbits are circles around it
 *   parabolic     |tr g| = 2    one boundary fixed point; orbits accumulate at it
 *   hyperbolic    |tr g| > 2    two boundary fixed points; orbits flow between them
 *
 * Move the sliders to step through all three regimes; the orbit pattern
 * changes qualitatively as you cross `|tr g| = 2`.
 *
 * Reference structure (faint gray): a few geodesics on ℍ², drawn as
 * vertical lines and semicircles meeting the real axis at right angles.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SL2R, classifySL2R, mobiusSL2R, type SL2RClass } from '@/math';
import { Matrix } from '@/math/linear-algebra';

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });

// Camera viewing the xy plane head-on. ℍ² lives in [−4, 4] × [0, 4].
app.camera.position.set(0, 1.6, 6.5);
app.controls.target.set(0, 1.6, 0);
app.controls.update();
app.controls.controls.enableRotate = false;   // 2D feel — only zoom and pan
app.backgrounds.setColor(0xfafbfc);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.95));

// ── ℍ² reference structure ─────────────────────────────────────────

const STAGE = new THREE.Group();
app.scene.add(STAGE);

// Real axis (boundary ∂ℍ²).
STAGE.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.5, 0, 0),
    new THREE.Vector3( 4.5, 0, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x222222 }),
));

// Background geodesics: a few vertical lines + a few semicircles.
function buildBackgroundGeodesics() {
  const matLight = new THREE.LineBasicMaterial({ color: 0xc8ccd5 });
  const segments = 64;

  // Vertical-line geodesics at x = −2, −1, 0, 1, 2.
  for (const x of [-2, -1, 0, 1, 2]) {
    STAGE.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.001, 0),
        new THREE.Vector3(x, 4, 0),
      ]),
      matLight,
    ));
  }

  // Semicircular geodesics centered on the real axis.
  for (const { center, radius } of [
    { center: -1.5, radius: 0.7 },
    { center:  0.0, radius: 1.0 },
    { center:  1.5, radius: 0.7 },
    { center: -1.0, radius: 1.5 },
    { center:  1.0, radius: 1.5 },
  ]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const phi = Math.PI * (i / segments);   // 0 to π — upper semicircle
      pts.push(new THREE.Vector3(
        center + radius * Math.cos(phi),
        radius * Math.sin(phi),
        0,
      ));
    }
    STAGE.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matLight));
  }
}
buildBackgroundGeodesics();

// ── Seeds + orbit polylines ────────────────────────────────────────

interface Seed {
  point: [number, number];
  color: number;
}

const SEEDS: Seed[] = [
  { point: [-2.5, 0.6], color: 0xdd3344 },
  { point: [-1.0, 0.4], color: 0xee7733 },
  { point: [ 0.0, 1.5], color: 0x3366cc },
  { point: [ 1.0, 0.4], color: 0x33aa55 },
  { point: [ 2.5, 0.6], color: 0x9944aa },
  { point: [-1.5, 2.0], color: 0xc83366 },
  { point: [ 1.5, 2.0], color: 0x118888 },
];

const ITERATIONS = 60;

// Build a polyline geometry per seed; we'll update positions each frame.
const orbitLines: THREE.Line[] = [];
const orbitDots: THREE.Mesh[] = [];

for (const seed of SEEDS) {
  const positions = new Float32Array((ITERATIONS + 1) * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
    color: seed.color, transparent: true, opacity: 0.85,
  }));
  STAGE.add(line);
  orbitLines.push(line);

  // Highlight the seed point itself with a small dot.
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 16),
    new THREE.MeshBasicMaterial({ color: seed.color }),
  );
  dot.position.set(seed.point[0], seed.point[1], 0);
  STAGE.add(dot);
  orbitDots.push(dot);
}

// ── Fixed-point markers ────────────────────────────────────────────

// Up to 2 fixed-point markers (hyperbolic case has two).
const fpMarkers: THREE.Mesh[] = [];
for (let i = 0; i < 2; i++) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  m.visible = false;
  STAGE.add(m);
  fpMarkers.push(m);
}

// ── State ──────────────────────────────────────────────────────────

let xi: [number, number, number] = [0.0, 0.0, 0.0];

// Track whether orbits should escape: we stop drawing further iterations
// once a point leaves a generous viewport box.
const ESCAPE_BOX = { xMin: -8, xMax: 8, yMin: 0.001, yMax: 8 };

function inBox(z: [number, number]): boolean {
  return z[0] >= ESCAPE_BOX.xMin && z[0] <= ESCAPE_BOX.xMax &&
         z[1] >= ESCAPE_BOX.yMin && z[1] <= ESCAPE_BOX.yMax;
}

// ── Fixed-point computation ────────────────────────────────────────
//
// For g = [[a, b], [c, d]] ∈ SL(2, ℝ), Möbius fixed points satisfy
//   c z² + (d − a) z − b = 0
// with discriminant (d − a)² + 4bc = (a + d)² − 4 = tr² − 4.
//   tr² > 4: hyperbolic — two real boundary fixed points
//   tr² < 4: elliptic — complex-conjugate pair, pick the one in ℍ²
//   tr² = 4: parabolic — one repeated real fixed point
//   c = 0:   linear map; fixed point at b/(d−a) on the real axis
//            (or "at ∞" when a = d)

function fixedPoints(g: Matrix): [number, number][] {
  const a = g.data[0], b = g.data[1], c = g.data[2], d = g.data[3];
  const T = a + d;
  const disc = T * T - 4;

  if (Math.abs(c) < 1e-12) {
    if (Math.abs(d - a) < 1e-12) return [];   // fp at ∞ — don't render
    return [[b / (d - a), 0]];
  }

  if (disc > 1e-9) {
    const s = Math.sqrt(disc);
    return [
      [(a - d + s) / (2 * c), 0],
      [(a - d - s) / (2 * c), 0],
    ];
  } else if (disc < -1e-9) {
    const s = Math.sqrt(-disc);
    // im part = s/(2c); we want it positive (upper half plane).
    return [[(a - d) / (2 * c), s / (2 * Math.abs(c))]];
  } else {
    return [[(a - d) / (2 * c), 0]];
  }
}

// ── Update ──────────────────────────────────────────────────────────

function update() {
  const g = SL2R.exp(xi);

  // Each seed: iterate g forward, fill its line geometry.
  for (let si = 0; si < SEEDS.length; si++) {
    const seed = SEEDS[si];
    const line = orbitLines[si];
    const positions = (line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;

    let z: [number, number] = [seed.point[0], seed.point[1]];
    let i = 0;
    let alive = true;
    for (; i <= ITERATIONS; i++) {
      if (!inBox(z)) { alive = false; break; }
      positions[i * 3]     = z[0];
      positions[i * 3 + 1] = z[1];
      positions[i * 3 + 2] = 0;
      if (i < ITERATIONS) z = mobiusSL2R(g, z);
    }
    line.geometry.setDrawRange(0, alive ? ITERATIONS + 1 : i);
    (line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  // Fixed points.
  const fps = fixedPoints(g);
  for (let i = 0; i < fpMarkers.length; i++) {
    if (i < fps.length) {
      fpMarkers[i].visible = true;
      fpMarkers[i].position.set(fps[i][0], fps[i][1], 0.001);
    } else {
      fpMarkers[i].visible = false;
    }
  }

  // Readouts.
  const cls = classifySL2R(g);
  const trG = g.data[0] + g.data[3];
  readoutTrace.textContent = trG.toFixed(3);
  readoutClass.textContent = cls;
  readoutClass.style.color = colorForClass(cls);
  readoutFP.textContent = fps.length === 0 ? 'at ∞'
    : fps.map((p) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`).join('  ');
}

function colorForClass(cls: SL2RClass): string {
  switch (cls) {
    case 'elliptic':   return '#3366cc';
    case 'parabolic':  return '#aa6622';
    case 'hyperbolic': return '#cc3333';
  }
}

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:240px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <div style="font-weight:bold;">Möbius on ℍ²</div>
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>ξ_H  (scaling)</span><span id="m-h-v">${xi[0].toFixed(2)}</span>
  </label>
  <input id="m-h" type="range" min="-1.5" max="1.5" step="0.01" value="${xi[0]}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>ξ_E  (upper unipotent)</span><span id="m-e-v">${xi[1].toFixed(2)}</span>
  </label>
  <input id="m-e" type="range" min="-1.5" max="1.5" step="0.01" value="${xi[1]}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>ξ_F  (lower unipotent)</span><span id="m-f-v">${xi[2].toFixed(2)}</span>
  </label>
  <input id="m-f" type="range" min="-1.5" max="1.5" step="0.01" value="${xi[2]}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:6px;">
    <span>tr g</span><span id="m-trace">—</span>
    <span>class</span><span id="m-class">—</span>
    <span>fixed pt(s)</span><span id="m-fp">—</span>
  </div>
  <div style="display:flex;gap:4px;margin-top:6px;">
    <button id="m-elliptic"  style="flex:1;padding:3px 6px;font-size:10px;">elliptic</button>
    <button id="m-parabolic" style="flex:1;padding:3px 6px;font-size:10px;">parabolic</button>
    <button id="m-hyperbolic" style="flex:1;padding:3px 6px;font-size:10px;">hyperbolic</button>
  </div>
  <div style="font-size:10px;color:#888;margin-top:4px;line-height:1.5;">
    g = exp(ξ_H · H + ξ_E · E + ξ_F · F)<br>
    H = scaling, E = upper, F = lower
  </div>
`;
document.body.appendChild(panel);

const readoutTrace = panel.querySelector<HTMLSpanElement>('#m-trace')!;
const readoutClass = panel.querySelector<HTMLSpanElement>('#m-class')!;
const readoutFP    = panel.querySelector<HTMLSpanElement>('#m-fp')!;

function bindSlider(id: string, valId: string, idx: number) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = v.toFixed(2);
    xi[idx] = v;
    update();
  });
}
bindSlider('m-h', 'm-h-v', 0);
bindSlider('m-e', 'm-e-v', 1);
bindSlider('m-f', 'm-f-v', 2);

function setXi(newXi: [number, number, number]) {
  xi = newXi;
  panel.querySelector<HTMLInputElement>('#m-h')!.value = String(xi[0]);
  panel.querySelector<HTMLInputElement>('#m-e')!.value = String(xi[1]);
  panel.querySelector<HTMLInputElement>('#m-f')!.value = String(xi[2]);
  panel.querySelector<HTMLSpanElement>('#m-h-v')!.textContent = xi[0].toFixed(2);
  panel.querySelector<HTMLSpanElement>('#m-e-v')!.textContent = xi[1].toFixed(2);
  panel.querySelector<HTMLSpanElement>('#m-f-v')!.textContent = xi[2].toFixed(2);
  update();
}

panel.querySelector<HTMLButtonElement>('#m-elliptic')!  .addEventListener('click', () => setXi([0.0, 0.4, -0.4]));
panel.querySelector<HTMLButtonElement>('#m-parabolic')! .addEventListener('click', () => setXi([0.0, 0.5,  0.0]));
panel.querySelector<HTMLButtonElement>('#m-hyperbolic')!.addEventListener('click', () => setXi([0.6, 0.0,  0.0]));

// ── Boot ────────────────────────────────────────────────────────────

setXi([0.0, 0.4, -0.4]);   // start with an elliptic example
app.start();
