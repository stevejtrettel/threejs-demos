/**
 * Stable-norm ball volume over moduli space — the landscape, coloured by height.
 *
 * V(structure) = area of the inner-estimate stable-norm unit ball is a function
 * on moduli space (mapping-class-group invariant). Graphed over the symmetric
 * (a, b) chart it is a shallow, periodic landscape: wells at the hexagonal-torus
 * copies, passes at the square tori. The surface is gamma-warped for relief (as in
 * stable-norm-cusp-cutoff), coloured by height (wells cool → rim warm), with the
 * level-set contours lifted on, the wells/saddles marked, and one SL(2,ℤ)
 * fundamental domain outlined per-pixel in the fragment shader.
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

// Vertical mapping (matches stable-norm-cusp-cutoff): autoscaled to the field's
// own range, gamma < 1 giving the shallow region more relief.
const HEIGHT = 2.6, GAMMA = 0.7;
let VMIN = Infinity, VMAX = -Infinity;
for (const v of VALUES) { if (v == null) continue; if (v < VMIN) VMIN = v; if (v > VMAX) VMAX = v; }
const sNorm = (v: number) => Math.pow(Math.max(0, Math.min(1, (v - VMIN) / (VMAX - VMIN))), GAMMA);
const yOf = (v: number) => sNorm(v) * HEIGHT;

// --- Bilinear grid sampling (CPU: surface height + marker placement) ---------

function bilinear(a: number, b: number): number {
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

// --- Field as a float texture (for height-colouring in the shader) -----------

const fieldBuf = new Float32Array(N * N);
for (let k = 0; k < N * N; k++) fieldBuf[k] = VALUES[k] == null ? -1 : (VALUES[k] as number);
const fieldTex = new THREE.DataTexture(fieldBuf, N, N, THREE.RedFormat, THREE.FloatType);
fieldTex.minFilter = THREE.LinearFilter; fieldTex.magFilter = THREE.LinearFilter; fieldTex.needsUpdate = true;

// Colour gamma is steeper than the HEIGHT gamma: the moduli structure lives in a
// very shallow basin near VMIN (hex copies ~0.892, square saddles ~0.894) while the
// cusps shoot to VMAX. A small colour gamma spreads that basin across the ramp so
// the copies/saddles read as distinct minima — height stays matched to cusp-cutoff.
const COLOR_GAMMA = 0.32;
const V_SPLIT = 0.92;       // full blue→gold→red sweep over [VMIN, V_SPLIT]; above it, just deepen red (cusp ≈ 1.05)
const uField = { value: fieldTex };
const uVMin = { value: VMIN };
const uVMax = { value: VMAX };
const uVSplit = { value: V_SPLIT };
const uGamma = { value: COLOR_GAMMA };
const uFDLine = { value: new THREE.Color('#3a3a3a') };
const uRW = { value: RW };
const uLineW = { value: 0.009 }; // FD line half-width, world (a,b) units

// --- Fragment shader: height ramp + analytic fundamental-domain outline -------

const fragmentShader = `
  uniform sampler2D uField;
  uniform float uVMin, uVMax, uVSplit, uGamma, uRW, uLineW;
  uniform vec3 uFDLine;

  // wells (low) → gold → rim (high)
  vec3 ramp(float t) {
    vec3 lo = vec3(0.055, 0.165, 0.39);
    vec3 mid = vec3(0.851, 0.663, 0.243);
    vec3 hi = vec3(0.796, 0.310, 0.290);
    return t < 0.5 ? mix(lo, mid, t / 0.5) : mix(mid, hi, (t - 0.5) / 0.5);
  }

  // Signed fundamental-domain margin: lift (a,b) to the trace triple (largest root
  // of the chart cubic), then min of the sector/reduced/valid walls. Zero set = FD
  // boundary; |grad| gives world distance to it.
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
    float d = 0.8660254038 * b - 0.5 * a;  // CCW of the 30° ray
    d = min(d, a);                          // CW of the 90° ray
    d = min(d, y * z - 2.0 * x);            // Markoff-reduced (three walls)
    d = min(d, x * z - 2.0 * y);
    d = min(d, x * y - 2.0 * z);
    d = min(d, min(min(x, y), z) - 2.0);    // valid (Teichmüller)
    return d;
  }

  void main() {
    vec2 ab = (vMapUv * 2.0 - 1.0) * uRW;
    float V = texture2D(uField, vMapUv).r;
    // full ramp over [VMIN, V_SPLIT] (where the moduli structure lives)...
    float t = pow(clamp((V - uVMin) / (uVSplit - uVMin), 0.0, 1.0), uGamma);
    vec3 col = ramp(t);
    // ...then keep deepening toward dark red above the split (the cusp spikes).
    float e = clamp((V - uVSplit) / max(uVMax - uVSplit, 1e-6), 0.0, 1.0);
    col = mix(col, vec3(0.42, 0.06, 0.06), e);

    float d = dMargin(ab);

    // Full intensity inside the fundamental domain; outside left exactly as is.
    float wfd = max(fwidth(d), 1e-5);
    float inFD = smoothstep(-wfd, wfd, d);
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, clamp(luma + (col - luma) * 1.5, 0.0, 1.0), inFD);

    // fundamental-domain outline: world-space distance = |d| / |grad d|.
    float hh = 0.004;
    vec2 gD = vec2(dMargin(ab + vec2(hh, 0.0)) - dMargin(ab - vec2(hh, 0.0)),
                   dMargin(ab + vec2(0.0, hh)) - dMargin(ab - vec2(0.0, hh))) / (2.0 * hh);
    float wdFD = abs(d) / max(length(gD), 1e-6);
    col = mix(col, uFDLine, 1.0 - smoothstep(uLineW, uLineW * 1.6, wdFD));

    csm_DiffuseColor = vec4(col, 1.0);
  }
`;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true });
applyStage(app);
app.camera.position.set(4.5, 3.6, 5.2);
app.controls.target.set(0, 0.7, 0);

const SEG = 240;
const domain: SurfaceDomain = { uMin: -RW, uMax: RW, vMin: -RW, vMax: RW };
const surface: Surface = {
  evaluate(a, b) {
    const v = bilinear(a, b);
    return Number.isFinite(v) ? new THREE.Vector3(a, yOf(v), b) : new THREE.Vector3(NaN, NaN, NaN);
  },
  getDomain: () => domain,
};
const surfMesh = new SurfaceMesh(surface, {
  uSegments: SEG, vSegments: SEG, roughness: 0.7, metalness: 0.0,
  fragmentShader,
  uniforms: { uField, uVMin, uVMax, uVSplit, uGamma, uFDLine, uRW, uLineW },
});
app.scene.add(surfMesh);

// Rim tube: a clean circle following the surface height around the disk edge.
{
  const GRAY = new THREE.Color(0.62, 0.60, 0.56);
  const RR = RW * 0.995, NR = 480, LIFT = 0.02;
  const rim: THREE.Vector3[] = [];
  for (let k = 0; k < NR; k++) {
    const th = (2 * Math.PI * k) / NR, c = Math.cos(th), sn = Math.sin(th);
    let h = 0;
    for (let rr = RR; rr > RW * 0.9; rr -= 0.008) {
      const v = bilinear(rr * c, rr * sn);
      if (Number.isFinite(v)) { h = yOf(v); break; }
    }
    rim.push(new THREE.Vector3(RR * c, h + LIFT, RR * sn));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), NR, 0.03, 12, true);
  app.scene.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: GRAY, roughness: 0.6 })));
}

// Level-set contours. The moduli structure (hex copies, square saddles) lives in
// a very shallow basin near VMIN, so the levels are biased DOWN into it (exponent
// > 1) and there are many of them — each copy then gets encircling rings and reads
// as a local minimum. Heights are the true surface heights yOf(level).
{
  const grid: ScalarGrid = { nx: N, ny: N, values: VALUES, xMin: -RW, xMax: RW, yMin: -RW, yMax: RW };
  const LEVELS = 40, BASIN_BIAS = 2.2, pts: number[] = [];
  for (let k = 1; k <= LEVELS; k++) {
    const u = k / (LEVELS + 1);
    const level = VMIN + (VMAX - VMIN) * Math.pow(u, BASIN_BIAS);
    const y = yOf(level) + 0.004;
    for (const [[ax, ay], [bx, by]] of marchingSquares(grid, level)) pts.push(ax, y, ay, bx, y, by);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  app.scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2c2c2c, transparent: true, opacity: 0.4 })));
}

// Markers: hexagonal (wells, dark) and square (saddles, teal) tori.
function addMarkers(pts: ReadonlyArray<readonly [number, number]>, color: number): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const geo = new THREE.SphereGeometry(0.04, 18, 18);
  for (const [a, b] of pts) {
    const v = bilinear(a, b);
    if (!Number.isFinite(v)) continue;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(a, yOf(v) + 0.03, b);
    app.scene.add(m);
  }
}
addMarkers(markoffOrbit(HEX_SEED, RW), 0x2c2c2c);
addMarkers(markoffOrbit(SQUARE_SEED, RW), 0x3e938f);

app.start();
