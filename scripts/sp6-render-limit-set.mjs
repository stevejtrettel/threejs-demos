#!/usr/bin/env node
/**
 * sp6-render-limit-set.mjs
 *
 * Offline density-image render of an Sp(6,Z) limit set. No browser, no GPU,
 * no per-point cap. Generates the non-backtracking BFS orbit of a proximal
 * basepoint in RP^5, projects through a chart map into R^3, then splats
 * anti-aliased disks of variable size into a Float32 accumulator and writes
 * an 8-bit grayscale PNG.
 *
 *   node scripts/sp6-render-limit-set.mjs
 *
 * Two render modes:
 *   - Default: auto-chart projective PCA on the orbit + median-centered 2D
 *              autofit. Good for "what does the limit set look like" shots.
 *   - VIEW_PRESET: paste a JSON bundle from `npm run dev sp6-limit-sets-render`
 *              to render the exact perspective view you framed in the browser,
 *              at much higher BFS depth. Skips PCA + autofit; uses the
 *              exported chart + camera matrix. Dot size from view-space depth.
 *
 * Edit the EDITABLE block below to change example / depth / resolution /
 * tone curve. Memory floor is ~48 bytes per BFS node (6 doubles):
 *   depth 13 ~ 150 MB,  depth 14 ~ 460 MB,  depth 15 ~ 1.4 GB.
 *
 * Math reused from:
 *   - scripts/sp6-export-orbit.mjs   (generators, proximal basepoint, BFS)
 *   - demos/sp6-limit-sets/projection.ts   (Jacobi eig, auto-chart PCA)
 */

import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// ─── EDITABLE ───────────────────────────────────────────────────────────────
//
// Generators are encoded as integer codes (matching demos/sp6-limit-sets):
//   0 = A,  1 = A⁻¹,  2 = B,  3 = B⁻¹.
// A is the companion of f(x); B is the companion of g(x). Per-example
// polynomial data + γ word lives in the EXAMPLES table further down.

// Pick which BDN example to render. Ignored when VIEW_PRESET is set
// (the preset's exampleId wins).
const EXAMPLE_ID = 'c32';   // 'A1' | 'A15' | 'c2' | 'c32' | 'c47' | 'c55'

// Orbit
//
// DEPTH is determined at run time: either an integer argv[2]
// (e.g. `node scripts/sp6-render-limit-set.mjs 13`) or, if absent, an
// interactive prompt. DEFAULT_DEPTH is the fallback.
const DEFAULT_DEPTH     = 13;
let DEPTH               = DEFAULT_DEPTH;
const POWER_ITER_STEPS  = 50;     // for the proximal basepoint

// Image — the long side is fixed; the short side is derived from the
// measured (x,y) bbox aspect after PCA projection. Set MAX_DIM and let the
// script pick the other dimension; clamp/round with the remaining knobs.
// Memory note: total ≈ 8·W·H bytes; for 16384×8192 ~ 1 GB. For ≥32k width
// run node with `--max-old-space-size=8192` or higher.
let   MAX_DIM           = 8192;   // pixels on the longer side
const MIN_DIM           = 128;    // floor for the shorter side
const DIM_ROUND         = 16;     // round image dims to a multiple of this

// Camera autofit: keep the central percentile-bbox of (x,y), let the long
// chart-singular tail fall off the edges. Larger TRIM = tighter framing.
// MAX_ASPECT caps the picture proportions so a wildly anisotropic cloud
// gets cropped along its wide axis instead of producing a pinstripe.
const BBOX_TRIM         = 0.20;   // trim 20% from each side (20–80% inner box; tighter on the dense core)
const MAX_ASPECT        = 4;      // cap image w/h (or h/w) at this; wide axis crops around the median
const FIT_FILL          = 0.92;   // fraction of the image the view rect should fill (smaller = more margin)

// Disk splat
let   R_MIN             = 0.6;    // smallest dot radius, in pixels
let   R_MAX             = 1.2;    // largest dot radius, in pixels
let   DEPTH_TANH_GAIN   = 0;      // 0 disables size variation; ~1-2 is normal
let   EDGE_WIDTH        = 0.5;    // pixels of AA at the dot rim; smaller = crisper
                                  //   1.0 = original soft edge, 0.5 = visibly crisp,
                                  //   ≤0.05 ≈ hard (jagged) edges
let   INTENSITY         = 1.3;    // per-splat intensity multiplier; >1 = darker dots

// Tone-map
let   TONE_PERCENTILE   = 0.999;  // clip top 0.1% before log
let   BG                = 'white'; // 'white' (dark dots) or 'black' (bright dots)

// Color (matches demos/sp6-limit-sets/projection.ts)
//   0     → grayscale (existing code path)
//   k ≥ 1 → 4-color family palette, keyed off the letter (k-1) back from the
//           end of the word. k=1 is "last letter", k=2 is "2nd-to-last",
//           etc. Same scheme as the demo's color-depth dropdown.
let   COLOR_DEPTH       = 0;

const FAMILY = [
  [0.65, 0.20, 0.15], // A   — warm red
  [0.70, 0.40, 0.10], // A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // B   — cool blue
  [0.10, 0.40, 0.55], // B⁻¹ — cool teal
];
const BASEPOINT_COLOR = [0.95, 0.95, 0.95];

// ─── View preset ────────────────────────────────────────────────────────────
//
// When set, skips the auto-chart PCA + 2D autofit and uses the exported
// projection + camera matrix verbatim. The image aspect ratio is taken
// from the viewport in the bundle; MAX_DIM still sets the long side.
//
// Easy path:
//   1. `npm run dev sp6-limit-sets-render`, position the camera
//   2. Click "save view" — writes scripts/view-preset.json (via Vite plugin)
//   3. `node scripts/sp6-render-limit-set.mjs`
//
// The block below auto-loads scripts/view-preset.json if present. Delete
// (or rename) that file to fall back to the default PCA-autofit render.
let VIEW_PRESET = null;
const VIEW_PRESET_PATH = fileURLToPath(new URL('./view-preset.json', import.meta.url));
if (existsSync(VIEW_PRESET_PATH)) {
  try {
    VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8'));
    process.stderr.write(`[sp6-render] loaded view-preset.json` +
      ` (exampleId=${VIEW_PRESET.exampleId}, previewDepth=${VIEW_PRESET.previewDepth})\n`);
  } catch (e) {
    process.stderr.write(`[sp6-render] WARNING: ignoring malformed view-preset.json: ${e.message}\n`);
    VIEW_PRESET = null;
  }
}

// OUTPUT_FILE name is built later, once IMG_W and IMG_H are derived from the
// projected bbox (or viewport, if VIEW_PRESET is set).

// ─── EXAMPLES (mirrors demos/sp6-limit-sets/examples.ts) ───────────────────
//
// Each entry carries the palindromic integer coefficient lists of f and g,
// the loxodromic γ word for power iteration, and a display label. From
// these we derive F_C = coefflistf[1..5] and B_C = coefflistg[1..5] — the
// five coefficients used inside the companion-matrix shift in applyGen.

const EXAMPLES = {
  A1:  { label: 'A-1',
         coefflistf: [1, -6, 15, -20, 15, -6, 1],
         coefflistg: [1,  6, 15,  20, 15,  6, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
  A15: { label: 'A-15',
         coefflistf: [1, -6, 15, -20, 15, -6, 1],
         coefflistg: [1,  1,  2,   1,  2,  1, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
  c2:  { label: 'C-2',
         coefflistf: [1, -3, 3, -2, 3, -3, 1],
         coefflistg: [1,  4, 7,  8, 7,  4, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
  c32: { label: 'C-32',
         coefflistf: [1, -5, 11, -14, 11, -5, 1],
         coefflistg: [1,  0,  0,   0,  0,  0, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
  c47: { label: 'C-47',
         coefflistf: [1, -1, 0,  0, 0, -1, 1],
         coefflistg: [1,  4, 8, 10, 8,  4, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
  c55: { label: 'C-55',
         coefflistf: [1, -2, 1,  0, 1, -2, 1],
         coefflistg: [1,  2, 0, -2, 0,  2, 1],
         gamma:      [1, 2, 2, 1, 2], gammaName: 'TBT', powerIter: 30 },
};

// Resolve active example: VIEW_PRESET wins, else fall back to EXAMPLE_ID.
const ACTIVE_ID = (VIEW_PRESET && VIEW_PRESET.exampleId) || EXAMPLE_ID;
const ACTIVE = EXAMPLES[ACTIVE_ID];
if (!ACTIVE) {
  throw new Error(`Unknown example id: "${ACTIVE_ID}". ` +
    `Expected one of: ${Object.keys(EXAMPLES).join(', ')}`);
}
const LABEL = ACTIVE_ID;
const F_C   = ACTIVE.coefflistf.slice(1, 6);
const B_C   = ACTIVE.coefflistg.slice(1, 6);
const GAMMA = ACTIVE.gamma;

// ─── Math: group action, basepoint, BFS (copied from sp6-export-orbit.mjs) ─

const INV = [1, 0, 3, 2];

function applyGen(g, src, sOff, dst, dOff) {
  const a = src[sOff],     b = src[sOff + 1], c = src[sOff + 2];
  const d = src[sOff + 3], e = src[sOff + 4], f = src[sOff + 5];
  switch (g) {
    case 0: // A (companion matrix of f)
      dst[dOff]     = -f;
      dst[dOff + 1] =  a - F_C[0] * f;
      dst[dOff + 2] =  b - F_C[1] * f;
      dst[dOff + 3] =  c - F_C[2] * f;
      dst[dOff + 4] =  d - F_C[3] * f;
      dst[dOff + 5] =  e - F_C[4] * f;
      return;
    case 1: // A⁻¹
      dst[dOff]     =  b - F_C[0] * a;
      dst[dOff + 1] =  c - F_C[1] * a;
      dst[dOff + 2] =  d - F_C[2] * a;
      dst[dOff + 3] =  e - F_C[3] * a;
      dst[dOff + 4] =  f - F_C[4] * a;
      dst[dOff + 5] = -a;
      return;
    case 2: // B (companion matrix of g)
      dst[dOff]     = -f;
      dst[dOff + 1] =  a - B_C[0] * f;
      dst[dOff + 2] =  b - B_C[1] * f;
      dst[dOff + 3] =  c - B_C[2] * f;
      dst[dOff + 4] =  d - B_C[3] * f;
      dst[dOff + 5] =  e - B_C[4] * f;
      return;
    case 3: // B⁻¹
      dst[dOff]     =  b - B_C[0] * a;
      dst[dOff + 1] =  c - B_C[1] * a;
      dst[dOff + 2] =  d - B_C[2] * a;
      dst[dOff + 3] =  e - B_C[3] * a;
      dst[dOff + 4] =  f - B_C[4] * a;
      dst[dOff + 5] = -a;
      return;
  }
}

function normalize(buf, off = 0) {
  let s = 0;
  for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 6; i++) buf[off + i] *= inv;
}

function applyGamma(buf) {
  // Iterate forward to match demos/sp6-limit-sets/orbit.ts: the basepoint
  // ξ_+ is the fixed line of g_{k-1} · … · g_1 · g_0 (gamma applied left to
  // right). Reversing this order would give a conjugate matrix with a
  // different fixed point — and orbits that don't land where the demo
  // camera is framed.
  for (let i = 0; i < GAMMA.length; i++) {
    applyGen(GAMMA[i], buf, 0, buf, 0);
  }
}

function computeProximalBasepoint() {
  const v = new Float64Array(6);
  v[0] = 1.0; v[1] = 0.7; v[2] = -0.3;
  v[3] = 0.1; v[4] = -0.5; v[5] = 0.2;
  normalize(v);
  for (let k = 0; k < POWER_ITER_STEPS; k++) {
    applyGamma(v);
    normalize(v);
  }
  const tmp = new Float64Array(v);
  applyGamma(tmp);
  let lam2 = 0;
  for (let i = 0; i < 6; i++) lam2 += tmp[i] * tmp[i];
  process.stderr.write(
    `Proximal basepoint: |λ_max(γ)| ≈ ${Math.sqrt(lam2).toFixed(3)}\n`,
  );
  return v;
}

function totalNodes(N) {
  return 1 + 2 * (Math.pow(3, N) - 1);
}

function generateOrbit(N, basepoint) {
  const total = totalNodes(N);
  const vecs = new Float64Array(total * 6);
  const lastGen = new Uint8Array(total);
  const parents = new Uint32Array(total);
  for (let i = 0; i < 6; i++) vecs[i] = basepoint[i];
  lastGen[0] = 255;
  parents[0] = 0;  // basepoint; never read (we stop on lastGen===255)
  let pStart = 0, pEnd = 1, w = 1;
  for (let d = 1; d <= N; d++) {
    for (let p = pStart; p < pEnd; p++) {
      const pLast = lastGen[p], pOff = p * 6;
      for (let g = 0; g < 4; g++) {
        if (pLast < 4 && g === INV[pLast]) continue;
        const wOff = w * 6;
        applyGen(g, vecs, pOff, vecs, wOff);
        normalize(vecs, wOff);
        lastGen[w] = g;
        parents[w] = p;
        w++;
      }
    }
    pStart = pEnd;
    pEnd = w;
  }
  return { vecs, count: w, lastGen, parents };
}

// ─── Math: 6×6 symmetric eig + projective PCA (from projection.ts) ─────────

function jacobiSymmetricEig(M, n) {
  const A = M.map((r) => r.slice());
  const V = [];
  for (let j = 0; j < n; j++) {
    V.push(new Array(n).fill(0));
    V[j][j] = 1;
  }
  for (let iter = 0; iter < 100; iter++) {
    let p = 0, q = 1, maxOff = Math.abs(A[0][1]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxOff) {
          maxOff = Math.abs(A[i][j]);
          p = i; q = j;
        }
      }
    }
    if (maxOff < 1e-14) break;
    const tau = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = tau >= 0
      ? 1 / (tau + Math.sqrt(tau * tau + 1))
      : 1 / (tau - Math.sqrt(tau * tau + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    const Apq = A[p][q];
    A[p][p] -= t * Apq;
    A[q][q] += t * Apq;
    A[p][q] = 0; A[q][p] = 0;
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Aip = A[i][p], Aiq = A[i][q];
        A[i][p] = c * Aip - s * Aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * Aip + c * Aiq;
        A[q][i] = A[i][q];
      }
    }
    for (let j = 0; j < n; j++) {
      const Vjp = V[j][p], Vjq = V[j][q];
      V[j][p] = c * Vjp - s * Vjq;
      V[j][q] = s * Vjp + c * Vjq;
    }
  }
  const vals = new Array(n);
  for (let i = 0; i < n; i++) vals[i] = A[i][i];
  const vecs = [];
  for (let i = 0; i < n; i++) {
    const v = new Array(n);
    for (let j = 0; j < n; j++) v[j] = V[j][i];
    vecs.push(v);
  }
  return { vals, vecs };
}

// Auto-chart projective PCA: top eigvec of M = (1/n)Σvv^T on S⁵ is the denom,
// next three are the (x, y, z) rows. Returns { denom, rowX, rowY, rowZ }.
function fitAutoChartProjection(vecs, count) {
  const M = Array.from({ length: 6 }, () => new Array(6).fill(0));
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    for (let a = 0; a < 6; a++) {
      for (let b = a; b < 6; b++) M[a][b] += vecs[off + a] * vecs[off + b];
    }
  }
  for (let a = 0; a < 6; a++) {
    for (let b = a; b < 6; b++) {
      M[a][b] /= count;
      if (a !== b) M[b][a] = M[a][b];
    }
  }
  const { vals, vecs: eigvecs } = jacobiSymmetricEig(M, 6);
  const order = vals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);

  const denom = eigvecs[order[0]].slice();
  const rowX  = eigvecs[order[1]].slice();
  const rowY  = eigvecs[order[2]].slice();
  const rowZ  = eigvecs[order[3]].slice();

  // Canonicalize sign of denom so the centroid lies on its positive side.
  let cdot = 0;
  for (let i = 0; i < count; i++) {
    const off = i * 6;
    for (let j = 0; j < 6; j++) cdot += denom[j] * vecs[off + j];
  }
  if (cdot < 0) for (let j = 0; j < 6; j++) denom[j] = -denom[j];

  process.stderr.write(
    `Auto-chart PCA eigenvalues (top 4): ${
      order.slice(0, 4).map((i) => vals[i].toExponential(3)).join(', ')
    }\n`,
  );

  return { denom, rowX, rowY, rowZ };
}

// ─── Camera math (only used when VIEW_PRESET is set) ──────────────────────

// 4×4 matrices are stored row-major: m[r*4 + c].
// All matrix functions return new Float64Array(16).

function mat4Identity() {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

function mat4Mul(a, b) {
  const m = new Float64Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
      m[r * 4 + c] = s;
    }
  }
  return m;
}

// Right-handed lookAt (world → view). Camera looks down -z in view space.
function mat4LookAt(eye, target, up) {
  const fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz);
  const f0 = fx / fl, f1 = fy / fl, f2 = fz / fl;
  // s = normalize(cross(f, up))
  let s0 = f1 * up[2] - f2 * up[1];
  let s1 = f2 * up[0] - f0 * up[2];
  let s2 = f0 * up[1] - f1 * up[0];
  const sl = Math.hypot(s0, s1, s2);
  s0 /= sl; s1 /= sl; s2 /= sl;
  // u = cross(s, f)
  const u0 = s1 * f2 - s2 * f1;
  const u1 = s2 * f0 - s0 * f2;
  const u2 = s0 * f1 - s1 * f0;
  const m = new Float64Array(16);
  m[0]  = s0;  m[1]  = s1;  m[2]  = s2;  m[3]  = -(s0 * eye[0] + s1 * eye[1] + s2 * eye[2]);
  m[4]  = u0;  m[5]  = u1;  m[6]  = u2;  m[7]  = -(u0 * eye[0] + u1 * eye[1] + u2 * eye[2]);
  m[8]  = -f0; m[9]  = -f1; m[10] = -f2; m[11] =  (f0 * eye[0] + f1 * eye[1] + f2 * eye[2]);
  m[15] = 1;
  return m;
}

// Right-handed perspective (view → clip), OpenGL convention with NDC.z ∈ [-1, 1].
function mat4Perspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  const m = new Float64Array(16);
  m[0]  = f / aspect;
  m[5]  = f;
  m[10] = (far + near) * nf;
  m[11] = 2 * far * near * nf;
  m[14] = -1;
  return m;
}

// ─── Projection + autofit ──────────────────────────────────────────────────

const EPS_DENOM = 1e-4;

// Sort a copy of `arr[0..n)` and return the value at fractional rank `p`.
function percentile(arr, n, p) {
  const tmp = arr.slice(0, n);
  tmp.sort();
  const idx = Math.max(0, Math.min(n - 1, Math.floor(n * p)));
  return tmp[idx];
}

function projectAll(orbit, proj) {
  const { vecs, count } = orbit;
  const { denom, rowX, rowY, rowZ } = proj;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  const keptIdx = new Uint32Array(count);

  // Unpack for speed.
  const d0=denom[0], d1=denom[1], d2=denom[2], d3=denom[3], d4=denom[4], d5=denom[5];
  const x0=rowX[0], x1=rowX[1], x2=rowX[2], x3=rowX[3], x4=rowX[4], x5=rowX[5];
  const y0=rowY[0], y1=rowY[1], y2=rowY[2], y3=rowY[3], y4=rowY[4], y5=rowY[5];
  const z0=rowZ[0], z1=rowZ[1], z2=rowZ[2], z3=rowZ[3], z4=rowZ[4], z5=rowZ[5];

  let kept = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 6;
    const va = vecs[o], vb = vecs[o+1], vc = vecs[o+2];
    const vd = vecs[o+3], ve = vecs[o+4], vf = vecs[o+5];
    const dv = d0*va + d1*vb + d2*vc + d3*vd + d4*ve + d5*vf;
    if (Math.abs(dv) < EPS_DENOM) continue;
    const inv = 1 / dv;
    xs[kept] = (x0*va + x1*vb + x2*vc + x3*vd + x4*ve + x5*vf) * inv;
    ys[kept] = (y0*va + y1*vb + y2*vc + y3*vd + y4*ve + y5*vf) * inv;
    zs[kept] = (z0*va + z1*vb + z2*vc + z3*vd + z4*ve + z5*vf) * inv;
    keptIdx[kept] = i;
    kept++;
  }
  // Trim to actual kept length; release the unused tail.
  return {
    xs:      xs.subarray(0, kept),
    ys:      ys.subarray(0, kept),
    zs:      zs.subarray(0, kept),
    keptIdx: keptIdx.subarray(0, kept),
    kept,
  };
}

// ─── Disk splat ────────────────────────────────────────────────────────────
//
// Each point contributes an anti-aliased disk of radius r. Coverage at pixel
// (px,py) with center (cx,cy) is  clamp(r + 0.5 - dist, 0, 1) — gives a
// 1-pixel-wide soft edge so circles aren't jagged.

function splatDisk(buf, W, H, cx, cy, r) {
  // AA: coverage ramps from 1 (inside) to 0 (outside) over EDGE_WIDTH px,
  // centered on the geometric dot radius. INTENSITY scales each contribution.
  const halfEdge = EDGE_WIDTH * 0.5;
  const xLo = Math.max(0, Math.floor(cx - r - halfEdge));
  const xHi = Math.min(W - 1, Math.ceil(cx + r + halfEdge));
  const yLo = Math.max(0, Math.floor(cy - r - halfEdge));
  const yHi = Math.min(H - 1, Math.ceil(cy + r + halfEdge));
  const rOuter = r + halfEdge;
  const invEdge = 1 / EDGE_WIDTH;
  for (let py = yLo; py <= yHi; py++) {
    const dy = (py + 0.5) - cy;
    const dy2 = dy * dy;
    const rowOff = py * W;
    for (let px = xLo; px <= xHi; px++) {
      const dx = (px + 0.5) - cx;
      const d = Math.sqrt(dx * dx + dy2);
      let cov = (rOuter - d) * invEdge;
      if (cov <= 0) continue;
      if (cov > 1) cov = 1;
      buf[rowOff + px] += cov * INTENSITY;
    }
  }
}

// Color splat: three accumulators, each tracks "ink amount" per channel.
//   white bg: ink = cov · INTENSITY · (1 − tint[c])  (subtractive)
//   black bg: ink = cov · INTENSITY · tint[c]         (additive)
// The caller pre-computes the per-splat coefficients (preR/G/B) based on BG.
function splatDiskColor(accR, accG, accB, W, H, cx, cy, r, preR, preG, preB) {
  const halfEdge = EDGE_WIDTH * 0.5;
  const xLo = Math.max(0, Math.floor(cx - r - halfEdge));
  const xHi = Math.min(W - 1, Math.ceil(cx + r + halfEdge));
  const yLo = Math.max(0, Math.floor(cy - r - halfEdge));
  const yHi = Math.min(H - 1, Math.ceil(cy + r + halfEdge));
  const rOuter = r + halfEdge;
  const invEdge = 1 / EDGE_WIDTH;
  for (let py = yLo; py <= yHi; py++) {
    const dy = (py + 0.5) - cy;
    const dy2 = dy * dy;
    const rowOff = py * W;
    for (let px = xLo; px <= xHi; px++) {
      const dx = (px + 0.5) - cx;
      const d = Math.sqrt(dx * dx + dy2);
      let cov = (rOuter - d) * invEdge;
      if (cov <= 0) continue;
      if (cov > 1) cov = 1;
      const off = rowOff + px;
      accR[off] += cov * preR;
      accG[off] += cov * preG;
      accB[off] += cov * preB;
    }
  }
}

// Walk the parents chain back colorDepth-1 levels from origIdx and return
// the family color at the resulting node (or BASEPOINT_COLOR if we hit the
// basepoint along the way).
function tintForOrigIdx(origIdx) {
  let cur = origIdx;
  for (let k = 1; k < COLOR_DEPTH; k++) {
    if (lastGen[cur] === 255) return BASEPOINT_COLOR;
    cur = parents[cur];
  }
  const lg = lastGen[cur];
  if (lg === 255) return BASEPOINT_COLOR;
  return FAMILY[lg];
}

// ─── Main ───────────────────────────────────────────────────────────────────

const log = (msg) => process.stderr.write(msg + '\n');

// ─── Parse argv (depth + flags) ─────────────────────────────────────────────
//
// Usage:
//   node scripts/sp6-render-limit-set.mjs [depth] [flags...]
//
// Bool flags:
//   --refresh, --no-cache   ignore the cached projected points; recompute
//
// Value flags (override the corresponding constant above; do not invalidate
// the points cache — they only affect splatting and tone-map):
//   --radius N             both R_MIN and R_MAX (uniform dot size)
//   --r-min N              smallest dot radius (pixels)
//   --r-max N              largest dot radius (pixels)
//   --gain N               DEPTH_TANH_GAIN  (0 = uniform, ~1–2 = depth cue)
//   --edge N               AA edge width in pixels (~0.05 hard, 0.5 crisp, 1.0 soft)
//   --intensity N          per-splat intensity multiplier (>1 = darker dots)
//   --max-dim N            pixels on the longer side of the image
//   --bg white|black       background color
//   --tone N               TONE_PERCENTILE (0 < N ≤ 1; closer to 1 = brighter)
//   --color-depth N        0 = grayscale; 1 = color by last letter; 2 = 2nd-to-last,
//                          etc. Matches the demo's color-depth selector.
//
// Examples:
//   node ... 13
//   node ... 13 --radius 0.6 --max-dim 16384
//   node ... 14 --refresh --bg black --tone 0.995

const ARGS = process.argv.slice(2);
const FORCE_REFRESH = ARGS.includes('--refresh') || ARGS.includes('--no-cache');

// Look up a `--flag value` pair; returns the raw string or null.
function flagValue(name) {
  const i = ARGS.indexOf(name);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
}

// Apply value flags. Each parse helper validates and falls back silently
// to the previous value with a warning on bad input.
function applyFloat(name, set, predicate = (n) => Number.isFinite(n) && n > 0) {
  const v = flagValue(name);
  if (v === null) return;
  const n = parseFloat(v);
  if (predicate(n)) set(n);
  else log(`[sp6-render] ignoring ${name}=${v} (invalid)`);
}
function applyInt(name, set, predicate = (n) => Number.isFinite(n) && n > 0) {
  const v = flagValue(name);
  if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n);
  else log(`[sp6-render] ignoring ${name}=${v} (invalid)`);
}

applyFloat('--radius', (n) => { R_MIN = n; R_MAX = n; });
applyFloat('--r-min',  (n) => { R_MIN = n; });
applyFloat('--r-max',  (n) => { R_MAX = n; });
applyFloat('--gain',     (n) => { DEPTH_TANH_GAIN = n; }, (n) => Number.isFinite(n) && n >= 0);
applyFloat('--edge',     (n) => { EDGE_WIDTH = n; },      (n) => Number.isFinite(n) && n >= 0.05);
applyFloat('--intensity',(n) => { INTENSITY = n; });
applyInt(  '--max-dim',  (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
applyFloat('--tone',     (n) => { TONE_PERCENTILE = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
applyInt(  '--color-depth',(n) => { COLOR_DEPTH = n; }, (n) => Number.isFinite(n) && n >= 0 && n <= 8);
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[sp6-render] ignoring --bg=${v} (expected "white" or "black")`);
}

// Depth: first positional (non-flag) argument. We skip args that are the
// value of a value-flag, so e.g. `--radius 13` doesn't get interpreted as
// depth.
const VALUE_FLAGS = new Set([
  '--radius', '--r-min', '--r-max', '--gain', '--edge', '--intensity',
  '--max-dim', '--tone', '--bg', '--color-depth',
]);
const skipIdx = new Set();
for (let i = 0; i < ARGS.length; i++) {
  if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
}
const depthArg = ARGS.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));

// ─── Resolve DEPTH (argv > interactive prompt > default) ────────────────────

{
  if (depthArg !== undefined) {
    const n = parseInt(depthArg, 10);
    if (Number.isFinite(n) && n >= 1) {
      DEPTH = n;
      log(`[sp6-render] depth=${DEPTH} (from command line)`);
    } else {
      log(`[sp6-render] ignoring non-integer depth arg "${depthArg}"`);
    }
  }
  if (DEPTH === DEFAULT_DEPTH && depthArg === undefined && process.stdin.isTTY) {
    // Interactive prompt only when stdin is a real terminal.
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(
      `BFS depth [default ${DEFAULT_DEPTH}; depth 14 ≈ 460MB, depth 15 ≈ 1.4GB]: `,
    )).trim();
    rl.close();
    if (answer !== '') {
      const n = parseInt(answer, 10);
      if (Number.isFinite(n) && n >= 1) {
        DEPTH = n;
      } else {
        log(`[sp6-render] invalid depth "${answer}", using default ${DEFAULT_DEPTH}`);
      }
    }
  }
}

// ─── Cache helpers ──────────────────────────────────────────────────────────
//
// We cache the post-clip points (xs/ys/zs after projection through the chart
// and dropping chart-singular points) since that's the slow part. Splatting +
// tone-map are cheap, so re-running with different R_MIN/R_MAX/etc just reads
// the cache and re-splats. Cache invalidates on change of example, depth, or
// (in VIEW_PRESET mode) the projection.

const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url));

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function cacheKey() {
  if (VIEW_PRESET) {
    const p = VIEW_PRESET.projection;
    return `vp-${hashString(JSON.stringify({
      denom: p.denom, rowX: p.rowX, rowY: p.rowY, rowZ: p.rowZ,
    }))}`;
  }
  return 'autopca';
}

const cachePath = `${CACHE_DIR}${LABEL}-depth${DEPTH}-${cacheKey()}.points.bin`;

// fs.writeSync/readSync take a 32-bit signed length (≤ 2³¹ − 1 bytes). At
// depth 17 the cache is ~5 GB, so we chunk every I/O at 1 GiB to stay safe.
const CACHE_IO_CHUNK = 1 << 30;

// Cache file format ("SP6 points", version 3):
//   [4 bytes] magic        = ASCII "SP6\x03"
//   [4 bytes] count        = uint32 LE      (total BFS nodes)
//   [4 bytes] kept         = uint32 LE      (after chart-singular filter)
//   [kept*4 bytes] xs      Float32 LE
//   [kept*4 bytes] ys      Float32 LE
//   [kept*4 bytes] zs      Float32 LE
//   [kept*4 bytes] keptIdx Uint32 LE        (original BFS index of each kept)
//   [count*1 byte] lastGen Uint8            (255 = basepoint)
//   [count*4 bytes] parents Uint32 LE
//
// keptIdx + lastGen + parents are required for color-depth ≥ 1; they are
// always written so the cache works for grayscale and color paths alike.
// Old caches (without the magic) fail to load and trigger a refresh.

const CACHE_MAGIC = Buffer.from([0x53, 0x50, 0x36, 0x03]); // "SP6\x03"

function readBufFromFd(fd, dest, totalBytes, path) {
  let off = 0;
  while (off < totalBytes) {
    const n = Math.min(CACHE_IO_CHUNK, totalBytes - off);
    const got = readSync(fd, dest, off, n, null);
    if (got <= 0) throw new Error(`unexpected EOF reading ${path} at byte ${off}`);
    off += got;
  }
}

function writeBufToFd(fd, src, totalBytes) {
  let off = 0;
  while (off < totalBytes) {
    const n = Math.min(CACHE_IO_CHUNK, totalBytes - off);
    writeSync(fd, src, off, n, null);
    off += n;
  }
}

function readPointsCache(path) {
  const stat = statSync(path);
  if (stat.size < 12) throw new Error(`cache file ${path} too small (${stat.size})`);

  const fd = openSync(path, 'r');
  try {
    const header = Buffer.alloc(12);
    readBufFromFd(fd, header, 12, path);
    if (!header.subarray(0, 4).equals(CACHE_MAGIC)) {
      throw new Error(
        `cache file ${path} has wrong magic (got ${header.subarray(0, 4).toString('hex')}); ` +
        `delete it to regenerate`,
      );
    }
    const count = header.readUInt32LE(4);
    const kept  = header.readUInt32LE(8);
    const expectedSize = 12 + kept * 16 + count * 5;
    if (stat.size !== expectedSize) {
      throw new Error(
        `cache file ${path} has wrong size: expected ${expectedSize} ` +
        `(count=${count}, kept=${kept}), got ${stat.size}`,
      );
    }

    const xs       = new Float32Array(kept);
    const ys       = new Float32Array(kept);
    const zs       = new Float32Array(kept);
    const keptIdx  = new Uint32Array(kept);
    const lastGen  = new Uint8Array(count);
    const parents  = new Uint32Array(count);

    for (const arr of [xs, ys, zs, keptIdx]) {
      readBufFromFd(fd, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), arr.byteLength, path);
    }
    readBufFromFd(fd, Buffer.from(lastGen.buffer, lastGen.byteOffset, lastGen.byteLength), lastGen.byteLength, path);
    readBufFromFd(fd, Buffer.from(parents.buffer, parents.byteOffset, parents.byteLength), parents.byteLength, path);

    return { xs, ys, zs, keptIdx, lastGen, parents, count, kept };
  } finally {
    closeSync(fd);
  }
}

function writePointsCache(path, xs, ys, zs, keptIdx, lastGen, parents, count, kept) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const tmpPath = `${path}.tmp`;
  const fd = openSync(tmpPath, 'w');
  try {
    const header = Buffer.alloc(12);
    CACHE_MAGIC.copy(header, 0);
    header.writeUInt32LE(count, 4);
    header.writeUInt32LE(kept,  8);
    writeBufToFd(fd, header, 12);

    for (const arr of [xs, ys, zs, keptIdx]) {
      writeBufToFd(fd, Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), arr.byteLength);
    }
    writeBufToFd(fd, Buffer.from(lastGen.buffer, lastGen.byteOffset, lastGen.byteLength), lastGen.byteLength);
    writeBufToFd(fd, Buffer.from(parents.buffer, parents.byteOffset, parents.byteLength), parents.byteLength);
  } catch (err) {
    closeSync(fd);
    try { unlinkSync(tmpPath); } catch (_) { /* best-effort */ }
    throw err;
  }
  closeSync(fd);
  renameSync(tmpPath, path);
}

log(`[sp6-render] example=${ACTIVE.label} (${ACTIVE_ID})` +
    (VIEW_PRESET ? ' — from VIEW_PRESET' : ` — from EXAMPLE_ID`));
log(`[sp6-render] depth=${DEPTH}, max dim=${MAX_DIM}` +
    (VIEW_PRESET ? '  [VIEW_PRESET mode — perspective render]' : '  (aspect from PCA bbox)'));
log(`[sp6-render] dots: R=[${R_MIN}, ${R_MAX}] gain=${DEPTH_TANH_GAIN} edge=${EDGE_WIDTH} intensity=${INTENSITY}  tone=${TONE_PERCENTILE}  bg=${BG}  color-depth=${COLOR_DEPTH}`);
log(`[sp6-render] F_C   = ${JSON.stringify(F_C)}  (= coefflistf[1..5])`);
log(`[sp6-render] B_C   = ${JSON.stringify(B_C)}  (= coefflistg[1..5])`);
log(`[sp6-render] GAMMA = ${JSON.stringify(GAMMA)}  (${ACTIVE.gammaName})`);

const tStart = Date.now();

let xs, ys, zs, keptIdx, lastGen, parents, count = 0, kept = 0;
let pointsLoaded = false;

if (!FORCE_REFRESH && existsSync(cachePath)) {
  log(`Loading cached points from ${cachePath}...`);
  const t = Date.now();
  try {
    ({ xs, ys, zs, keptIdx, lastGen, parents, count, kept } = readPointsCache(cachePath));
    pointsLoaded = true;
    log(`  loaded ${kept.toLocaleString()} points (count=${count.toLocaleString()}) in ${Date.now() - t} ms`);
  } catch (e) {
    log(`  cache load failed (${e.message}); recomputing.`);
    try { unlinkSync(cachePath); } catch (_) { /* best-effort */ }
  }
}

if (!pointsLoaded) {
  if (FORCE_REFRESH && existsSync(cachePath)) {
    log(`Refresh requested; ignoring existing cache at ${cachePath}.`);
  }

  log('Computing proximal basepoint...');
  const basepoint = computeProximalBasepoint();

  log(`Generating orbit (depth ${DEPTH}, ${totalNodes(DEPTH).toLocaleString()} words)...`);
  const t0 = Date.now();
  const orbit = generateOrbit(DEPTH, basepoint);
  log(`  BFS done in ${Date.now() - t0} ms, ${orbit.count.toLocaleString()} nodes`);

  let proj;
  if (VIEW_PRESET) {
    proj = VIEW_PRESET.projection;
    log(`Using projection from VIEW_PRESET (label="${proj.label ?? 'unknown'}")`);
  } else {
    log('Fitting auto-chart projective PCA...');
    const t1 = Date.now();
    proj = fitAutoChartProjection(orbit.vecs, orbit.count);
    log(`  PCA done in ${Date.now() - t1} ms`);
  }

  log('Projecting orbit to R^3...');
  const t2 = Date.now();
  ({ xs, ys, zs, keptIdx, kept } = projectAll(orbit, proj));
  count   = orbit.count;
  lastGen = orbit.lastGen;
  parents = orbit.parents;
  orbit.vecs = null;
  log(`  ${kept.toLocaleString()} points kept ` +
      `(${(count - kept).toLocaleString()} filtered as chart-singular) ` +
      `in ${Date.now() - t2} ms`);

  if (kept > 0) {
    log(`Caching points to ${cachePath}...`);
    const tw = Date.now();
    try {
      writePointsCache(cachePath, xs, ys, zs, keptIdx, lastGen, parents, count, kept);
      const bytes = 12 + kept * 16 + count * 5;
      const sizeStr = bytes >= 1e9
        ? `${(bytes / 1e9).toFixed(2)} GB`
        : `${(bytes / 1e6).toFixed(1)} MB`;
      log(`  wrote ${sizeStr} in ${Date.now() - tw} ms`);
    } catch (e) {
      log(`  cache write failed: ${e.message}  (continuing without cache)`);
    }
  }
}

if (kept === 0) {
  log('Nothing to render. Exiting.');
  process.exit(1);
}

// Helpers shared by both render paths.
const roundDim = (d) => Math.max(
  MIN_DIM,
  Math.round(d / DIM_ROUND) * DIM_ROUND,
);
const rMid = (R_MIN + R_MAX) * 0.5;
const rHalf = (R_MAX - R_MIN) * 0.5;

let IMG_W, IMG_H, OUTPUT_FILE;
let accR, accG, accB;          // single channel (gray) or 3 channels (color)
let drawn = 0;

const inColor = COLOR_DEPTH > 0;
const usingWhiteBg = (BG === 'white');
// Pre-compute the "ink multiplier" the splat will use for each channel.
// On a white bg the ink is subtractive: a red dot eats green and blue.
// On a black bg the ink is additive: a red dot lights up the red channel.
function inkMultipliers(tint) {
  if (usingWhiteBg) {
    return [
      INTENSITY * (1 - tint[0]),
      INTENSITY * (1 - tint[1]),
      INTENSITY * (1 - tint[2]),
    ];
  }
  return [
    INTENSITY * tint[0],
    INTENSITY * tint[1],
    INTENSITY * tint[2],
  ];
}

if (VIEW_PRESET) {
  // ─── Perspective splat: use exported camera, project to clip space ──────
  const cam = VIEW_PRESET.camera;
  const viewport = VIEW_PRESET.viewport;
  const vpAspect = viewport.width / viewport.height;

  if (vpAspect >= 1) {
    IMG_W = roundDim(MAX_DIM);
    IMG_H = roundDim(MAX_DIM / vpAspect);
  } else {
    IMG_H = roundDim(MAX_DIM);
    IMG_W = roundDim(MAX_DIM * vpAspect);
  }
  OUTPUT_FILE = `${LABEL}-depth${DEPTH}-${IMG_W}x${IMG_H}-view.png`;
  log(`Using exported camera (fov=${cam.fov}°, aspect=${vpAspect.toFixed(3)})`);
  log(`  →  image = ${IMG_W}×${IMG_H}`);

  // View · projection. Use the image aspect so the rendered frame matches
  // the rounded image dimensions exactly (vs the unrounded camera.aspect).
  const view  = mat4LookAt(cam.position, cam.target, cam.up);
  const persp = mat4Perspective(cam.fov, IMG_W / IMG_H, cam.near, cam.far);
  const VP    = mat4Mul(persp, view);

  // First pass: find percentile range of clip-w (positive view-space depth,
  // smaller = closer) so we can map it to a dot radius via tanh.
  log('Sampling clip-w for depth modulation...');
  const t3 = Date.now();
  const cws = new Float32Array(kept);
  let visible = 0;
  for (let i = 0; i < kept; i++) {
    const wx = xs[i], wy = ys[i], wz = zs[i];
    const cw = VP[12]*wx + VP[13]*wy + VP[14]*wz + VP[15];
    if (cw > 0) cws[visible++] = cw;
  }
  const cwLo = visible > 0 ? percentile(cws, visible, 0.02) : 1;
  const cwHi = visible > 0 ? percentile(cws, visible, 0.98) : 1;
  const cwMid  = (cwLo + cwHi) * 0.5;
  const cwHalf = Math.max(1e-12, (cwHi - cwLo) * 0.5);
  log(`  visible (in front of camera): ${visible.toLocaleString()}/${kept.toLocaleString()}`);
  log(`  cw range (2-98%) = [${cwLo.toFixed(3)}, ${cwHi.toFixed(3)}]  in ${Date.now() - t3} ms`);

  log(`Splatting (perspective) into ${IMG_W}×${IMG_H} accumulator (${inColor ? 'color' : 'gray'})...`);
  const t4 = Date.now();
  accR = new Float32Array(IMG_W * IMG_H);
  if (inColor) {
    accG = new Float32Array(IMG_W * IMG_H);
    accB = new Float32Array(IMG_W * IMG_H);
  }
  for (let i = 0; i < kept; i++) {
    const wx = xs[i], wy = ys[i], wz = zs[i];
    const cx = VP[0] *wx + VP[1] *wy + VP[2] *wz + VP[3];
    const cy = VP[4] *wx + VP[5] *wy + VP[6] *wz + VP[7];
    const cz = VP[8] *wx + VP[9] *wy + VP[10]*wz + VP[11];
    const cw = VP[12]*wx + VP[13]*wy + VP[14]*wz + VP[15];
    if (cw <= 0) continue;
    const invW = 1 / cw;
    const nx = cx * invW;
    const ny = cy * invW;
    const nz = cz * invW;
    if (nz < -1 || nz > 1) continue;
    const px = (nx + 1) * 0.5 * IMG_W;
    const py = (1 - ny) * 0.5 * IMG_H;
    if (px < -R_MAX || px >= IMG_W + R_MAX || py < -R_MAX || py >= IMG_H + R_MAX) continue;
    // Closer (smaller cw) → bigger dot. tanh-saturated around the median.
    let zn = (cwMid - cw) / cwHalf;
    if (zn < -1) zn = -1; else if (zn > 1) zn = 1;
    const r = rMid + rHalf * Math.tanh(DEPTH_TANH_GAIN * zn);
    if (inColor) {
      const [pR, pG, pB] = inkMultipliers(tintForOrigIdx(keptIdx[i]));
      splatDiskColor(accR, accG, accB, IMG_W, IMG_H, px, py, r, pR, pG, pB);
    } else {
      splatDisk(accR, IMG_W, IMG_H, px, py, r);
    }
    drawn++;
  }
  log(`  drawn ${drawn.toLocaleString()} / ${kept.toLocaleString()}  in ${Date.now() - t4} ms`);
} else {
  // ─── Orthographic splat: median-centered percentile bbox, 2D PCA-z size ──
  log('Computing autofit bbox...');
  const t3 = Date.now();
  const xLo = percentile(xs, kept, BBOX_TRIM);
  const xHi = percentile(xs, kept, 1 - BBOX_TRIM);
  const yLo = percentile(ys, kept, BBOX_TRIM);
  const yHi = percentile(ys, kept, 1 - BBOX_TRIM);
  const zLo = percentile(zs, kept, 0.02);
  const zHi = percentile(zs, kept, 0.98);
  const xMed = percentile(xs, kept, 0.5);
  const yMed = percentile(ys, kept, 0.5);

  // View rectangle: median-centered, half-extent = larger of the two
  // percentile distances per axis. Long tail outside the percentile box
  // falls off the edges; sparse side keeps some empty space.
  let halfX = Math.max(xMed - xLo, xHi - xMed) / FIT_FILL;
  let halfY = Math.max(yMed - yLo, yHi - yMed) / FIT_FILL;
  const bboxAspect = halfX / halfY;
  if (bboxAspect > MAX_ASPECT) halfX = halfY * MAX_ASPECT;
  else if (bboxAspect < 1 / MAX_ASPECT) halfY = halfX * MAX_ASPECT;

  const viewXLo = xMed - halfX;
  const viewXHi = xMed + halfX;
  const viewYLo = yMed - halfY;
  const viewYHi = yMed + halfY;
  const effAspect = halfX / halfY;

  if (effAspect >= 1) {
    IMG_W = roundDim(MAX_DIM);
    IMG_H = roundDim(MAX_DIM / effAspect);
  } else {
    IMG_H = roundDim(MAX_DIM);
    IMG_W = roundDim(MAX_DIM * effAspect);
  }
  OUTPUT_FILE = `${LABEL}-depth${DEPTH}-${IMG_W}x${IMG_H}.png`;

  log(`  percentile bbox = [${xLo.toFixed(3)}, ${xHi.toFixed(3)}] × [${yLo.toFixed(3)}, ${yHi.toFixed(3)}]`);
  log(`  median          = (${xMed.toFixed(3)}, ${yMed.toFixed(3)})`);
  log(`  view rect       = [${viewXLo.toFixed(3)}, ${viewXHi.toFixed(3)}] × [${viewYLo.toFixed(3)}, ${viewYHi.toFixed(3)}]`);
  log(`  bbox aspect = ${bboxAspect.toFixed(2)}  capped at ${MAX_ASPECT}  →  image = ${IMG_W}×${IMG_H}`);
  log(`  z range (2-98%) = [${zLo.toFixed(3)}, ${zHi.toFixed(3)}]  in ${Date.now() - t3} ms`);

  // World → pixel (orthographic, y-flipped).
  const sx = IMG_W / (viewXHi - viewXLo);
  const sy = IMG_H / (viewYHi - viewYLo);
  const oyTop = viewYHi;
  const zMid = (zLo + zHi) * 0.5;
  const zScale = 2 / Math.max(1e-12, (zHi - zLo));

  log(`Splatting (orthographic) into ${IMG_W}×${IMG_H} accumulator (${inColor ? 'color' : 'gray'})...`);
  const t4 = Date.now();
  accR = new Float32Array(IMG_W * IMG_H);
  if (inColor) {
    accG = new Float32Array(IMG_W * IMG_H);
    accB = new Float32Array(IMG_W * IMG_H);
  }
  for (let i = 0; i < kept; i++) {
    const px = (xs[i] - viewXLo) * sx;
    const py = (oyTop - ys[i]) * sy;
    if (px < -R_MAX || px >= IMG_W + R_MAX || py < -R_MAX || py >= IMG_H + R_MAX) continue;
    let zn = (zs[i] - zMid) * zScale;
    if (zn < -1) zn = -1; else if (zn > 1) zn = 1;
    const r = rMid + rHalf * Math.tanh(DEPTH_TANH_GAIN * zn);
    if (inColor) {
      const [pR, pG, pB] = inkMultipliers(tintForOrigIdx(keptIdx[i]));
      splatDiskColor(accR, accG, accB, IMG_W, IMG_H, px, py, r, pR, pG, pB);
    } else {
      splatDisk(accR, IMG_W, IMG_H, px, py, r);
    }
    drawn++;
  }
  log(`  drawn ${drawn.toLocaleString()} / ${kept.toLocaleString()}  in ${Date.now() - t4} ms`);
}

// ─── Tone-map ───────────────────────────────────────────────────────────────

log('Tone-mapping (log + percentile clip)...');
const t5 = Date.now();

// Find a single clip value from the nonzero accumulator entries. In color
// mode we pool all three channels so the brightness scale is consistent
// across R/G/B (otherwise per-channel clipping would equalize the family
// hues — bad).
const channels = inColor ? [accR, accG, accB] : [accR];
let nzCount = 0;
for (const ch of channels) {
  for (let i = 0; i < ch.length; i++) if (ch[i] > 0) nzCount++;
}
const nzArr = new Float32Array(nzCount);
{
  let w = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) if (ch[i] > 0) nzArr[w++] = ch[i];
  }
}
nzArr.sort();
const clipIdx = Math.min(
  nzArr.length - 1,
  Math.max(0, Math.floor(nzArr.length * TONE_PERCENTILE)),
);
const maxVal = nzArr.length > 0 ? nzArr[clipIdx] : 1;
const logDenom = Math.log1p(maxVal);
log(`  nonzero entries (across ${channels.length} ch): ${nzArr.length.toLocaleString()}  ` +
    `clip(${(TONE_PERCENTILE * 100).toFixed(1)}%) = ${maxVal.toFixed(3)}  ` +
    `max = ${(nzArr[nzArr.length - 1] ?? 0).toFixed(3)}`);

// ─── Write PNG ──────────────────────────────────────────────────────────────

log(`Encoding PNG (${BG} background, ${inColor ? `color depth ${COLOR_DEPTH}` : 'grayscale'})...`);
// pngjs's data buffer is always 4 bytes per pixel (RGBA). We write all four
// channels each pixel; the file is RGBA on disk.
const png = new PNG({ width: IMG_W, height: IMG_H });
const bgVal = BG === 'white' ? 255 : 0;

function toneVal(v) {
  if (v <= 0) return null;
  let t = Math.log1p(v) / logDenom;
  if (t > 1) t = 1;
  return t;
}

if (inColor) {
  // Per-channel mapping: bigger ink ⇒ more darkening (white bg) or more
  // brightness (black bg). The family color is preserved because R/G/B
  // accumulated proportionally to the splat's tint per channel.
  for (let i = 0; i < accR.length; i++) {
    const tR = toneVal(accR[i]);
    const tG = toneVal(accG[i]);
    const tB = toneVal(accB[i]);
    let r, g, b;
    if (tR === null && tG === null && tB === null) {
      r = g = b = bgVal;
    } else if (usingWhiteBg) {
      r = Math.round(255 * (1 - (tR ?? 0)));
      g = Math.round(255 * (1 - (tG ?? 0)));
      b = Math.round(255 * (1 - (tB ?? 0)));
    } else {
      r = Math.round(255 * (tR ?? 0));
      g = Math.round(255 * (tG ?? 0));
      b = Math.round(255 * (tB ?? 0));
    }
    const idx = 4 * i;
    png.data[idx]     = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = 255;
  }
} else {
  // Grayscale: R = G = B = computed intensity.
  for (let i = 0; i < accR.length; i++) {
    const t = toneVal(accR[i]);
    let out;
    if (t === null) out = bgVal;
    else out = Math.round(usingWhiteBg ? 255 * (1 - t) : 255 * t);
    const idx = 4 * i;
    png.data[idx]     = out;
    png.data[idx + 1] = out;
    png.data[idx + 2] = out;
    png.data[idx + 3] = 255;
  }
}
log(`  tone-map + encode in ${Date.now() - t5} ms`);

const fout = createWriteStream(OUTPUT_FILE);
png.pack().pipe(fout);
await once(fout, 'finish');

log(`Wrote ${OUTPUT_FILE}  (total ${((Date.now() - tStart) / 1000).toFixed(1)}s)`);
