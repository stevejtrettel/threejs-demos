/**
 * Sp(6,Z) — C-55: Z²-translates of a BFS seed orbit
 *
 * Full pipeline in one demo. The setup phase (in console) walks through:
 *   1.  Polynomials f, g from the hypergeometric data (α, β) of C-55.
 *   2.  Companion matrices A, B and their (closed-form) inverses.
 *   3.  Transvection T = A·B⁻¹.
 *   4.  Word W (49 letters) and W⁻¹.
 *   5.  X₁ = T, X₂ = W·T·W⁻¹.
 *   6.  Exact commutativity check: [X₁, X₂] = 0 ?   (BigInt — entrywise.)
 *
 * If the commute check fails, we throw — the abelian-translate construction
 * is only well-defined when ⟨X₁, X₂⟩ is abelian.
 *
 * Then the visualization:
 *   7.  Nilpotent perturbations N_i = X_i − I (each square-zero) and N₁N₂.
 *       Closed-form powers:  X₁^m X₂^n = I + mN₁ + nN₂ + mn·N₁N₂.
 *   8.  Assemble each M_{m,n} (BigInt), rescale by max|entry| → M' ∈ [-1,1]
 *       as a Float64 matrix; same projective action on RP⁵, float-safe.
 *   9.  BFS seed orbit O_K of length-≤K words in {B, B⁻¹, T, T⁻¹} on ξ₊(γ=TBT).
 *  10.  For each (ξ, m, n): compute M'_{m,n} ξ in Float64, normalize, project
 *       to R³ via the chart π(v) = (v₂, v₃, v₄)/v₁, dedup, render as a colored
 *       sphere (hue from arg(m+in), saturation from r/N).
 *
 * Note on what you'll actually see: the dominant rank-1 attractor of the
 * abelian dynamics (direction span(u + m u₀ c) for n ≠ 0) crushes the
 * sub-leading contributions below Float64 precision. So the visible picture
 * is a 1-D layered bundle parametrized by m and the BFS index, not a clean
 * 2-D lattice. The 2-D Z² structure is mathematically present but compressed
 * by |W|² ≈ 10¹¹² in projective metric; see README.md for the longer story.
 */

import * as THREE from 'three';
import { App } from '@/app/App';

// ─── Editable parameters ────────────────────────────────────────────────────

const K_DEPTH = 7;     // BFS depth of the seed orbit (|O_K| = 1 + 2(3^K - 1))
const N_GRID  = 10;    // grid half-width: translates indexed in [-N, N]² ⇒ (2N+1)² of them

// ─── BigInt 6×6 matrix utilities ────────────────────────────────────────────

type BigMat = bigint[]; // length 36, row-major

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

// ─── Step 1: polynomials (C-55) ────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Sp(6,Z) — C-55 abelian translates');
console.log('═══════════════════════════════════════════════════════════════');

console.log('\n┌─ Step 1: polynomials ──────────────────────────────────────');
console.log('  α = (0, 0, 1/8, 3/8, 5/8, 7/8)');
console.log('  β = (1/2, 1/2, 1/12, 5/12, 7/12, 11/12)');
console.log('  f(x) = (x-1)²(x⁴+1)         = 1 - 2x + x² + x⁴ - 2x⁵ + x⁶');
console.log('  g(x) = (x+1)²(x⁴-x²+1)      = 1 + 2x - 2x³ + 2x⁵ + x⁶');

const coefflistf: bigint[] = [1n, -2n, 1n, 0n, 1n, -2n, 1n];
const coefflistg: bigint[] = [1n, 2n, 0n, -2n, 0n, 2n, 1n];

console.log('  coefflistf =', JSON.stringify(coefflistf.map(String)));
console.log('  coefflistg =', JSON.stringify(coefflistg.map(String)));

// ─── Step 2: companion matrices A, B and their inverses ───────────────────

console.log('\n┌─ Step 2: companion matrices ───────────────────────────────');
const A     = companion(coefflistf);
const B     = companion(coefflistg);
const A_inv = inverseCompanion(coefflistf);
const B_inv = inverseCompanion(coefflistg);

console.log('  A = companion(f):');
console.log(formatMat(A));
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

// ─── Step 4: the word W ────────────────────────────────────────────────────

console.log('\n┌─ Step 4: the word W ───────────────────────────────────────');
const W_STR = 'baaaabaaaabaaaabaaaabaaaabaaaabaaaaaBABaBABAAbaaB';
console.log(`  W = ${W_STR}`);
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
console.log(`  W⁻¹ = ${W_INV_STR}`);

const wOk = isIdentity(bigMul(W, W_inv));
console.log(`  W · W⁻¹ = I?   ${wOk ? '✓ yes' : '✗ FAIL'}`);
if (!wOk) throw new Error('W · W^{-1} ≠ I');

console.log(`  W has integer entries up to ${digitsOf(maxAbsBig(W))} digits`);
console.log('  W =');
console.log(formatMat(W));

// ─── Step 5: X₁ = T,  X₂ = W·T·W⁻¹ ─────────────────────────────────────────

console.log('\n┌─ Step 5: X₁ = T,  X₂ = W·T·W⁻¹ ────────────────────────────');
const X1 = T;
const X2 = bigMul(bigMul(W, T), W_inv);
console.log(`  X₁ entries up to ${digitsOf(maxAbsBig(X1))} digits`);
console.log('  X₁ =');
console.log(formatMat(X1));
console.log(`  X₂ entries up to ${digitsOf(maxAbsBig(X2))} digits`);
console.log('  X₂ =');
console.log(formatMat(X2));

// ─── Step 6: exact commutativity check ─────────────────────────────────────

console.log('\n┌─ Step 6: commutativity check ──────────────────────────────');
const X1X2 = bigMul(X1, X2);
const X2X1 = bigMul(X2, X1);
const COMM = bigSub(X1X2, X2X1);
const COMMUTE = isZero(COMM);

console.log('  X₁ · X₂ =');
console.log(formatMat(X1X2));
console.log('  X₂ · X₁ =');
console.log(formatMat(X2X1));
console.log('  [X₁, X₂] = X₁X₂ − X₂X₁ =');
console.log(formatMat(COMM));

console.log(
  `\n  X₁·X₂ = X₂·X₁ ?   ` +
  (COMMUTE ? '✓ YES — X₁ and X₂ COMMUTE' : '✗ NO — X₁ and X₂ DO NOT commute'),
);
if (!COMMUTE) {
  console.error(
    `  max |[X₁,X₂]| = ${maxAbsBig(COMM).toString()}  (digits: ${digitsOf(maxAbsBig(COMM))})\n` +
    `  Aborting: cannot use the abelian-translate construction without commutativity.`,
  );
  throw new Error('X1 and X2 do not commute');
}

// Stash for inspection.
(window as unknown as { debug: Record<string, BigMat> }).debug = {
  A, B, A_inv, B_inv, T, W, W_inv, X1, X2, COMM,
};

// ─── Step 7: nilpotents N_i and N₁N₂ ───────────────────────────────────────

console.log('\n┌─ Step 7: nilpotent parts ──────────────────────────────────');
const I_BIG = bigEye();
const N1  = bigSub(X1, I_BIG);
const N2  = bigSub(X2, I_BIG);
const N12 = bigMul(N1, N2);
const N1max = maxAbsBig(N1);
const N2max = maxAbsBig(N2);
console.log(`  digits(max|N₁|)   = ${digitsOf(N1max)}`);
console.log(`  digits(max|N₂|)   = ${digitsOf(N2max)}`);
console.log(`  digits(max|N₁N₂|) = ${digitsOf(maxAbsBig(N12))}`);

// ─── Rebalance: replace X₁ with Y := X₁^K so that |Y - I| ≈ |X₂ - I| ──────
//
// X₁ - I has small integer entries (max ≈ 4 for c55); X₂ - I has ~10^303-
// digit entries (X₂ = WTW⁻¹ with W having 50-digit entries, W⁻¹ having ~250
// digit). The huge asymmetry crushes any X₁-direction motion in the chart
// projection: every n ≠ 0 translate is dominated by X₂'s contribution by a
// factor of ~10^302, so the lattice's m-direction is invisible.
//
// Workaround: take Y := X₁^K where K = ⌊|N₂|_max / |N₁|_max⌋. Then K·N₁ has
// entries comparable to N₂, and the sub-Z² = ⟨Y, X₂⟩ samples every K-th X₁
// step. In chart space, the m and n steps are now of comparable size and the
// 2-D lattice structure becomes visible.

const K_BIG = N1max === 0n ? 1n : N2max / N1max;
console.log(`\n  rebalance factor K = ⌊|N₂|_max / |N₁|_max⌋ = ${digitsOf(K_BIG)}-digit BigInt`);
console.log(`    (so K·|N₁| ≈ |N₂|; the sub-Z² we sample is ⟨X₁^K, X₂⟩)`);

// ─── Step 8: assemble Float64 translate matrices ──────────────────────────

const gridSize = 2 * N_GRID + 1;
const numTranslates = gridSize * gridSize;

// M'_{m,n} = M_{m,n} / max|entry(M_{m,n})|  ∈  [-1, 1]^{6×6}.
// Same projective action as the integer M_{m,n} but float-safe.
//
// Note: m is scaled by K_BIG (the rebalance factor) before assembling M.
// So we're really building M_{mK, n} = Y^m · X₂^n where Y = X₁^K. N₁N₂ = 0
// (from commutativity) so the mn cross-term contributes nothing.
function buildMPrime(m: number, n: number): Float64Array {
  const mB = BigInt(m) * K_BIG;
  const nB = BigInt(n);
  const mnB = mB * nB;  // still 0 contribution since N12 = 0
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

console.log(`\n┌─ Step 8: assembling ${numTranslates} translate matrices (N = ${N_GRID}) ──`);
const tGrid = performance.now();
const allM: Float64Array[] = new Array(numTranslates);
const allColors: Array<[number, number, number]> = new Array(numTranslates);
{
  const tmpColor = new THREE.Color();
  let t = 0;
  for (let mm = -N_GRID; mm <= N_GRID; mm++) {
    for (let nn = -N_GRID; nn <= N_GRID; nn++) {
      allM[t] = buildMPrime(mm, nn);
      const r = Math.sqrt(mm * mm + nn * nn);
      if (r === 0) {
        allColors[t] = [0.55, 0.55, 0.55];
      } else {
        const theta = Math.atan2(nn, mm);
        const hue = ((theta / (2 * Math.PI)) + 1) % 1;
        const sat = Math.min(1, r / N_GRID);
        tmpColor.setHSL(hue, sat, 0.55);
        allColors[t] = [tmpColor.r, tmpColor.g, tmpColor.b];
      }
      t++;
    }
  }
}
console.log(`  built in ${(performance.now() - tGrid).toFixed(0)} ms`);

// ─── Step 9: Float64 generators for the BFS seed orbit ────────────────────

const INV = new Uint8Array([1, 0, 3, 2]);
const T_COL_F: readonly number[] = [1, -4, 1, 2, 1, -4];
const B_C_F: readonly number[]   = [2, 0, -2, 0, 2];

function applyGen(
  g: number,
  src: Float64Array, srcOff: number,
  dst: Float64Array, dstOff: number,
): void {
  const a = src[srcOff],     b = src[srcOff + 1], c = src[srcOff + 2];
  const d = src[srcOff + 3], e = src[srcOff + 4], f = src[srcOff + 5];
  switch (g) {
    case 0:
      dst[dstOff]     = -f;
      dst[dstOff + 1] =  a - B_C_F[0] * f;
      dst[dstOff + 2] =  b - B_C_F[1] * f;
      dst[dstOff + 3] =  c - B_C_F[2] * f;
      dst[dstOff + 4] =  d - B_C_F[3] * f;
      dst[dstOff + 5] =  e - B_C_F[4] * f;
      return;
    case 1:
      dst[dstOff]     =  b - B_C_F[0] * a;
      dst[dstOff + 1] =  c - B_C_F[1] * a;
      dst[dstOff + 2] =  d - B_C_F[2] * a;
      dst[dstOff + 3] =  e - B_C_F[3] * a;
      dst[dstOff + 4] =  f - B_C_F[4] * a;
      dst[dstOff + 5] = -a;
      return;
    case 2:
      dst[dstOff]     = a;
      dst[dstOff + 1] = b + T_COL_F[1] * a;
      dst[dstOff + 2] = c + T_COL_F[2] * a;
      dst[dstOff + 3] = d + T_COL_F[3] * a;
      dst[dstOff + 4] = e + T_COL_F[4] * a;
      dst[dstOff + 5] = f + T_COL_F[5] * a;
      return;
    case 3:
      dst[dstOff]     = a;
      dst[dstOff + 1] = b - T_COL_F[1] * a;
      dst[dstOff + 2] = c - T_COL_F[2] * a;
      dst[dstOff + 3] = d - T_COL_F[3] * a;
      dst[dstOff + 4] = e - T_COL_F[4] * a;
      dst[dstOff + 5] = f - T_COL_F[5] * a;
      return;
  }
}

function normalize6InPlace(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 6; i++) buf[off + i] *= inv;
}

function applyGamma(buf: Float64Array): void {
  applyGen(2, buf, 0, buf, 0);
  applyGen(0, buf, 0, buf, 0);
  applyGen(2, buf, 0, buf, 0);
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
  console.log(`  |λ_max(γ)| ≈ ${Math.sqrt(s).toFixed(3)}  (expect ≈ 5.571)`);
}

// ─── Step 10: BFS for the seed orbit O_K ──────────────────────────────────

function totalNodes(N: number): number {
  return 1 + 2 * (Math.pow(3, N) - 1);
}

interface Orbit {
  vecs: Float64Array;
  count: number;
}

function generateOrbit(N: number): Orbit {
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
        normalize6InPlace(vecs, wOff);
        lastGen[w] = g;
        w++;
      }
    }
    pStart = pEnd;
    pEnd = w;
  }
  return { vecs, count: w };
}

console.log(`\n┌─ Step 10: seed orbit O_${K_DEPTH} ──────────────────────────────────`);
const tOrb = performance.now();
const orbit = generateOrbit(K_DEPTH);
console.log(`  ${orbit.count.toLocaleString()} points, BFS in ${(performance.now() - tOrb).toFixed(0)} ms`);

// ─── Step 11: apply each translate to each seed-orbit point ───────────────

const EPS_V0 = 1e-3;
const totalRaw = numTranslates * orbit.count;
console.log(`\n┌─ Step 11: rendering pass ──────────────────────────────────`);
console.log(`  raw count = ${totalRaw.toLocaleString()}  (${numTranslates} translates × ${orbit.count} seed pts)`);

const positionsRaw = new Float32Array(totalRaw * 3);
const colorsRaw    = new Float32Array(totalRaw * 3);
let kept = 0;
let filtered = 0;
let deduped = 0;

// Dedup by quantized projected position. The rank-1 dynamics at deep (m, n)
// makes most translates collapse to a small set of distinct points, with the
// rest of the instances stacking on top — without dedup the GPU draws all of
// them and the camera autofit gets dominated by the densest stack.
const seen = new Set<string>();
const DEDUP_DIGITS = 6;

const tmp = new Float64Array(6);
const tApply = performance.now();
for (let t = 0; t < numTranslates; t++) {
  const M = allM[t];
  const col = allColors[t];
  for (let i = 0; i < orbit.count; i++) {
    const off = i * 6;
    const x0 = orbit.vecs[off],     x1 = orbit.vecs[off + 1], x2 = orbit.vecs[off + 2];
    const x3 = orbit.vecs[off + 3], x4 = orbit.vecs[off + 4], x5 = orbit.vecs[off + 5];
    tmp[0] = M[ 0]*x0 + M[ 1]*x1 + M[ 2]*x2 + M[ 3]*x3 + M[ 4]*x4 + M[ 5]*x5;
    tmp[1] = M[ 6]*x0 + M[ 7]*x1 + M[ 8]*x2 + M[ 9]*x3 + M[10]*x4 + M[11]*x5;
    tmp[2] = M[12]*x0 + M[13]*x1 + M[14]*x2 + M[15]*x3 + M[16]*x4 + M[17]*x5;
    tmp[3] = M[18]*x0 + M[19]*x1 + M[20]*x2 + M[21]*x3 + M[22]*x4 + M[23]*x5;
    tmp[4] = M[24]*x0 + M[25]*x1 + M[26]*x2 + M[27]*x3 + M[28]*x4 + M[29]*x5;
    tmp[5] = M[30]*x0 + M[31]*x1 + M[32]*x2 + M[33]*x3 + M[34]*x4 + M[35]*x5;

    normalize6InPlace(tmp, 0);

    // Affine chart on RP⁵ with denominator v[1] (= v_2 in 1-indexed).
    // We *cannot* use v[0] here: commutativity [X₁, X₂] = 0 forces
    // c[0] = 0 and u[0] = 0, so the result vector has v[0] coming only from
    // the tiny ξ contribution (which underflows below the rescaled M's max).
    // Switching to v[1] sidesteps this — c[1] = -4 ≠ 0 means v[1] gets the
    // dominant N₁ and N₂ contributions and stays O(1) after normalization.
    // We project to (v_1, v_3, v_4)/v_2 = (tmp[0], tmp[2], tmp[3])/tmp[1].
    if (Math.abs(tmp[1]) < EPS_V0) { filtered++; continue; }

    const inv = 1 / tmp[1];
    const px = tmp[0] * inv;
    const py = tmp[2] * inv;
    const pz = tmp[3] * inv;

    const key = `${px.toFixed(DEDUP_DIGITS)} ${py.toFixed(DEDUP_DIGITS)} ${pz.toFixed(DEDUP_DIGITS)}`;
    if (seen.has(key)) { deduped++; continue; }
    seen.add(key);

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
  `  ${kept.toLocaleString()} kept (filtered ${filtered.toLocaleString()}, ` +
  `deduped ${deduped.toLocaleString()})  in ${(performance.now() - tApply).toFixed(0)} ms`,
);

const positions = positionsRaw.slice(0, kept * 3);
const colors = colorsRaw.slice(0, kept * 3);

// ─── Render ────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  uniform float uRadius;
  uniform float uMono;
  attribute vec3 aPos;
  attribute vec3 aColor;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vec3 worldPos = aPos + position * uRadius;
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
  uRadius: { value: 0.025 },
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

// ─── Camera autofit (15th–85th percentile per axis) ───────────────────────

function percentile(arr: Float32Array, p: number): number {
  const s = arr.slice();
  s.sort();
  return s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))];
}

if (kept > 0) {
  const xs = new Float32Array(kept), ys = new Float32Array(kept), zs = new Float32Array(kept);
  for (let i = 0; i < kept; i++) {
    xs[i] = positions[i * 3];
    ys[i] = positions[i * 3 + 1];
    zs[i] = positions[i * 3 + 2];
  }
  const xLo = percentile(xs, 0.15), xHi = percentile(xs, 0.85);
  const yLo = percentile(ys, 0.15), yHi = percentile(ys, 0.85);
  const zLo = percentile(zs, 0.15), zHi = percentile(zs, 0.85);
  const center = new THREE.Vector3(
    (xLo + xHi) * 0.5, (yLo + yHi) * 0.5, (zLo + zHi) * 0.5,
  );
  const hx = (xHi - xLo) * 0.5, hy = (yHi - yLo) * 0.5, hz = (zHi - zLo) * 0.5;
  const r = Math.max(0.5, Math.sqrt(hx * hx + hy * hy + hz * hz));
  const cam = app.camera as THREE.PerspectiveCamera;
  const halfFov = (cam.fov * Math.PI / 180) * 0.5;
  const dist = 2 * r / Math.tan(halfFov);
  console.log(
    `  autofit: center=(${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)})` +
    `  r=${r.toFixed(2)}  dist=${dist.toFixed(2)}`,
  );
  const dir = new THREE.Vector3(0.4, 0.4, 1).normalize();
  app.controls.target.copy(center);
  app.camera.position.copy(center).addScaledVector(dir, dist);
  app.controls.update();
}

// ─── HUD ───────────────────────────────────────────────────────────────────

const css = document.createElement('style');
css.textContent = `
  #c55t-panel {
    position: fixed; top: 12px; left: 12px;
    background: rgba(20,22,26,0.85); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.4 system-ui, sans-serif;
    user-select: none; z-index: 10;
    width: 280px; backdrop-filter: blur(6px);
  }
  #c55t-panel .title { font-weight: 600; margin-bottom: 4px; }
  #c55t-panel .meta { color: #bbb; font-size: 11px; line-height: 1.35; margin: 4px 0 6px; }
  #c55t-panel label { display: flex; justify-content: space-between; margin-top: 6px; }
  #c55t-panel input[type=range] { width: 100%; margin: 2px 0 4px; }
  #c55t-panel .row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  #c55t-panel .stats { color: #aaa; margin-top: 8px; font-size: 11px; }
`;
document.head.appendChild(css);

const panel = document.createElement('div');
panel.id = 'c55t-panel';
panel.innerHTML = `
  <div class="title">Sp(6,ℤ) — C-55 Z²-translates (rebalanced)</div>
  <div class="meta">
    seed: O_K with K = ${K_DEPTH} (${orbit.count.toLocaleString()} pts)<br>
    grid: (m, n) ∈ [-${N_GRID}, ${N_GRID}]² of ⟨X₁^K, X₂⟩<br>
    rebalance K = ${digitsOf(K_BIG)}-digit BigInt<br>
    chart: (v₁, v₃, v₄) / v₂<br>
    [X₁, X₂] = 0  ✓
  </div>

  <label>ball radius <span id="lblR">0.025</span></label>
  <input id="slR" type="range" min="0.001" max="0.20" step="0.001" value="0.025">

  <div class="row">
    <input id="cbMono" type="checkbox">
    <label for="cbMono" style="display:inline">monochrome</label>
  </div>

  <div class="stats">
    ${kept.toLocaleString()} drawn (filtered ${filtered.toLocaleString()}, deduped ${deduped.toLocaleString()})
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
