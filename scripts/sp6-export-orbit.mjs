#!/usr/bin/env node
/**
 * sp6-export-orbit.mjs
 *
 * Standalone Node script: generates the orbit of a proximal basepoint in
 * RP^5 under a 2-generator subgroup of Sp(6, Z), deduplicates, and writes
 * one point per line to a text file. No browser, no build step.
 *
 *   node scripts/sp6-export-orbit.mjs
 *
 * To switch examples (different matrices / loxodromic word / depth), edit
 * the EDITABLE block below. Reference values for all the examples we have
 * demos of are listed beside each profile.
 */

import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

// ─── EDITABLE ───────────────────────────────────────────────────────────────
//
// Change the matrices, the loxodromic word, and the run parameters here.
//
// Generators are encoded as integer codes:  0 = B,  1 = B⁻¹,  2 = T,  3 = T⁻¹.
//
// B is the companion matrix of g(x). Action on a 6-vector v:
//   B(v) = (-v₅, v₀ - C₀v₅, v₁ - C₁v₅, ..., v₄ - C₄v₅)
//   where  C = B_C = coefflistg[1..5].
// T is the unipotent transvection T = I + (T_COL - e₁) · e₁ᵀ, so:
//   T(v) = v with v[0] preserved and v[i] += T_COL[i]·v[0]  for i ≥ 1.
// T_COL[0] is always 1 (it's the diagonal entry of T's column 1).
//
// Closed form: T_COL[i] = coefflistf[i] - coefflistg[i] for i = 1..5.

// EXAMPLE: C-32 (BDN Table 2, thin)
//   α = (0,0,0,0,1/6,5/6),  β = (1/4,3/4,1/12,5/12,7/12,11/12)
//   f(x) = (x-1)^4(x²-x+1),  g(x) = x^6 + 1
const B_C   = [0, 0, 0, 0, 0];                  // = coefflistg[1..5]
const T_COL = [1, -5, 11, -14, 11, -5];         // = (1, c_1, ..., c_5)
const GAMMA = [0, 2, 0, 2, 0, 2, 0];            // = BTBTBTB
const LABEL = 'c32';

// Other example profiles (uncomment & swap LABEL too):
//
//   C-47:    B_C=[4,8,10,8,4],   T_COL=[1,-5,-8,-10,-8,-5],  GAMMA=[2,0,2]   // TBT
//   C-55:    B_C=[2,0,-2,0,2],   T_COL=[1,-4,1,2,1,-4],      GAMMA=[2,0,2]
//   C-2:     B_C=[4,7,8,7,4],    T_COL=[1,-7,-4,-10,-4,-7],  GAMMA=[2,0,2]
//   A-1:     B_C=[6,15,20,15,6], T_COL=[1,-12,0,-40,0,-12],  GAMMA=[2,0,2]
//   A-15:    B_C=[1,2,1,2,1],    T_COL=[1,-7,13,-21,13,-7],  GAMMA=[2,0,2]

const DEPTH = 10;                  // BFS depth
const POWER_ITER_STEPS = 50;       // for the proximal basepoint
const CHART_DENOM_IDX = 5;         // 0..5 — index of v used as the affine chart denominator;
                                   //  '5' means: rescale each orbit point so its 6th
                                   //  coordinate is 1, and emit the other 5 as an R⁵ point.
                                   //  Set to 0 to use v₁ instead (matches the demo).
const EPS_DENOM = 1e-3;            // skip points with |v[CHART_DENOM_IDX]| < this
const SKIP_DEDUP = DEPTH >= 14;    // dedup hash needs ~100 bytes/entry; >14 won't fit in
                                   // default Node heap. Set true to skip and accept some duplicates.
const DEDUPE_TOLERANCE = 1e-8;     // chart-coord rounding for the dedup hash (when used)
const OUTPUT_DIGITS = 10;          // decimals printed per coordinate
const OUTPUT_FILE = `${LABEL}-orbit-depth${DEPTH}-chart${CHART_DENOM_IDX + 1}.txt`;

// ─── Math (no need to edit) ────────────────────────────────────────────────

const INV = [1, 0, 3, 2];

function applyGen(g, src, sOff, dst, dOff) {
  const a = src[sOff],     b = src[sOff + 1], c = src[sOff + 2];
  const d = src[sOff + 3], e = src[sOff + 4], f = src[sOff + 5];
  switch (g) {
    case 0: // B
      dst[dOff]     = -f;
      dst[dOff + 1] =  a - B_C[0] * f;
      dst[dOff + 2] =  b - B_C[1] * f;
      dst[dOff + 3] =  c - B_C[2] * f;
      dst[dOff + 4] =  d - B_C[3] * f;
      dst[dOff + 5] =  e - B_C[4] * f;
      return;
    case 1: // B⁻¹
      dst[dOff]     =  b - B_C[0] * a;
      dst[dOff + 1] =  c - B_C[1] * a;
      dst[dOff + 2] =  d - B_C[2] * a;
      dst[dOff + 3] =  e - B_C[3] * a;
      dst[dOff + 4] =  f - B_C[4] * a;
      dst[dOff + 5] = -a;
      return;
    case 2: // T
      dst[dOff]     = a;
      dst[dOff + 1] = b + T_COL[1] * a;
      dst[dOff + 2] = c + T_COL[2] * a;
      dst[dOff + 3] = d + T_COL[3] * a;
      dst[dOff + 4] = e + T_COL[4] * a;
      dst[dOff + 5] = f + T_COL[5] * a;
      return;
    case 3: // T⁻¹
      dst[dOff]     = a;
      dst[dOff + 1] = b - T_COL[1] * a;
      dst[dOff + 2] = c - T_COL[2] * a;
      dst[dOff + 3] = d - T_COL[3] * a;
      dst[dOff + 4] = e - T_COL[4] * a;
      dst[dOff + 5] = f - T_COL[5] * a;
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

// γ = GAMMA[0] · GAMMA[1] · ... read left-to-right as a matrix product;
// applying it to a vector means we evaluate the rightmost letter first.
function applyGamma(buf) {
  for (let i = GAMMA.length - 1; i >= 0; i--) {
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

  // Diagnostics: |λ_max| from the norm gain on one more apply, and a
  // "drift" measure (≈0 ⇒ λ>0; ≈2 ⇒ λ<0; anything else ⇒ γ has a complex
  // top eigenvalue and the iteration is rotating).
  const tmp = new Float64Array(v);
  applyGamma(tmp);
  let lam2 = 0;
  for (let i = 0; i < 6; i++) lam2 += tmp[i] * tmp[i];
  const tmp2 = new Float64Array(tmp);
  normalize(tmp2);
  let drift = 0;
  for (let i = 0; i < 6; i++) {
    const d = tmp2[i] - v[i];
    drift += d * d;
  }
  process.stderr.write(
    `Power iteration: |λ_max(γ)| ≈ ${Math.sqrt(lam2).toFixed(3)}, ` +
    `drift = ${Math.sqrt(drift).toFixed(6)}\n`,
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
  for (let i = 0; i < 6; i++) vecs[i] = basepoint[i];
  lastGen[0] = 255;
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
        w++;
      }
    }
    pStart = pEnd;
    pEnd = w;
  }
  return { vecs, count: w };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const log = (msg) => process.stderr.write(msg + '\n');

log(`[sp6-export] label=${LABEL}, depth=${DEPTH}, chart denom = v[${CHART_DENOM_IDX + 1}]`);
log(`[sp6-export] B_C   = ${JSON.stringify(B_C)}`);
log(`[sp6-export] T_COL = ${JSON.stringify(T_COL)}`);
log(`[sp6-export] GAMMA = ${JSON.stringify(GAMMA)}  (${GAMMA.map((g) => 'BCTt'[g] || '?').join('')})`);

log('Computing proximal basepoint...');
const basepoint = computeProximalBasepoint();

log(`Generating orbit (depth ${DEPTH}, ${totalNodes(DEPTH).toLocaleString()} words)...`);
const t0 = Date.now();
const { vecs, count } = generateOrbit(DEPTH, basepoint);
log(`  BFS done in ${Date.now() - t0} ms`);

// Project to the affine chart {v[CHART_DENOM_IDX] = 1}: divide all
// 6 components by v[CHART_DENOM_IDX], then emit the *other 5* as an R⁵ point.
// Antipodal S⁵ representatives (v and -v) automatically collapse, since
// (v_i / v_d) = ((-v_i) / (-v_d)).
log(
  `Projecting to affine chart (denom = v[${CHART_DENOM_IDX + 1}])` +
  (SKIP_DEDUP ? '  [dedup skipped]' : `  + dedup (tol ${DEDUPE_TOLERANCE})`) +
  ', streaming to disk...',
);
const t1 = Date.now();
const tolDigits = Math.max(0, Math.round(-Math.log10(DEDUPE_TOLERANCE)));
const seen = SKIP_DEDUP ? null : new Set();
let filtered = 0, deduped = 0, written = 0;

const dig = OUTPUT_DIGITS;
const chartIdx = []; // indices to emit (everything except CHART_DENOM_IDX)
for (let j = 0; j < 6; j++) if (j !== CHART_DENOM_IDX) chartIdx.push(j);

const header = [
  `# Sp(6,Z) orbit — label=${LABEL}, depth=${DEPTH}`,
  `# Affine chart of RP^5 with v[${CHART_DENOM_IDX + 1}] = 1; each line is the`,
  `#   5-tuple of remaining coordinates ${chartIdx.map((j) => `v[${j + 1}]`).join(', ')} (in this order),`,
  `#   divided by v[${CHART_DENOM_IDX + 1}].`,
  `# B_C   = ${JSON.stringify(B_C)}`,
  `# T_COL = ${JSON.stringify(T_COL)}`,
  `# GAMMA = ${JSON.stringify(GAMMA)}`,
  `# dedup = ${SKIP_DEDUP ? 'no (file may contain duplicates)' : `yes (tol ${DEDUPE_TOLERANCE})`}`,
  `# generated ${new Date().toISOString()}`,
  '',
].join('\n');

const fout = createWriteStream(OUTPUT_FILE);
fout.write(header);

// Buffer lines into ~1 MB chunks before flushing — much faster than
// one stream.write per line.
const BATCH = 16384;
const batch = [];
const flushBatch = () => {
  if (batch.length === 0) return;
  // backpressure-aware: if write returns false, wait for 'drain'.
  const ok = fout.write(batch.join('\n') + '\n');
  batch.length = 0;
  return ok;
};

for (let i = 0; i < count; i++) {
  const off = i * 6;
  const denom = vecs[off + CHART_DENOM_IDX];
  if (Math.abs(denom) < EPS_DENOM) { filtered++; continue; }
  const inv = 1 / denom;

  const c0 = vecs[off + chartIdx[0]] * inv;
  const c1 = vecs[off + chartIdx[1]] * inv;
  const c2 = vecs[off + chartIdx[2]] * inv;
  const c3 = vecs[off + chartIdx[3]] * inv;
  const c4 = vecs[off + chartIdx[4]] * inv;

  if (seen !== null) {
    const key =
      `${c0.toFixed(tolDigits)} ${c1.toFixed(tolDigits)} ${c2.toFixed(tolDigits)} ` +
      `${c3.toFixed(tolDigits)} ${c4.toFixed(tolDigits)}`;
    if (seen.has(key)) { deduped++; continue; }
    seen.add(key);
  }

  batch.push(
    `${c0.toFixed(dig)} ${c1.toFixed(dig)} ${c2.toFixed(dig)} ` +
    `${c3.toFixed(dig)} ${c4.toFixed(dig)}`,
  );
  written++;
  if (batch.length >= BATCH) flushBatch();
}
flushBatch();
fout.end();
await once(fout, 'finish');

log(
  `  ${written.toLocaleString()} points written  ` +
  `(filtered ${filtered.toLocaleString()}` +
  (SKIP_DEDUP ? '' : `, deduped ${deduped.toLocaleString()}`) +
  `)`,
);
log(`Wrote ${OUTPUT_FILE} in ${Date.now() - t1} ms`);
