/**
 * The exclusion picture in 3D: the lower-bound surface, cut by the upper-bound plane.
 *
 * Graphed over the (a, b) chart, the lower bound L_R(σ) (inner-hull area of the
 * stable-norm ball) is a landscape. We float a translucent horizontal plane at
 * the modular torus's upper bound U_{R*}(hex) and colour the surface by which
 * side of the plane it is on:
 *   • ABOVE the plane → L_R(σ) > U_{R*}(hex) ⇒ V(σ) > V(hex): excluded (warm).
 *   • BELOW the plane → undetermined (cool).
 * Colour is full-saturation inside the SL(2,ℤ) fundamental domain and fades to
 * muted outside. Toggle the lower-field R and the plane's R*.
 *
 * The above/below split and the fundamental-domain edge are evaluated PER PIXEL
 * in the fragment shader (the field as a texture, the domain test analytic) and
 * anti-aliased with fwidth — so both boundaries are crisp, not vertex-blurred.
 * The lower-bound field is precomputed offline (see precompute.ts).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { marchingSquares, type ScalarGrid } from '@/math/geometry';
import { applyStage } from '../_shared/theme';
import { HEX_SEED, SQUARE_SEED, markoffOrbit } from '../_shared/markoffSymmetry';
import { normBallUpperArea } from '../_shared/stableNormUpper';
import type { TraceTriple } from '../_shared/markoff';
import data from './lowerFieldData';

const { n: N, rWin: RW, lowerRs: LOWER_RS, fields } = data;
const HEX: TraceTriple = { x: 3, y: 3, z: 3 };

// Vertical mapping: autoscaled to the CURRENT field's own range (no clamp), so
// each surface fills the height and nothing flat-lines. Recomputed on toggle.
// (The fields live in very different ranges — R=2 in [0.51, 0.93], R=5 in
// [0.89, 1.04] — so a single fixed window would crush one of them flat.)
const HEIGHT = 2.6, GAMMA = 0.7; // gamma < 1 gives the shallow region more relief
let VMIN = 0, VMAX = 1;
function setScale(f: readonly (number | null)[]): void {
  VMIN = Infinity; let fmax = -Infinity;
  for (const v of f) { if (v == null) continue; if (v < VMIN) VMIN = v; if (v > fmax) fmax = v; }
  // If the plane sits above the surface, extend the top of the view (with headroom)
  // so it floats visibly above instead of clamping.
  const pv = planeValue();
  VMAX = pv > fmax ? pv + 0.04 : fmax;
}
const sNorm = (v: number) => Math.pow(Math.max(0, Math.min(1, (v - VMIN) / (VMAX - VMIN))), GAMMA);
const yOf = (v: number) => sNorm(v) * HEIGHT;

// --- Bilinear grid sampling (CPU: surface height + marker placement) ---------

function bilinear(arr: readonly (number | null)[], a: number, b: number): number {
  if (a * a + b * b > RW * RW) return NaN;
  const fi = ((a + RW) / (2 * RW)) * (N - 1);
  const fj = ((b + RW) / (2 * RW)) * (N - 1);
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  if (i0 < 0 || j0 < 0 || i0 >= N - 1 || j0 >= N - 1) return NaN;
  const tx = fi - i0, ty = fj - j0;
  const at = (i: number, j: number) => { const v = arr[j * N + i]; return v == null ? NaN : v; };
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) return NaN;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

// --- Field as a half-float texture (linear-filterable, for the shader) -------

function buildFieldTexture(R: number): THREE.DataTexture {
  // Full float (not half): the surface is very shallow, so half-float quantization
  // would shift the shader's L=threshold crossing off the marching-squares line.
  const vals = fields[String(R)]!;
  const buf = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) buf[k] = vals[k] == null ? -1 : (vals[k] as number);
  const tex = new THREE.DataTexture(buf, N, N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}
const fieldTextures = new Map(LOWER_RS.map((R) => [R, buildFieldTexture(R)]));

// --- State + shared uniform objects (mutated live) --------------------------

let lowerR = LOWER_RS.includes(5) ? 5 : LOWER_RS[LOWER_RS.length - 1]!;
let upperR = 5;
const planeValue = (): number => normBallUpperArea(HEX, upperR);
let field = fields[String(lowerR)]!;
let threshold = planeValue();
setScale(field);

const uField = { value: fieldTextures.get(lowerR)! };
const uThreshold = { value: threshold };
const uWarm = { value: new THREE.Color('#d6342c') };     // above plane: excluded (red)
const uCool = { value: new THREE.Color('#2f6ad9') };     // below plane: undetermined (blue)
const uMute = { value: new THREE.Color('#bdb9b0') };     // desaturation target outside FD
const uFDLine = { value: new THREE.Color('#3a3a3a') };   // fundamental-domain boundary
const uBoundary = { value: new THREE.Color('#8e3fc0') }; // red/blue boundary (purple)
const uRW = { value: RW };
const uN = { value: N };
const uLineW = { value: 0.009 };   // FD line half-width, world (a,b) units
const uLineWp = { value: 0.0045 }; // red/blue line half-width, world units

// --- Fragment shader: per-pixel above/below + analytic domain mask -----------

const fragmentShader = `
  uniform sampler2D uField;
  uniform float uThreshold, uRW, uN, uLineW, uLineWp;
  uniform vec3 uWarm, uCool, uMute, uFDLine, uBoundary;

  // Signed fundamental-domain margin at chart point ab: lift (a,b) to the trace
  // triple (largest root of the chart cubic), then min of the sector/reduced/valid
  // walls. Its zero set is the FD boundary; |grad| gives world distance to it.
  float dMargin(vec2 ab) {
    float a = ab.x, b = ab.y;
    float rho2 = a * a + b * b;
    float S2 = sqrt(2.0), S3 = sqrt(3.0), S6 = sqrt(6.0);
    float e3 = b * (3.0 * a * a - b * b) / (3.0 * S6);
    float A = -3.0 * S3, B = -1.5 * rho2, C = -3.0 * S3 * (rho2 - e3);
    float p = B - A * A / 3.0;
    float q = 2.0 * A * A * A / 27.0 - A * B / 3.0 + C;
    float shift = -A / 3.0;
    float disc = -4.0 * p * p * p - 27.0 * q * q;
    float h;
    if (disc >= 0.0) {
      float m = 2.0 * sqrt(max(-p / 3.0, 1e-9));
      h = m * cos(acos(clamp(3.0 * q / (p * m), -1.0, 1.0)) / 3.0) + shift;
    } else {
      float ss = sqrt(q * q / 4.0 + p * p * p / 27.0);
      float u = -q / 2.0 + ss, v = -q / 2.0 - ss;
      h = sign(u) * pow(abs(u), 1.0 / 3.0) + sign(v) * pow(abs(v), 1.0 / 3.0) + shift;
    }
    float iS3 = 1.0 / S3;
    float x = iS3 * h + a / S2 + b / S6;
    float y = iS3 * h - a / S2 + b / S6;
    float z = iS3 * h - 2.0 * b / S6;
    // Sector 30°..90° via smooth cross-products (no atan2 branch cut, which would
    // otherwise plant a spurious line along the negative-a ray out of the origin).
    float d = 0.8660254038 * b - 0.5 * a;  // CCW of the 30° ray  (ang >= 30°)
    d = min(d, a);                          // CW of the 90° ray   (ang <= 90°)
    d = min(d, y * z - 2.0 * x);           // Markoff-reduced (three walls)
    d = min(d, x * z - 2.0 * y);
    d = min(d, x * y - 2.0 * z);
    d = min(d, min(min(x, y), z) - 2.0);   // valid (Teichmüller)
    return d;
  }

  void main() {
    vec2 ab = (vMapUv * 2.0 - 1.0) * uRW;
    float L = texture2D(uField, vMapUv).r;

    // above/below the plane (fill), AA'd across the crossing.
    float wL = max(fwidth(L), 1e-5);
    vec3 base = mix(uCool, uWarm, smoothstep(uThreshold - wL, uThreshold + wL, L));

    // fundamental-domain membership → saturated inside, muted (tinted) outside.
    float d = dMargin(ab);
    float wfd = max(fwidth(d), 1e-5);
    float inFD = smoothstep(-wfd, wfd, d);
    vec3 col = mix(mix(base, uMute, 0.6), base, inFD);

    // --- WORLD-space boundary lines: distance = |value| / |grad value|, both in
    // (a,b) units, so the line is a fixed width in the chart (zooms with the geometry).

    // FD line: analytic gradient of d via central differences in (a,b).
    float hh = 0.004;
    vec2 gD = vec2(dMargin(ab + vec2(hh, 0.0)) - dMargin(ab - vec2(hh, 0.0)),
                   dMargin(ab + vec2(0.0, hh)) - dMargin(ab - vec2(0.0, hh))) / (2.0 * hh);
    float wdFD = abs(d) / max(length(gD), 1e-6);
    col = mix(col, uFDLine, 1.0 - smoothstep(uLineW, uLineW * 1.6, wdFD));

    // red/blue line: gradient of L from neighbour texels (masked neighbours fall
    // back to the centre value, so the line reaches the surface edge).
    if (L > 0.0) {
      float du = 1.0 / uN, dA = 2.0 * uRW / uN;
      float Lpa = texture2D(uField, vMapUv + vec2(du, 0.0)).r; Lpa = Lpa < 0.0 ? L : Lpa;
      float Lma = texture2D(uField, vMapUv - vec2(du, 0.0)).r; Lma = Lma < 0.0 ? L : Lma;
      float Lpb = texture2D(uField, vMapUv + vec2(0.0, du)).r; Lpb = Lpb < 0.0 ? L : Lpb;
      float Lmb = texture2D(uField, vMapUv - vec2(0.0, du)).r; Lmb = Lmb < 0.0 ? L : Lmb;
      vec2 gL = vec2(Lpa - Lma, Lpb - Lmb) / (2.0 * dA);
      float wdTh = abs(L - uThreshold) / max(length(gL), 1e-6);
      col = mix(col, uBoundary, 1.0 - smoothstep(uLineWp, uLineWp + 0.0012, wdTh));
    }

    csm_DiffuseColor = vec4(col, 1.0);
  }
`;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true });
applyStage(app);
app.camera.position.set(4.5, 3.6, 5.2);
app.controls.target.set(0, 0.7, 0);

// Responsive layout: canvas + info panel. Landscape → panel overlays the canvas;
// portrait/small screen → they stack (canvas on top, scrollable panel below).
const layoutStyle = document.createElement('style');
layoutStyle.textContent = `
  html, body { margin: 0; height: 100%; }
  #excl-wrap { position: fixed; inset: 0; display: flex; }
  #excl-canvas { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; }
  #excl-canvas canvas { display: block; }
  #excl-panel {
    position: absolute; left: 12px; top: 12px; z-index: 5;
    max-width: 300px; max-height: calc(100% - 24px); overflow: auto;
    font: 12px/1.5 ui-monospace, monospace; color: #2c2c2c;
    background: rgba(247,245,240,0.92); padding: 10px 12px; border-radius: 8px;
    display: flex; flex-direction: column; gap: 8px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.12);
  }
  @media (orientation: portrait), (max-width: 640px) {
    #excl-wrap { flex-direction: column; }
    #excl-canvas { flex: 1 1 58%; }
    #excl-panel {
      position: static; flex: 1 1 42%; max-width: none; max-height: none;
      border-radius: 0; box-shadow: none; border-top: 1px solid rgba(0,0,0,0.15);
    }
  }
`;
document.head.appendChild(layoutStyle);
const wrap = document.createElement('div');
wrap.id = 'excl-wrap';
const canvasHost = document.createElement('div');
canvasHost.id = 'excl-canvas';
wrap.appendChild(canvasHost);
document.body.appendChild(wrap);
app.layout.setCustom({ container: canvasHost });

const SEG = 240;
const domain: SurfaceDomain = { uMin: -RW, uMax: RW, vMin: -RW, vMax: RW };

function buildMesh(): SurfaceMesh {
  const surface: Surface = {
    evaluate(a, b) {
      const v = bilinear(field, a, b);
      return Number.isFinite(v) ? new THREE.Vector3(a, yOf(v), b) : new THREE.Vector3(NaN, NaN, NaN);
    },
    getDomain: () => domain,
  };
  return new SurfaceMesh(surface, {
    uSegments: SEG, vSegments: SEG, roughness: 0.7, metalness: 0.0,
    fragmentShader,
    uniforms: { uField, uThreshold, uWarm, uCool, uMute, uFDLine, uBoundary, uRW, uN, uLineW, uLineWp },
  });
}

let surfMesh = buildMesh();
app.scene.add(surfMesh);

// Translucent upper-bound plane.
const planeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#6f6a60'), transparent: true, opacity: 0.22,
  roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false,
});
const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * RW, 2 * RW), planeMat);
planeMesh.rotation.x = -Math.PI / 2;
planeMesh.position.y = yOf(threshold);
app.scene.add(planeMesh);

// Decorations (rebuilt per field): rim tube hiding the clipped edge, level-set
// contours on the surface, and the special-point markers.
const GRAY = new THREE.Color(0.62, 0.60, 0.56);
let decoGroup = new THREE.Group();
function rebuildDecorations(): void {
  app.scene.remove(decoGroup);
  decoGroup = new THREE.Group();

  // Rim tube: a clean circle following the surface height around the disk edge.
  {
    const RR = RW * 0.995, NR = 480, LIFT = 0.02;
    const rim: THREE.Vector3[] = [];
    for (let k = 0; k < NR; k++) {
      const th = (2 * Math.PI * k) / NR, c = Math.cos(th), sn = Math.sin(th);
      let h = 0;
      for (let rr = RR; rr > RW * 0.9; rr -= 0.008) {
        const v = bilinear(field, rr * c, rr * sn);
        if (Number.isFinite(v)) { h = yOf(v); break; }
      }
      rim.push(new THREE.Vector3(RR * c, h + LIFT, RR * sn));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), NR, 0.03, 12, true);
    decoGroup.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: GRAY, roughness: 0.6 })));
  }

  // Level-set contours, evenly spaced in displayed (gamma-warped) height.
  {
    const grid: ScalarGrid = { nx: N, ny: N, values: field, xMin: -RW, xMax: RW, yMin: -RW, yMax: RW };
    const LEVELS = 18, pts: number[] = [];
    for (let k = 1; k <= LEVELS; k++) {
      const u = k / (LEVELS + 1);
      const level = VMIN + (VMAX - VMIN) * Math.pow(u, 1 / GAMMA);
      const y = u * HEIGHT + 0.004;
      for (const [[ax, ay], [bx, by]] of marchingSquares(grid, level)) pts.push(ax, y, ay, bx, y, by);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    decoGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.4 })));
  }

  // Markers: hexagonal (minima) and square (saddles) tori.
  const addMarkers = (pts: ReadonlyArray<readonly [number, number]>, color: number) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const geo = new THREE.SphereGeometry(0.03, 18, 18);
    for (const [a, b] of pts) {
      const v = bilinear(field, a, b);
      if (!Number.isFinite(v)) continue;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(a, yOf(v) + 0.03, b);
      decoGroup.add(m);
    }
  };
  addMarkers(markoffOrbit(HEX_SEED, RW), 0x2c2c2c);
  addMarkers(markoffOrbit(SQUARE_SEED, RW), 0x3e938f);

  app.scene.add(decoGroup);
}
rebuildDecorations();

// Recompute the plane (and, when needed, the vertical scale + surface) for the
// current upper-bound mode/R*. rebuild=false is the cheap path (R* slider): the
// scale is unchanged, so only the plane moves.
function applyUpperBound(rebuild: boolean): void {
  threshold = planeValue();
  setScale(field);
  uThreshold.value = threshold;
  if (rebuild) {
    app.scene.remove(surfMesh);
    surfMesh.geometry.dispose();
    surfMesh = buildMesh();
    app.scene.add(surfMesh);
    rebuildDecorations();
  }
  planeMesh.position.y = yOf(threshold);
  updateReadout();
}

app.start();

// --- UI ---------------------------------------------------------------------

const ui = document.createElement('div');
ui.id = 'excl-panel'; // styling + responsive placement handled by layoutStyle
wrap.appendChild(ui);
ui.innerHTML =
  '<div><b>Is the modular torus the smallest?</b></div>' +
  '<div style="opacity:0.75">The <b>surface height</b> is a guaranteed <i>lower</i> bound for each torus’s ' +
  'norm-ball area. The <b>flat plane</b> is a guaranteed <i>upper</i> bound for the modular ' +
  '(most symmetric) torus.</div>' +
  '<div style="opacity:0.75">' +
  '<span style="color:#d6342c"><b>red</b></span> — surface pokes above the plane, so this torus is ' +
  'provably bigger than the modular one → it can’t be the smallest.<br>' +
  '<span style="color:#2f6ad9"><b>blue</b></span> — can’t tell yet.<br>' +
  'Vivid = fundamental domain · muted = outside it (irrelevant to the analysis).</div>';

const toggleRow = document.createElement('div');
toggleRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
toggleRow.append(document.createTextNode('lower bound (surface) — curves out to radius:'));
for (const R of LOWER_RS) {
  const btn = document.createElement('button');
  btn.textContent = String(R);
  btn.dataset.r = String(R);
  btn.style.cssText = 'cursor:pointer; border:1px solid rgba(0,0,0,0.25); border-radius:5px; padding:2px 8px; background:#fff;';
  btn.addEventListener('click', () => {
    lowerR = R; field = fields[String(R)]!; uField.value = fieldTextures.get(R)!;
    applyUpperBound(true);
    refreshButtons();
  });
  toggleRow.appendChild(btn);
}
ui.appendChild(toggleRow);
function refreshButtons(): void {
  for (const btn of toggleRow.querySelectorAll('button')) {
    const on = Number((btn as HTMLButtonElement).dataset.r) === lowerR;
    (btn as HTMLButtonElement).style.background = on ? '#7fa6c4' : '#fff';
    (btn as HTMLButtonElement).style.color = on ? '#fff' : '#2c2c2c';
  }
}

// Upper-bound plane: support-line bound, curves out to radius R* — numbered
// buttons, matching the lower-bound row.
const upperRow = document.createElement('div');
upperRow.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;';
upperRow.append(document.createTextNode('upper bound (plane) — curves out to radius:'));
const UPPER_RS = [2, 3, 4, 5, 6, 7, 8];
for (const R of UPPER_RS) {
  const btn = document.createElement('button');
  btn.textContent = String(R); btn.dataset.r = String(R);
  btn.style.cssText = 'cursor:pointer; border:1px solid rgba(0,0,0,0.25); border-radius:5px; padding:2px 8px; background:#fff;';
  btn.addEventListener('click', () => { upperR = R; applyUpperBound(false); refreshUpper(); });
  upperRow.appendChild(btn);
}
ui.appendChild(upperRow);
function refreshUpper(): void {
  for (const btn of upperRow.querySelectorAll('button')) {
    const on = Number((btn as HTMLButtonElement).dataset.r) === upperR;
    (btn as HTMLButtonElement).style.background = on ? '#7fa6c4' : '#fff';
    (btn as HTMLButtonElement).style.color = on ? '#fff' : '#2c2c2c';
  }
}

const readout = document.createElement('div');
readout.style.cssText = 'opacity:0.85; border-top:1px solid rgba(0,0,0,0.15); padding-top:6px;';
ui.appendChild(readout);
function updateReadout(): void {
  readout.innerHTML = `So the modular torus’s area is at most <b>${threshold.toFixed(5)}</b> (support-line bound) ` +
    `— every <span style="color:#d6342c">red</span> torus exceeds this.`;
}

refreshButtons();
refreshUpper();
updateReadout();
