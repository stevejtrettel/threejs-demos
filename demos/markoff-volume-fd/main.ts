/**
 * Stable-norm ball volume over moduli space — one fundamental domain highlighted.
 *
 * Same close-up landscape as `markoff-volume`, but with the tiling demo's vertical
 * rescaling (cap + gamma-warp, so the shallow wells/saddles read), and with the
 * surface grayed everywhere outside a single fundamental domain — the colored
 * sliver is the part of moduli space the function is actually determined on; the
 * gray remainder is its symmetry copies.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { marchingSquares, type ScalarGrid } from '@/math/geometry';
import { applyStage } from '../_shared/theme';
import { HEX_SEED, SQUARE_SEED, markoffOrbit } from '../_shared/markoffSymmetry';
import volumeData from '../_shared/volumeData';

const { n: N, rWin: RW, values: VALUES } = volumeData;

// --- Volume range & vertical scale (cap + gamma-warp, as in the tiling demo) --

let VMIN = Infinity, VMAX = -Infinity;
for (const v of VALUES) { if (v == null) continue; if (v < VMIN) VMIN = v; if (v > VMAX) VMAX = v; }
const VHI = Math.min(VMAX, 1.25);
const GAMMA = 0.5;
const HEIGHT = 2.8;
const s = (v: number) => Math.pow(Math.max(0, Math.min(1, (v - VMIN) / (VHI - VMIN))), GAMMA);
const yOf = (v: number) => s(v) * HEIGHT;

// --- Bilinear sampling of the grid ------------------------------------------

function gridValue(a: number, b: number): number {
  if (a * a + b * b > RW * RW) return NaN;
  const fi = ((a + RW) / (2 * RW)) * (N - 1);
  const fj = ((b + RW) / (2 * RW)) * (N - 1);
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  if (i0 < 0 || j0 < 0 || i0 >= N - 1 || j0 >= N - 1) return NaN;
  const tx = fi - i0, ty = fj - j0;
  const at = (i: number, j: number) => { const v = VALUES[j * N + i]; return v == null ? NaN : v; };
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) return NaN;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

// --- Colour: ramp inside the fundamental domain, gray outside ----------------

const C_LOW = new THREE.Color('#2f6f8f');
const C_MID = new THREE.Color('#d9a93e');
const C_HIGH = new THREE.Color('#cb4f4a');
const GRAY = new THREE.Color(0.66, 0.64, 0.60); // warm gray for the symmetry copies
function ramp(v: number): THREE.Color {
  const t = s(v);
  const c = new THREE.Color();
  return t < 0.5 ? c.copy(C_LOW).lerp(C_MID, t / 0.5) : c.copy(C_MID).lerp(C_HIGH, (t - 0.5) / 0.5);
}

// --- Surface: one mesh, fundamental domain masked PER-PIXEL via a texture ----
//
// Baking the mask into a texture always leaves texel facets. Instead the
// boundary is evaluated ANALYTICALLY per pixel (the chart lift, ported to GLSL)
// and anti-aliased with fwidth — a perfect, resolution-independent edge. The
// texture only carries the smooth volume *color* (low-res is fine, V is smooth).

const SEG = 240;
const domain: SurfaceDomain = { uMin: -RW, uMax: RW, vMin: -RW, vMax: RW };
const surface: Surface = {
  evaluate(a, b) { const v = gridValue(a, b); return Number.isFinite(v) ? new THREE.Vector3(a, yOf(v), b) : new THREE.Vector3(NaN, NaN, NaN); },
  getDomain: () => domain,
};

// Smooth (a,b) → volume-color texture (uv maps linearly to (a,b), sampled as vMapUv).
const MC = 512;
const cdata = new Uint8Array(MC * MC * 4);
for (let j = 0; j < MC; j++) {
  const b = -RW + (2 * RW * j) / (MC - 1);
  for (let i = 0; i < MC; i++) {
    const a = -RW + (2 * RW * i) / (MC - 1);
    const idx = (j * MC + i) * 4;
    const v = gridValue(a, b);
    const c = ramp(Number.isFinite(v) ? v : VMIN);
    cdata[idx] = Math.round(c.r * 255); cdata[idx + 1] = Math.round(c.g * 255); cdata[idx + 2] = Math.round(c.b * 255); cdata[idx + 3] = 255;
  }
}
const colorTex = new THREE.DataTexture(cdata, MC, MC, THREE.RGBAFormat);
colorTex.minFilter = THREE.LinearFilter; colorTex.magFilter = THREE.LinearFilter; colorTex.needsUpdate = true;

// Fragment shader: recover (a,b) from uv, lift to the trace triple analytically
// (largest root of the chart cubic — the Teichmüller sheet), form a signed
// "inside the fundamental domain" margin from the sector + reduced + validity
// conditions, and threshold it with an fwidth-wide (≈1 px) anti-aliased edge.
const fragmentShader = `
  uniform sampler2D uColor;
  uniform vec3 uGray;
  uniform float uRW;
  void main() {
    vec2 ab = (vMapUv * 2.0 - 1.0) * uRW;
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
    if (disc >= 0.0) {                         // three real roots — largest (trig)
      float m = 2.0 * sqrt(max(-p / 3.0, 1e-9));
      h = m * cos(acos(clamp(3.0 * q / (p * m), -1.0, 1.0)) / 3.0) + shift;
    } else {                                   // one real root (Cardano)
      float s = sqrt(q * q / 4.0 + p * p * p / 27.0);
      float u = -q / 2.0 + s, v = -q / 2.0 - s;
      h = sign(u) * pow(abs(u), 1.0 / 3.0) + sign(v) * pow(abs(v), 1.0 / 3.0) + shift;
    }
    float iS3 = 1.0 / S3;
    float x = iS3 * h + a / S2 + b / S6;
    float y = iS3 * h - a / S2 + b / S6;
    float z = iS3 * h - 2.0 * b / S6;

    float ang = atan(b, a);
    float d = ang - 0.5235987756;          // >= 30 deg
    d = min(d, 1.5707963268 - ang);        // <= 90 deg
    d = min(d, y * z - 2.0 * x);           // Markoff-reduced (three walls)
    d = min(d, x * z - 2.0 * y);
    d = min(d, x * y - 2.0 * z);
    d = min(d, min(min(x, y), z) - 2.0);   // valid (Teichmüller)
    float w = max(fwidth(d), 1e-5);
    float inFD = smoothstep(-w, w, d);

    vec3 col = texture2D(uColor, vMapUv).rgb;
    csm_DiffuseColor = vec4(mix(uGray, col, inFD), 1.0);
  }
`;

// --- Scene -------------------------------------------------------------------

const app = new App({ antialias: true });
applyStage(app);
app.camera.position.set(4.5, 3.6, 5.2);
app.controls.target.set(0, 0.7, 0);

app.scene.add(new SurfaceMesh(surface, {
  uSegments: SEG, vSegments: SEG,
  roughness: 0.66, metalness: 0.0,
  fragmentShader,
  uniforms: {
    uColor: { value: colorTex },
    uGray: { value: new THREE.Color().copy(GRAY) },
    uRW: { value: RW },
  },
}));

// A thin tube along the disk rim — hides the surface's clipped (staircase) edge
// behind a clean circle, following the surface height around the boundary.
{
  const RR = RW * 0.995, NR = 480, LIFT = 0.02;
  const rim: THREE.Vector3[] = [];
  for (let k = 0; k < NR; k++) {
    const th = (2 * Math.PI * k) / NR;
    const c = Math.cos(th), s = Math.sin(th);
    // outermost valid height along this ray ≈ the true edge height (no spikes)
    let h = 0;
    for (let rr = RR; rr > RW * 0.9; rr -= 0.008) {
      const v = gridValue(rr * c, rr * s);
      if (Number.isFinite(v)) { h = yOf(v); break; }
    }
    rim.push(new THREE.Vector3(RR * c, h + LIFT, RR * s));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), NR, 0.035, 12, true);
  app.scene.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: GRAY, roughness: 0.6, metalness: 0.0 })));
}

// Level-set contours (warped levels, even in displayed height), on the surface.
const grid: ScalarGrid = { nx: N, ny: N, values: VALUES, xMin: -RW, xMax: RW, yMin: -RW, yMax: RW };
const LEVELS = 18;
const pts: number[] = [];
for (let k = 1; k <= LEVELS; k++) {
  const u = k / (LEVELS + 1);
  const level = VMIN + (VHI - VMIN) * Math.pow(u, 1 / GAMMA);
  const y = u * HEIGHT + 0.004;
  for (const [[ax, ay], [bx, by]] of marchingSquares(grid, level)) {
    pts.push(ax, y, ay, bx, y, by);
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
app.scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.5 })));

// Special points on the graph: hexagonal (red), square (blue).
addMarkers(markoffOrbit(HEX_SEED, RW), 0xcb4f4a);
addMarkers(markoffOrbit(SQUARE_SEED, RW), 0x4c72b0);

app.start();

// --- Helpers -----------------------------------------------------------------

function addMarkers(ptsList: ReadonlyArray<readonly [number, number]>, color: number): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.0 });
  const sphere = new THREE.SphereGeometry(0.05, 20, 20);
  for (const [a, b] of ptsList) {
    const v = gridValue(a, b);
    if (!Number.isFinite(v)) continue;
    const m = new THREE.Mesh(sphere, mat);
    m.position.set(a, yOf(v), b);
    app.scene.add(m);
  }
}
