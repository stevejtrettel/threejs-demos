/**
 * certify-krawczyk — the moment a numerical answer becomes a theorem.
 *
 * The sequel to `certify-descent`, which left off with a point satisfying
 * `G = (g, F₁, F₂ − 1) = 0` to fifteen digits and the remark that fifteen
 * digits is not a proof. This is the proof.
 *
 * ## The test
 *
 * Take the approximate root `x̂`, a box `X` of radius `r` around it, and any
 * fixed matrix `Y` — in practice `DG(x̂)⁻¹`, computed in ordinary floating
 * point. Form
 *
 *     K(X) = x̂ − Y·G(x̂) + (I − Y·DG(X))·(X − x̂)
 *
 * where `DG(X)` is the Jacobian evaluated in *interval* arithmetic over the
 * whole box at once, so it encloses `DG(p)` for every `p ∈ X` simultaneously.
 *
 * **If `K(X)` lies strictly inside `X`, then `G` has exactly one zero in `X`.**
 *
 * The two terms are worth separating. The first is just a Newton step from the
 * centre — where the root approximately is. The second is a rigorous bound on
 * everything Newton's linearization discarded, computed over the entire box
 * rather than at a point. The test passes when that admission of ignorance
 * still fits inside the box you started with.
 *
 * Note what is *not* required: nothing about `Y` has to be verified. A bad `Y`
 * makes the test fail, never makes it lie. That asymmetry is what lets a proof
 * be steered by floating-point guesswork — the numerics propose, the intervals
 * dispose.
 *
 * ## What is on screen
 *
 * The wireframe cube is `X`. The solid box inside it is `K(X)` — green when
 * contained, red when not, with the offending faces lit. The dark marker is the
 * centre `x̂`; the small ring is the true root, which in general is *not* the
 * centre and is the whole reason the box has to have some width.
 *
 * The box's edges run along the coordinate axes because that is what a box in
 * interval arithmetic *is*: a product of intervals, one per coordinate. It is
 * unashamedly coordinate-dependent — rotate the frame and it is a different
 * test, on a different region. The surface cutting through it at an angle is
 * the reminder. (Choosing coordinates in which the boxes are tight is a real
 * part of making certificates work at scale.)
 *
 * ## The two ways it fails, which mean opposite things
 *
 * Sweep the radius and the test fails at both ends, for reasons that call for
 * opposite responses.
 *
 *   • **Too big** — `‖I − Y·DG(X)‖ ≥ 1`. The Jacobian varies too much across
 *     the box for the linearization to control it, `K` stops being a
 *     contraction, and `K(X)` bursts out in every direction at once. Shrink the
 *     box. For this system the wall sits at `r ≈ 0.103`, and no centre however
 *     good moves it — it is a property of the *system*.
 *   • **Too small** — the box simply does not contain the root. `K` still
 *     contracts, but its image slides out of one side, pointing at where the
 *     root actually is. Polish the centre, or widen the box. This edge is a
 *     property of the *centre*: it sits near `‖Y·G(x̂)‖`, so every Newton step
 *     on `x̂` drives it down by orders of magnitude.
 *
 * The strip along the bottom is the whole picture in one line: the certified
 * band of radii over sixteen decades, in the same two failure colours. The
 * shaded portion is the range this view can actually show at a fixed zoom —
 * with a polished centre the band runs far off the left of it, which is why
 * that strip exists rather than a camera that zooms.
 *
 * ## Rounding
 *
 * A certificate meant for publication rounds every interval operation outward,
 * so the enclosures survive floating-point error too. JavaScript cannot set the
 * rounding mode and `@/math/interval` does not emulate it, so these boxes can be
 * wrong in the last bit or so. Everything that is visible at this scale is
 * unaffected; nothing here should be mistaken for a certificate. What *is*
 * checked, in `scripts/validate-krawczyk.ts`, is the property the picture
 * depends on: that the interval evaluations genuinely enclose `G` and `DG` over
 * their boxes.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { krawczyk, certifiedRadiusWindow, type KrawczykResult } from '@/math/certify';
import { imid, irad, type Interval } from '@/math/interval';
import { marchingSquares, chainSegments } from '@/math/geometry';
import { newton } from '@/math/rootfind';
import {
  F,
  SOLUTIONS,
  TARGET,
  intervalSystem,
  lift,
  residual,
  squareSystem,
  surface,
  toWorld,
} from '../_shared/fermatSystem';

// --- Palette ----------------------------------------------------------------

const BG = 0xf0ede8;
const RESIDUAL_NEAR = 0x33505e;
const RESIDUAL_FAR = 0xdfe4e4;
const CURVE_F1 = 0x7a1f2c;
const CURVE_F2 = 0xc79025;
const INK = 0x22262b;
const BOX_EDGE = 0x2c2c2c; // the box X
const CERTIFIED = 0x3f8f5e; // K(X) inside — proved
const CENTER_OFF = 0xc25a35; // K(X) slides out — the box misses the root
const NO_CONTRACTION = 0x8e3d6b; // K(X) explodes — the box is too big
const ROOT_RING = 0x2e8b87;

// --- The point being certified ----------------------------------------------
//
// The true root, and the deliberately rough centre the demo starts from: about
// 1.6e-2 away, which is the quality a descent hands over. Both walls of its
// certified window then land inside the radius range this fixed view can show.

const ROOT = newton(squareSystem, SOLUTIONS[0]).point;
const START = ROOT.map((c, i) => c + [0.012, -0.009, 0.006][i]);

const MAX_POLISH = 5;

/** Newton steps applied to the starting centre. Drives the lower wall. */
let polish = 0;

/** log₁₀ of the box radius. */
let logRadius = -1.5;

// The sweep range. At the starting centre the certified band is
// [1.4e-2, 8.8e-2], so this runs from comfortably inside the "too small"
// failure to comfortably inside the "too big" one, and the framing below is
// chosen so both walls are legible: the box spans 6% of the frame at the bottom
// of the sweep and fills it at the top.
const LOG_MIN = -2.0;
const LOG_MAX = -0.8;

let showCurves = true;
let autoSweep = true;
let sweepPhase = 0;
let idleFor = 0;

const centerFor = (steps: number): number[] =>
  newton(squareSystem, START, { maxIterations: steps }).point;

let center = centerFor(polish);
let result: KrawczykResult = krawczyk(intervalSystem, center, 10 ** logRadius);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
const focus = toWorld(ROOT);
// ~0.35 across at the default fov: the certified boxes run from 8% to 50% of
// that, and a box past the contraction wall overflows it, which is the point.
app.camera.position.set(focus.x + 0.22, focus.y + 0.17, focus.z + 0.25);
app.controls.target.copy(focus);
app.controls.update();
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(1, 1.4, 0.8);
app.scene.add(key);

const fill = new THREE.DirectionalLight(0xffe6c4, 0.6);
fill.position.set(-1.2, 0.4, 1);
app.scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff8ec, 0.5);
rim.position.set(-0.6, 1, -0.8);
app.scene.add(rim);

// --- The surface, as a patch around the root --------------------------------

const PATCH = 0.22;
const PATCH_CHART = {
  xMin: ROOT[0] - PATCH,
  xMax: ROOT[0] + PATCH,
  yMin: ROOT[1] - PATCH,
  yMax: ROOT[1] + PATCH,
};

{
  const n = 90;
  const positions = new Float32Array((n + 1) * (n + 1) * 3);
  const colors = new Float32Array((n + 1) * (n + 1) * 3);
  const indices: number[] = [];

  const near = new THREE.Color(RESIDUAL_NEAR);
  const far = new THREE.Color(RESIDUAL_FAR);
  const scratch = new THREE.Color();

  for (let i = 0; i <= n; i++) {
    const x = PATCH_CHART.xMin + ((PATCH_CHART.xMax - PATCH_CHART.xMin) * i) / n;
    for (let j = 0; j <= n; j++) {
      const y = PATCH_CHART.yMin + ((PATCH_CHART.yMax - PATCH_CHART.yMin) * j) / n;
      const p = lift(x, y);
      const k = (i * (n + 1) + j) * 3;

      const world = toWorld(p);
      positions[k] = world.x;
      positions[k + 1] = world.y;
      positions[k + 2] = world.z;

      // Same ramp as certify-descent, so this reads as that surface zoomed in.
      const t = Math.min(1, Math.max(0, (Math.log10(residual(p)) + 1.5) / 3));
      scratch.copy(near).lerp(far, t);
      colors[k] = scratch.r;
      colors[k + 1] = scratch.g;
      colors[k + 2] = scratch.b;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  app.scene.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    ),
  );
}

// --- The two curves, whose crossing is the root -----------------------------
//
// Kept on by default here, unlike in certify-descent: at this zoom the surface
// is a nearly featureless sheet, and the curves are what make the marked point
// legible as *the* solution rather than an arbitrary spot.

const curveGroup = new THREE.Group();
app.scene.add(curveGroup);

{
  const n = 220;
  const trace = (component: 0 | 1, level: number, color: number) => {
    const values: number[] = [];
    for (let j = 0; j < n; j++) {
      const y = PATCH_CHART.yMin + ((PATCH_CHART.yMax - PATCH_CHART.yMin) * j) / (n - 1);
      for (let i = 0; i < n; i++) {
        const x = PATCH_CHART.xMin + ((PATCH_CHART.xMax - PATCH_CHART.xMin) * i) / (n - 1);
        values.push(F.value(lift(x, y))[component]);
      }
    }

    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    for (const polyline of chainSegments(
      marchingSquares({ nx: n, ny: n, values, ...PATCH_CHART }, level),
    )) {
      const points = polyline.map(([x, y]) => {
        const p = lift(x, y);
        const normal = surface.unitNormal(p);
        return toWorld([p[0] + 0.002 * normal[0], p[1] + 0.002 * normal[1], p[2] + 0.002 * normal[2]]);
      });
      const cleaned: THREE.Vector3[] = [];
      for (const p of points) {
        if (!cleaned.length || cleaned[cleaned.length - 1].distanceTo(p) > 1e-9) cleaned.push(p);
      }
      if (cleaned.length < 2) continue;
      curveGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cleaned), cleaned.length * 2, 0.0022, 8, false),
          material,
        ),
      );
    }
  };

  trace(0, TARGET[0], CURVE_F1);
  trace(1, TARGET[1], CURVE_F2);
}

// --- Boxes ------------------------------------------------------------------
//
// A box in interval arithmetic is a product of intervals, so both `X` and
// `K(X)` are axis-aligned in the *system's* coordinates. `toWorld` is a cyclic
// permutation of those coordinates, so they stay axis-aligned on screen and the
// half-widths permute the same way the midpoints do.

interface WorldBox {
  center: THREE.Vector3;
  half: THREE.Vector3;
}

function worldBox(b: Interval[]): WorldBox {
  return {
    center: toWorld([imid(b[0]), imid(b[1]), imid(b[2])]),
    half: new THREE.Vector3(irad(b[1]), irad(b[2]), irad(b[0])),
  };
}

/** Twelve cylinders of constant thickness, laid along a box's edges. */
class BoxFrame {
  readonly mesh: THREE.InstancedMesh;
  private readonly thickness: number;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(material: THREE.Material, thickness: number) {
    this.thickness = thickness;
    this.mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 8, 1),
      material,
      12,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }

  update(b: WorldBox): void {
    const half = [b.half.x, b.half.y, b.half.z];
    const center = [b.center.x, b.center.y, b.center.z];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const up = new THREE.Vector3(0, 1, 0);

    let instance = 0;
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      for (const su of [-1, 1]) {
        for (const sv of [-1, 1]) {
          const p = [...center];
          p[u] += su * half[u];
          p[v] += sv * half[v];

          this.position.set(p[0], p[1], p[2]);
          this.quaternion.setFromUnitVectors(up, axes[axis]);
          // Overshoot by the thickness so the corners close up.
          this.scale.set(this.thickness, 2 * half[axis] + 2 * this.thickness, this.thickness);
          this.matrix.compose(this.position, this.quaternion, this.scale);
          this.mesh.setMatrixAt(instance++, this.matrix);
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const boxFrame = new BoxFrame(
  new THREE.MeshStandardMaterial({ color: BOX_EDGE, roughness: 0.5 }),
  0.003,
);
app.scene.add(boxFrame.mesh);

const imageMaterial = new THREE.MeshStandardMaterial({
  color: CERTIFIED,
  roughness: 0.5,
  transparent: true,
  opacity: 0.42,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const imageMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), imageMaterial);
app.scene.add(imageMesh);

const imageFrame = new BoxFrame(
  new THREE.MeshStandardMaterial({ color: CERTIFIED, roughness: 0.45 }),
  0.002,
);
app.scene.add(imageFrame.mesh);

// --- Markers ----------------------------------------------------------------

const centerMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.005, 20, 20),
  new THREE.MeshStandardMaterial({ color: INK, roughness: 0.3, metalness: 0.15 }),
);
app.scene.add(centerMarker);

// The true root, as a ring so it stays visible when the centre sits on top of
// it — which is exactly what full polish looks like.
const rootMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.010, 0.0018, 10, 40),
  new THREE.MeshStandardMaterial({ color: ROOT_RING, roughness: 0.4 }),
);
rootMarker.position.copy(toWorld(ROOT));
rootMarker.lookAt(app.camera.position);
app.scene.add(rootMarker);

// --- Readout, controls, spectrum --------------------------------------------

const style = document.createElement('style');
style.textContent = `
  .panel {
    position: absolute; bottom: 16px; right: 16px;
    max-width: 34%; min-width: 220px; padding: 8px 10px;
    z-index: 10; pointer-events: auto;
    font: 12px/1.7 ui-monospace, monospace; color: #5A5148;
  }
  .panel label { display: block; margin-bottom: 2px; }
  .thin-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 5px; margin: 0 0 8px;
    background: transparent; outline: none; cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
  .thin-slider::-webkit-slider-runnable-track {
    height: 5px; background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 999px; box-sizing: border-box;
  }
  .thin-slider::-moz-range-track {
    height: 5px; background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 999px; box-sizing: border-box;
  }
  .thin-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; margin-top: -5px;
    background: #fff; border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%; box-sizing: border-box; cursor: pointer;
  }
  .thin-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    background: #fff; border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%; box-sizing: border-box; cursor: pointer;
  }
  .readout {
    position: absolute; top: 16px; left: 16px; z-index: 10;
    font: 12px/1.7 ui-monospace, monospace; color: #5A5148;
    font-variant-numeric: tabular-nums;
  }
  .readout .head { font-size: 13px; }
  .hint { opacity: 0.65; }
  .spectrum {
    position: absolute; bottom: 16px; left: 16px; z-index: 10;
    font: 11px/1.5 ui-monospace, monospace; color: #5A5148;
  }
  .spectrum canvas { display: block; }
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <label>box radius r = <span id="r-value"></span></label>
  <input id="r" type="range" class="thin-slider"
    min="${LOG_MIN}" max="${LOG_MAX}" step="0.001" value="${logRadius}" />
  <label>polish x̂ — <span id="polish-value">0</span> Newton steps</label>
  <input id="polish" type="range" class="thin-slider"
    min="0" max="${MAX_POLISH}" step="1" value="0" />
  <label><input id="curves" type="checkbox" checked /> show {F₁ = 0} and {F₂ = 1}</label>
`;
document.body.appendChild(panel);

const readout = document.createElement('div');
readout.className = 'readout';
document.body.appendChild(readout);

const spectrumWrap = document.createElement('div');
spectrumWrap.className = 'spectrum';
const spectrum = document.createElement('canvas');
spectrum.width = 300;
spectrum.height = 30;
spectrumWrap.appendChild(spectrum);
const spectrumLabel = document.createElement('div');
spectrumWrap.appendChild(spectrumLabel);
document.body.appendChild(spectrumWrap);

const rValue = panel.querySelector<HTMLSpanElement>('#r-value')!;
const polishValue = panel.querySelector<HTMLSpanElement>('#polish-value')!;
const rSlider = panel.querySelector<HTMLInputElement>('#r')!;
const polishSlider = panel.querySelector<HTMLInputElement>('#polish')!;

rSlider.addEventListener('input', () => {
  logRadius = parseFloat(rSlider.value);
  autoSweep = false;
  idleFor = 0;
});
polishSlider.addEventListener('input', () => {
  polish = parseInt(polishSlider.value, 10);
  center = centerFor(polish);
  idleFor = 0;
  drawSpectrum();
});
panel.querySelector<HTMLInputElement>('#curves')!.addEventListener('change', (e) => {
  showCurves = (e.target as HTMLInputElement).checked;
  curveGroup.visible = showCurves;
});

const SPECTRUM_MIN = -16;
const SPECTRUM_MAX = 0;

/**
 * The certified band over sixteen decades of radius, one Krawczyk test per
 * pixel column, coloured by verdict. Recomputed only when the centre changes —
 * the band does not depend on where the radius slider currently sits.
 */
function drawSpectrum(): void {
  const ctx = spectrum.getContext('2d')!;
  const { width, height } = spectrum;
  ctx.clearRect(0, 0, width, height);

  const bar = height - 10;
  for (let px = 0; px < width; px++) {
    const r = 10 ** (SPECTRUM_MIN + ((SPECTRUM_MAX - SPECTRUM_MIN) * px) / (width - 1));
    const verdict = krawczyk(intervalSystem, center, r).verdict;
    ctx.fillStyle =
      verdict === 'certified'
        ? '#3f8f5e'
        : verdict === 'no-contraction'
          ? '#8e3d6b'
          : '#c25a35';
    ctx.globalAlpha = verdict === 'certified' ? 0.95 : 0.35;
    ctx.fillRect(px, 0, 1, bar);
  }

  // Mark the slice of the band this fixed-zoom view can actually show.
  ctx.globalAlpha = 1;
  const toPixel = (log: number) =>
    ((log - SPECTRUM_MIN) / (SPECTRUM_MAX - SPECTRUM_MIN)) * (width - 1);
  ctx.strokeStyle = 'rgba(44,44,44,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(toPixel(LOG_MIN) + 0.5, 0.5, toPixel(LOG_MAX) - toPixel(LOG_MIN), bar - 1);

  const band = certifiedRadiusWindow(intervalSystem, center);
  spectrumLabel.innerHTML = band.min
    ? `certified r ∈ [${band.min.toExponential(1)}, ${band.max!.toExponential(1)}]` +
      `<span class="hint"> &nbsp; 10⁻¹⁶ … 10⁰, boxed = shown above</span>`
    : 'no radius certifies';

  // Cache the finished band so the per-frame marker can be stamped over a copy
  // rather than re-running 300 Krawczyk tests. Must happen here, not once at
  // startup: changing the polish redraws the band, and a stale cache would
  // paint the old one straight back over it.
  bandImage = ctx.getImageData(0, 0, width, height);
}

/** The band as last drawn, with no radius marker on it. */
let bandImage: ImageData | null = null;

function drawMarker(): void {
  const ctx = spectrum.getContext('2d')!;
  const { width, height } = spectrum;
  const bar = height - 10;

  if (!bandImage) return;
  ctx.putImageData(bandImage, 0, 0);

  const px = ((logRadius - SPECTRUM_MIN) / (SPECTRUM_MAX - SPECTRUM_MIN)) * (width - 1);
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(px - 1, -2, 2, bar + 6);
}

function updateReadout(): void {
  const verdict = result.verdict;
  const headline =
    verdict === 'certified'
      ? '<span class="head">CERTIFIED</span><br>exactly one root of G in this box'
      : verdict === 'no-contraction'
        ? '<span class="head">inconclusive</span><br>the box is too big — the Jacobian is not near-constant on it'
        : verdict === 'center-off'
          ? '<span class="head">inconclusive</span><br>the box is too small to contain the root'
          : '<span class="head">inconclusive</span><br>DG(x̂) is singular';

  const axes = ['x', 'y', 'z'];
  const escaping = result.escaping.length
    ? `<br><span class="hint">K(X) escapes in ${result.escaping.map((i) => axes[i]).join(', ')}</span>`
    : '';

  readout.innerHTML = [
    headline + escaping,
    '',
    `r = ${(10 ** logRadius).toExponential(2)}`,
    `‖G(x̂)‖ = ${result.residual.toExponential(2)} &nbsp; <span class="hint">(${polish} Newton step${polish === 1 ? '' : 's'})</span>`,
    `‖I − Y·DG(X)‖ = ${result.contraction.toFixed(3)} <span class="hint">${result.contraction < 1 ? '&lt; 1, contracts' : '≥ 1, does not contract'}</span>`,
  ].join('<br>');
}

// --- Update -----------------------------------------------------------------

function update(): void {
  const radius = 10 ** logRadius;
  result = krawczyk(intervalSystem, center, radius);

  const X = worldBox(result.box);
  boxFrame.update(X);

  const color =
    result.verdict === 'certified'
      ? CERTIFIED
      : result.verdict === 'no-contraction'
        ? NO_CONTRACTION
        : CENTER_OFF;
  imageMaterial.color.set(color);
  (imageFrame.mesh.material as THREE.MeshStandardMaterial).color.set(color);

  if (result.image.length) {
    const K = worldBox(result.image);
    imageMesh.position.copy(K.center);
    imageMesh.scale.set(Math.max(2 * K.half.x, 1e-6), Math.max(2 * K.half.y, 1e-6), Math.max(2 * K.half.z, 1e-6));
    imageFrame.update(K);
    imageMesh.visible = true;
    imageFrame.mesh.visible = true;
  } else {
    imageMesh.visible = false;
    imageFrame.mesh.visible = false;
  }

  centerMarker.position.copy(toWorld(center));
  rootMarker.lookAt(app.camera.position);

  rValue.textContent = radius.toExponential(2);
  polishValue.textContent = String(polish);
  rSlider.value = String(logRadius);

  updateReadout();
  drawMarker();
}

drawSpectrum();
update();

// --- Go ---------------------------------------------------------------------
//
// The radius sweeps on its own until you take the slider, then resumes a few
// seconds after you let go — the sweep crosses both walls, so the demo shows
// its whole story without anyone touching it.

const SWEEP_PERIOD = 11; // seconds for a there-and-back sweep
const RESUME_AFTER = 6;

app.addAnimateCallback((_elapsed, delta) => {
  const dt = Math.min(delta, 0.1);

  if (autoSweep) {
    sweepPhase += dt / SWEEP_PERIOD;
    // Cosine so it lingers at both walls rather than racing past them.
    const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * sweepPhase);
    logRadius = LOG_MIN + (LOG_MAX - LOG_MIN) * t;
  } else {
    idleFor += dt;
    if (idleFor > RESUME_AFTER) {
      autoSweep = true;
      // Re-enter the sweep at the current radius rather than jumping.
      const t = (logRadius - LOG_MIN) / (LOG_MAX - LOG_MIN);
      sweepPhase = Math.acos(1 - 2 * Math.min(1, Math.max(0, t))) / (2 * Math.PI);
    }
  }

  update();
});

app.start();
