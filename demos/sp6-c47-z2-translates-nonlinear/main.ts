/**
 * Sp(6,Z) — C-47: Z²-translates of a 64-word seed, viewed through `weirdfun`.
 *
 * Direct port of the construction in `c47 in sp6r (1).nb`, the cells leading
 * up to `ListPointPlot3D[Map[weirdfun, morepointsinR3]]` (In[120]):
 *
 *   1. polynomials f, g for C-47 (BDN hypergeometric data α, β)
 *   2. companion matrices A, B and their (closed-form) inverses
 *   3. T = A · B⁻¹
 *   4. witness word W from the notebook (line 2357), case-swapped to our
 *      convention (uppercase = matrix, lowercase = inverse — opposite of the
 *      notebook's `b = BB, B = Inverse[BB]` convention)
 *   5. X₁ = T,  X₂ = W · T · W⁻¹
 *   6. exact commutativity check [X₁, X₂] = 0 (BigInt, throws on failure)
 *   7. nilpotents N_i = X_i − I,  N₁N₂  (each N_i is square-zero)
 *   8. Z² translates  M_{m,n} = I + m N₁ + n N₂ + mn N₁N₂  for (m, n) ∈
 *      [-range, range]²  (rescaled by max|entry| to Float64-safe matrices)
 *   9. seed orbit `points` — the notebook's 64 forward length-6 words in
 *      gens = {B, T} (NO inverses, NO non-backtracking BFS) acting on
 *      ξ₊(γ = TBT). Same set as the notebook's `points`.
 *  10. for each (ξ ∈ points, translate M): apply M·ξ, normalize, project to
 *      R³ via chart (v₂, v₃, v₄)/v₁, then apply `weirdfun`:
 *
 *            ψ(x, y, z) = ( log(x + 1),  log(y) + 1,  sign(z)·log(|z| + 1) )
 *
 *      The notebook's `weirdfun` leaves z raw; we signed-log z to keep the
 *      cloud from being a needle along z's much larger range. (Notebook's
 *      morepointsinR3 has tight z because of its specific Float64 collapse;
 *      ours has wider z if the c47 witness doesn't fully collapse — TBD.)
 *
 * Renders directly with a fixed camera; no autofit. Use mouse to orbit/zoom.
 */

import * as THREE from 'three';
import { App } from '@/app/App';

// ─── Editable parameters ────────────────────────────────────────────────────

const RANGE = 10;   // (m, n) ∈ [-RANGE, RANGE]² — matches notebook's `range = 10`

// ─── BigInt 6×6 matrix utilities ────────────────────────────────────────────

type BigMat = bigint[];

function bigEye(): BigMat {
  const m: BigMat = new Array(36).fill(0n);
  for (let i = 0; i < 6; i++) m[i * 6 + i] = 1n;
  return m;
}

function bigMul(a: BigMat, b: BigMat): BigMat {
  const c: BigMat = new Array(36).fill(0n);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let s = 0n;
      for (let k = 0; k < 6; k++) s += a[i * 6 + k] * b[k * 6 + j];
      c[i * 6 + j] = s;
    }
  }
  return c;
}

function bigSub(a: BigMat, b: BigMat): BigMat {
  return a.map((x, i) => x - b[i]);
}

function isZero(m: BigMat): boolean {
  for (const x of m) if (x !== 0n) return false;
  return true;
}

function isIdentity(m: BigMat): boolean {
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const want = i === j ? 1n : 0n;
      if (m[i * 6 + j] !== want) return false;
    }
  }
  return true;
}

function maxAbsBig(m: BigMat): bigint {
  let max = 0n;
  for (const x of m) {
    const ax = x < 0n ? -x : x;
    if (ax > max) max = ax;
  }
  return max;
}

function digitsOf(x: bigint): number {
  return (x < 0n ? -x : x).toString().length;
}

function formatMat(m: BigMat, indent = '    '): string {
  const widths = new Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const len = m[i * 6 + j].toString().length;
      if (len > widths[j]) widths[j] = len;
    }
  }
  const lines: string[] = [];
  for (let i = 0; i < 6; i++) {
    const cells: string[] = [];
    for (let j = 0; j < 6; j++) {
      cells.push(m[i * 6 + j].toString().padStart(widths[j]));
    }
    lines.push(`${indent}[ ${cells.join('  ')} ]`);
  }
  return lines.join('\n');
}

function companion(coeffs: bigint[]): BigMat {
  const m: BigMat = new Array(36).fill(0n);
  for (let i = 1; i < 6; i++) m[i * 6 + (i - 1)] = 1n;
  for (let i = 0; i < 6; i++) m[i * 6 + 5] = -coeffs[i];
  return m;
}

function inverseCompanion(coeffs: bigint[]): BigMat {
  if (coeffs[0] !== 1n) throw new Error('inverseCompanion: needs constant term = 1');
  const m: BigMat = new Array(36).fill(0n);
  for (let i = 0; i < 5; i++) m[i * 6 + 0] = -coeffs[i + 1];
  m[5 * 6 + 0] = -coeffs[0];
  for (let j = 1; j < 6; j++) m[(j - 1) * 6 + j] = 1n;
  return m;
}

// ─── Step 1: polynomials (C-47) ─────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Sp(6,Z) — C-47 Z²-translates + weirdfun (nonlinear chart)');
console.log('═══════════════════════════════════════════════════════════════');

console.log('\n┌─ Step 1: polynomials ──────────────────────────────────────');
console.log('  α = (0, 0, 1/5, 2/5, 3/5, 4/5)');
console.log('  β = (1/2, 1/2, 1/3, 1/3, 2/3, 2/3)');
console.log('  f(x) = (x-1)²(x⁴+x³+x²+x+1)  = 1 − x − x⁵ + x⁶');
console.log('  g(x) = (x+1)²(x²+x+1)²       = 1 + 4x + 8x² + 10x³ + 8x⁴ + 4x⁵ + x⁶');

const coefflistf: bigint[] = [1n, -1n, 0n, 0n, 0n, -1n, 1n];
const coefflistg: bigint[] = [1n,  4n, 8n, 10n, 8n,  4n, 1n];

console.log('  coefflistf =', JSON.stringify(coefflistf.map(String)));
console.log('  coefflistg =', JSON.stringify(coefflistg.map(String)));

// ─── Step 2: companion matrices A, B and inverses ──────────────────────────

console.log('\n┌─ Step 2: companion matrices ───────────────────────────────');
const A     = companion(coefflistf);
const B     = companion(coefflistg);
const A_inv = inverseCompanion(coefflistf);
const B_inv = inverseCompanion(coefflistg);

console.log('  B = companion(g):');
console.log(formatMat(B));

const aOk = isIdentity(bigMul(A, A_inv));
const bOk = isIdentity(bigMul(B, B_inv));
console.log(`  A · A⁻¹ = I?   ${aOk ? '✓ yes' : '✗ FAIL'}`);
console.log(`  B · B⁻¹ = I?   ${bOk ? '✓ yes' : '✗ FAIL'}`);
if (!aOk || !bOk) throw new Error('companion-inverse sanity check failed');

// ─── Step 3: transvection T = A · B⁻¹ ──────────────────────────────────────

console.log('\n┌─ Step 3: transvection T = A · B⁻¹ ─────────────────────────');
const T = bigMul(A, B_inv);
console.log('  T =');
console.log(formatMat(T));

// ─── Step 4: the witness W (from notebook) ─────────────────────────────────

console.log('\n┌─ Step 4: the witness W ────────────────────────────────────');

// Verbatim from `c47 in sp6r (1).nb`, witness cell at line 2357. The notebook
// uses lowercase = matrix, uppercase = inverse. We swap case below to match
// this demo's convention (uppercase = matrix).
const W_STR_NOTEBOOK =
  'bbbbbaabbbbbbAAbbbbbbaabbbbbbAAbbbbbbAAbbbbbbABaBaaBBBBBBAAAbAbaaBaBaBaBaBAAAAAAABaBaBBaBabaa';

function swapCase(s: string): string {
  return s.split('').map((c) =>
    c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(),
  ).join('');
}

const W_STR = swapCase(W_STR_NOTEBOOK);
console.log(`  W (notebook convention)    = ${W_STR_NOTEBOOK}`);
console.log(`  W (this demo's convention) = ${W_STR}`);
console.log(`  length = ${W_STR.length}`);
console.log('  (uppercase = matrix, lowercase = inverse:  A,a = A^±¹;  B,b = B^±¹)');

const letterToMat: Record<string, BigMat> = { A, a: A_inv, B, b: B_inv };
const inverseLetter: Record<string, string> = { A: 'a', a: 'A', B: 'b', b: 'B' };

function wordToMatrix(word: string): BigMat {
  let m = bigEye();
  for (const c of word) m = bigMul(m, letterToMat[c]);
  return m;
}

const W = wordToMatrix(W_STR);
const W_INV_STR = W_STR.split('').reverse().map((c) => inverseLetter[c]).join('');
const W_inv = wordToMatrix(W_INV_STR);

const wOk = isIdentity(bigMul(W, W_inv));
console.log(`  W · W⁻¹ = I?   ${wOk ? '✓ yes' : '✗ FAIL'}`);
if (!wOk) throw new Error('W · W^{-1} ≠ I');

console.log(`  W has integer entries up to ${digitsOf(maxAbsBig(W))} digits`);
console.log('  W =');
console.log(formatMat(W));

// ─── Step 5: X₁ = otherT = A⁻¹·B,  X₂ = W·otherT·W⁻¹ ───────────────────────
//
// The c47 notebook uses `otherT = Inverse[AA].BB` (line 2426) as the
// transvection that gets conjugated by the witness — NOT T = A·B⁻¹. The
// pair (T, W·T·W⁻¹) does *not* commute for this W; the pair (otherT,
// W·otherT·W⁻¹) does. For c55 the situation is different and T itself works.

console.log('\n┌─ Step 5: X₁ = otherT = A⁻¹·B,  X₂ = W·otherT·W⁻¹ ──────────');
const otherT = bigMul(A_inv, B);
console.log('  otherT =');
console.log(formatMat(otherT));
const X1 = otherT;
const X2 = bigMul(bigMul(W, otherT), W_inv);
console.log(`  X₁ entries up to ${digitsOf(maxAbsBig(X1))} digits`);
console.log(`  X₂ entries up to ${digitsOf(maxAbsBig(X2))} digits`);

// ─── Step 6: exact commutativity ────────────────────────────────────────────

console.log('\n┌─ Step 6: commutativity check ──────────────────────────────');
const X1X2 = bigMul(X1, X2);
const X2X1 = bigMul(X2, X1);
const COMM = bigSub(X1X2, X2X1);
const COMMUTE = isZero(COMM);

console.log(
  `  X₁·X₂ = X₂·X₁ ?   ` +
  (COMMUTE ? '✓ YES — X₁ and X₂ COMMUTE' : '✗ NO — DO NOT commute'),
);
if (!COMMUTE) {
  console.error(`  max |[X₁,X₂]| = ${maxAbsBig(COMM).toString()}`);
  throw new Error('X1 and X2 do not commute');
}

(window as unknown as { debug: Record<string, BigMat> }).debug = {
  A, B, A_inv, B_inv, T, W, W_inv, X1, X2, COMM,
};

// ─── Step 7: nilpotents N_i and N₁N₂ ────────────────────────────────────────

console.log('\n┌─ Step 7: nilpotent parts N_i = X_i − I ────────────────────');
const I_BIG = bigEye();
const N1  = bigSub(X1, I_BIG);
const N2  = bigSub(X2, I_BIG);
const N12 = bigMul(N1, N2);
console.log(`  digits(max|N₁|)   = ${digitsOf(maxAbsBig(N1))}`);
console.log(`  digits(max|N₂|)   = ${digitsOf(maxAbsBig(N2))}`);
console.log(`  digits(max|N₁N₂|) = ${digitsOf(maxAbsBig(N12))}`);
console.log(`  N₁N₂ = 0 ?   ${isZero(N12) ? '✓ yes (so X₁^m X₂^n = I + mN₁ + nN₂ exactly)' : '✗ no'}`);

// ─── Step 8: Float64 translate matrices M'_{m,n} ───────────────────────────
//
// No rebalance — directly mirror the notebook's z2words = X₁^m X₂^n.
// Rescale each by max|entry| so it's a Float64-safe matrix with the same
// projective action.

const gridSize = 2 * RANGE + 1;
const numTranslates = gridSize * gridSize;

function buildMPrime(m: number, n: number): Float64Array {
  const mB = BigInt(m);
  const nB = BigInt(n);
  const mnB = mB * nB;
  const big = new Array<bigint>(36);
  for (let i = 0; i < 36; i++) {
    big[i] = mB * N1[i] + nB * N2[i] + mnB * N12[i];
  }
  for (let i = 0; i < 6; i++) big[i * 7] += 1n;

  let max = 0n;
  for (const x of big) {
    const ax = x < 0n ? -x : x;
    if (ax > max) max = ax;
  }
  const out = new Float64Array(36);
  if (max === 0n) return out;
  const denom = Number(max);
  for (let i = 0; i < 36; i++) out[i] = Number(big[i]) / denom;
  return out;
}

console.log(`\n┌─ Step 8: ${numTranslates} translate matrices (range = ${RANGE}) ──`);
const tGrid = performance.now();
const allM: Float64Array[] = new Array(numTranslates);
const allColors: Array<[number, number, number]> = new Array(numTranslates);
{
  const tmpColor = new THREE.Color();
  let t = 0;
  for (let mm = -RANGE; mm <= RANGE; mm++) {
    for (let nn = -RANGE; nn <= RANGE; nn++) {
      allM[t] = buildMPrime(mm, nn);
      const r = Math.sqrt(mm * mm + nn * nn);
      if (r === 0) {
        allColors[t] = [0.55, 0.55, 0.55];
      } else {
        const theta = Math.atan2(nn, mm);
        const hue = ((theta / (2 * Math.PI)) + 1) % 1;
        const sat = Math.min(1, r / RANGE);
        tmpColor.setHSL(hue, sat, 0.55);
        allColors[t] = [tmpColor.r, tmpColor.g, tmpColor.b];
      }
      t++;
    }
  }
}
console.log(`  built in ${(performance.now() - tGrid).toFixed(0)} ms`);

// ─── Step 9: Float64 generators (B, T only) and proximal basepoint ─────────

const T_COL_F: readonly number[] = [1, -5, -8, -10, -8, -5];
const B_C_F:   readonly number[] = [4,  8, 10,   8,  4];

function applyB(src: Float64Array, srcOff: number, dst: Float64Array, dstOff: number): void {
  const a = src[srcOff],     b = src[srcOff + 1], c = src[srcOff + 2];
  const d = src[srcOff + 3], e = src[srcOff + 4], f = src[srcOff + 5];
  dst[dstOff]     = -f;
  dst[dstOff + 1] =  a - B_C_F[0] * f;
  dst[dstOff + 2] =  b - B_C_F[1] * f;
  dst[dstOff + 3] =  c - B_C_F[2] * f;
  dst[dstOff + 4] =  d - B_C_F[3] * f;
  dst[dstOff + 5] =  e - B_C_F[4] * f;
}

function applyT(src: Float64Array, srcOff: number, dst: Float64Array, dstOff: number): void {
  const a = src[srcOff],     b = src[srcOff + 1], c = src[srcOff + 2];
  const d = src[srcOff + 3], e = src[srcOff + 4], f = src[srcOff + 5];
  dst[dstOff]     = a;
  dst[dstOff + 1] = b + T_COL_F[1] * a;
  dst[dstOff + 2] = c + T_COL_F[2] * a;
  dst[dstOff + 3] = d + T_COL_F[3] * a;
  dst[dstOff + 4] = e + T_COL_F[4] * a;
  dst[dstOff + 5] = f + T_COL_F[5] * a;
}

function normalize6InPlace(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 6; i++) buf[off + i] *= inv;
}

// γ = T · B · T (notebook line 866)
function applyGamma(buf: Float64Array): void {
  applyT(buf, 0, buf, 0);
  applyB(buf, 0, buf, 0);
  applyT(buf, 0, buf, 0);
}

console.log('\n┌─ Step 9: proximal basepoint ξ₊(γ) for γ = T·B·T ───────────');
const basepoint = new Float64Array(6);
basepoint[0] = 1;   basepoint[1] = 0.7; basepoint[2] = -0.3;
basepoint[3] = 0.1; basepoint[4] = -0.5; basepoint[5] = 0.2;
normalize6InPlace(basepoint, 0);
for (let k = 0; k < 30; k++) {
  applyGamma(basepoint);
  normalize6InPlace(basepoint, 0);
}
{
  const probe = new Float64Array(basepoint);
  applyGamma(probe);
  let s = 0;
  for (let i = 0; i < 6; i++) s += probe[i] * probe[i];
  console.log(`  |λ_max(γ)| ≈ ${Math.sqrt(s).toFixed(3)}  (expect ≈ 7.305)`);
  console.log(`  ξ₊ = (${Array.from(basepoint).map((x) => x.toFixed(4)).join(', ')})`);
}

// ─── Step 10: seed orbit — 64 forward length-6 words in {B, T} ─────────────
//
// Notebook builds words2..words6 by recursive Table[gens[i] . gens[j], ...]
// over gens = {BB, T}. This enumerates all 2^6 = 64 length-6 words in the
// monoid generated by {B, T} (no inverses, no non-backtracking restriction).
// Each word acts on ξ₊ to give a seed orbit point.

console.log('\n┌─ Step 10: seed orbit (64 forward length-6 words in {B, T}) ─');
const SEED_COUNT = 64;
const seedVecs = new Float64Array(SEED_COUNT * 6);

{
  const tmp = new Float64Array(6);
  const tmp2 = new Float64Array(6);
  for (let i = 0; i < SEED_COUNT; i++) {
    tmp.set(basepoint);
    // Word bits: 0 → apply B, 1 → apply T. Read MSB first so each i ∈ 0..63
    // is a distinct length-6 word.
    for (let p = 0; p < 6; p++) {
      const bit = (i >> (5 - p)) & 1;
      if (bit === 0) applyB(tmp, 0, tmp2, 0); else applyT(tmp, 0, tmp2, 0);
      tmp.set(tmp2);
    }
    normalize6InPlace(tmp, 0);
    seedVecs.set(tmp, i * 6);
  }
}
console.log(`  ${SEED_COUNT} seed points generated.`);

// ─── Step 11: apply each translate to each seed point, project ──────────────
//
// Chart: π(v) = (v₂, v₃, v₄) / v₁  (matches notebook).
// Then `weirdfun`:  ψ(x, y, z) = (log(x+1), log(y)+1, signed_log(z))
// applied in the vertex shader. Domain (x > -1, y > 0) filtered on CPU.
//
// We store the LINEAR chart coords in instance attributes and apply weirdfun
// on the GPU. With autofit dropped, GPU is the only place the projection
// formula lives.

const EPS_V0 = 1e-6;
const EPS_DOM = 1e-6;

const totalRaw = numTranslates * SEED_COUNT;
console.log(`\n┌─ Step 11: rendering pass ──────────────────────────────────`);
console.log(`  raw count = ${totalRaw.toLocaleString()}  (${numTranslates} translates × ${SEED_COUNT} seeds)`);

const positionsRaw = new Float32Array(totalRaw * 3);
const colorsRaw    = new Float32Array(totalRaw * 3);
let kept = 0;
let dropV1 = 0;
let dropX = 0;
let dropY = 0;

const tmp = new Float64Array(6);
const tApply = performance.now();
for (let t = 0; t < numTranslates; t++) {
  const M = allM[t];
  const col = allColors[t];
  for (let i = 0; i < SEED_COUNT; i++) {
    const off = i * 6;
    const x0 = seedVecs[off],     x1 = seedVecs[off + 1], x2 = seedVecs[off + 2];
    const x3 = seedVecs[off + 3], x4 = seedVecs[off + 4], x5 = seedVecs[off + 5];
    tmp[0] = M[ 0]*x0 + M[ 1]*x1 + M[ 2]*x2 + M[ 3]*x3 + M[ 4]*x4 + M[ 5]*x5;
    tmp[1] = M[ 6]*x0 + M[ 7]*x1 + M[ 8]*x2 + M[ 9]*x3 + M[10]*x4 + M[11]*x5;
    tmp[2] = M[12]*x0 + M[13]*x1 + M[14]*x2 + M[15]*x3 + M[16]*x4 + M[17]*x5;
    tmp[3] = M[18]*x0 + M[19]*x1 + M[20]*x2 + M[21]*x3 + M[22]*x4 + M[23]*x5;
    tmp[4] = M[24]*x0 + M[25]*x1 + M[26]*x2 + M[27]*x3 + M[28]*x4 + M[29]*x5;
    tmp[5] = M[30]*x0 + M[31]*x1 + M[32]*x2 + M[33]*x3 + M[34]*x4 + M[35]*x5;

    normalize6InPlace(tmp, 0);

    // Chart with denominator v₁ (= tmp[0]).
    if (Math.abs(tmp[0]) < EPS_V0) { dropV1++; continue; }
    const inv = 1 / tmp[0];
    const px = tmp[1] * inv;
    const py = tmp[2] * inv;
    const pz = tmp[3] * inv;

    // Domain of weirdfun: x > -1 (log(x+1) finite), y > 0 (log(y) finite).
    if (px <= -1 + EPS_DOM) { dropX++; continue; }
    if (py <=  0 + EPS_DOM) { dropY++; continue; }

    positionsRaw[kept * 3]     = px;
    positionsRaw[kept * 3 + 1] = py;
    positionsRaw[kept * 3 + 2] = pz;
    colorsRaw[kept * 3]     = col[0];
    colorsRaw[kept * 3 + 1] = col[1];
    colorsRaw[kept * 3 + 2] = col[2];
    kept++;
  }
}
console.log(
  `  ${kept.toLocaleString()} kept  ` +
  `(drop |v₁|<ε: ${dropV1.toLocaleString()},  drop x≤-1: ${dropX.toLocaleString()},  drop y≤0: ${dropY.toLocaleString()})  ` +
  `in ${(performance.now() - tApply).toFixed(0)} ms`,
);

const positions = positionsRaw.slice(0, kept * 3);
const colors    = colorsRaw.slice(0, kept * 3);

// ─── Render ─────────────────────────────────────────────────────────────────
//
// Vertex shader takes linear chart coords from the instance attribute and
// applies weirdfun (extended with signed-log on z). Single source of truth
// for the projection formula — no CPU-side autofit to keep in sync.

const VERT = /* glsl */`
  uniform float uRadius;
  uniform float uMono;

  attribute vec3 aPos;   // linear chart coords (x, y, z) = (v₂, v₃, v₄)/v₁
  attribute vec3 aColor;

  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    // weirdfun (extended): ψ(x,y,z) = (log(x+1), log(y)+1, sign(z)·log(|z|+1))
    float wx = log(aPos.x + 1.0);
    float wy = log(aPos.y) + 1.0;
    float wz = sign(aPos.z) * log(abs(aPos.z) + 1.0);
    vec3 center = vec3(wx, wy, wz);

    vec3 worldPos = center + position * uRadius;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

    vNormal = normalize(normalMatrix * normal);
    vColor = mix(aColor, vec3(0.82), uMono);
  }
`;

const FRAG = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.4, 0.8, 0.6));
    float diff = max(dot(N, L), 0.0);
    float amb = 0.35;
    gl_FragColor = vec4(vColor * (amb + diff * 0.85), 1.0);
  }
`;

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const sphereGeo = new THREE.SphereGeometry(1, 8, 6);

const uniforms = {
  uRadius: { value: 0.05 },
  uMono:   { value: 0.0 },
};
const material = new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader: FRAG, uniforms,
});

const instGeo = new THREE.InstancedBufferGeometry();
instGeo.index = sphereGeo.index;
for (const name of Object.keys(sphereGeo.attributes)) {
  instGeo.setAttribute(name, sphereGeo.attributes[name]);
}
instGeo.boundingSphere = null;
instGeo.boundingBox = null;
instGeo.instanceCount = kept;
instGeo.setAttribute('aPos',   new THREE.InstancedBufferAttribute(positions, 3));
instGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));

const mesh = new THREE.Mesh(instGeo, material);
mesh.frustumCulled = false;
app.scene.add(mesh);

// Fixed camera. weirdfun-image coords are typically O(1) on x, y and a few
// units on z; this view captures the +,+,+ octant. Mouse to orbit/zoom.
app.camera.position.set(6, 6, 6);
app.controls.target.set(0, 0, 0);
app.controls.update();

// ─── HUD ────────────────────────────────────────────────────────────────────

const css = document.createElement('style');
css.textContent = `
  #c47nl-panel {
    position: fixed; top: 12px; left: 12px;
    background: rgba(20,22,26,0.85); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.4 system-ui, sans-serif;
    user-select: none; z-index: 10;
    width: 290px; backdrop-filter: blur(6px);
  }
  #c47nl-panel .title { font-weight: 600; margin-bottom: 4px; }
  #c47nl-panel .meta { color: #bbb; font-size: 11px; line-height: 1.35; margin: 4px 0 6px; }
  #c47nl-panel label { display: flex; justify-content: space-between; margin-top: 6px; }
  #c47nl-panel input[type=range] { width: 100%; margin: 2px 0 4px; }
  #c47nl-panel .row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  #c47nl-panel .stats { color: #aaa; margin-top: 8px; font-size: 11px; }
`;
document.head.appendChild(css);

const panel = document.createElement('div');
panel.id = 'c47nl-panel';
panel.innerHTML = `
  <div class="title">Sp(6,ℤ) — C-47 Z²-translates · weirdfun</div>
  <div class="meta">
    seeds: 64 forward length-6 words in {B, T}<br>
    grid: (m, n) ∈ [-${RANGE}, ${RANGE}]² of ⟨X₁, X₂⟩ &nbsp;(no rebalance)<br>
    chart: (v₂, v₃, v₄)/v₁ →&nbsp;ψ = (log(x+1), log(y)+1, sgn·log|z|+1)<br>
    [X₁, X₂] = 0  ✓
  </div>

  <label>ball radius <span id="lblR">0.050</span></label>
  <input id="slR" type="range" min="0.005" max="0.3" step="0.005" value="0.05">

  <div class="row">
    <input id="cbMono" type="checkbox">
    <label for="cbMono" style="display:inline">monochrome</label>
  </div>

  <div class="stats">
    ${kept.toLocaleString()} drawn  /  ${totalRaw.toLocaleString()} raw
  </div>
`;
document.body.appendChild(panel);

const $ = <T extends HTMLElement>(sel: string) => panel.querySelector(sel) as T;
const lblR = $<HTMLSpanElement>('#lblR');
$<HTMLInputElement>('#slR').addEventListener('input', (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  uniforms.uRadius.value = v;
  lblR.textContent = v.toFixed(3);
});
$<HTMLInputElement>('#cbMono').addEventListener('change', (e) => {
  uniforms.uMono.value = (e.target as HTMLInputElement).checked ? 1 : 0;
});

app.start();
