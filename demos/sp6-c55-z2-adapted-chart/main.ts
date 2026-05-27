/**
 * Sp(6,Z) — C-55 Z²-translates rendered in an **adapted chart** built from
 * the two transvection axes [c], [u].
 *
 * The sister demo (../sp6-c55-z2-translates) renders the same Z²-translate
 * orbit but in a standard coordinate chart on RP⁵. The result is structurally
 * compressed: the anisotropy |u|/|c| ≈ 10⁵⁰ pushes most of the lattice points
 * onto a 1-D bundle.
 *
 * Here we build a chart aligned to the two transvection axes themselves:
 *
 *   1.  Adapted basis  {c, u, e_0, e_{i₁}, e_{i₂}, e_{i₃}}  of R⁶, where
 *       {e_{i₁}, e_{i₂}, e_{i₃}} is a 3-element subset of {e_1,…,e_5} that
 *       (together with e_0) completes c, u to a basis. (e_0 is forced into the
 *       completion because c_0 = u_0 = 0.)
 *   2.  Let (α₁, α₂, α₃, α₄, α₅, α₆) be the coordinates of ξ in this basis.
 *       Then  [c]  has  (α₁:α₂)=(1:0)  and  [u]  has  (α₁:α₂)=(0:1).
 *   3.  Chart denominator:  ℓ  =  α₁  +  s · α₂,  where s = |c|∞ / |u|∞ rescales
 *       the u-axis so a unit step in n shifts ℓ comparably to a unit step in m.
 *   4.  Chart numerators:   π₁ = (α₁ − s α₂)/ℓ,   π₂ = α₃/ℓ,   π₃ = α₄/ℓ.
 *
 *   With this chart, [c] ↦ (+1, 0, 0)  and  [u] ↦ (−1, 0, 0). The orbit point
 *
 *      X₁^m X₂^n ξ  =  ξ + m·ξ₀·c + n·p_ξ·u
 *
 *   (closed form from N₁N₂ = 0, valid because [X₁,X₂] = 0) updates only α₁ and
 *   α₂: α₁ → α₁ + m·ξ₀, α₂ → α₂ + n·p_ξ. The other 4 coords are invariant
 *   under the abelian action. The chart is then a single affine formula per
 *   (seed, m, n) — no matrix-vector product, no S⁵ renormalization, no overflow.
 *
 * Geometric content. Each seed ξ produces a 2-D lattice of points in the chart;
 * the lattice lives on a half-plane through (π₂, π₃) ∝ (α₃, α₄) sharing the
 * [c]–[u] segment (the π₁-axis from −1 to +1) as its common edge. Different
 * seeds give different half-planes, fanning out around that segment.
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

function maxAbsBig(m: BigMat | bigint[]): bigint {
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
console.log('  Sp(6,Z) — C-55 abelian translates, adapted chart');
console.log('═══════════════════════════════════════════════════════════════');

console.log('\n┌─ Step 1: polynomials ──────────────────────────────────────');
console.log('  α = (0, 0, 1/8, 3/8, 5/8, 7/8)');
console.log('  β = (1/2, 1/2, 1/12, 5/12, 7/12, 11/12)');

const coefflistf: bigint[] = [1n, -2n, 1n, 0n, 1n, -2n, 1n];
const coefflistg: bigint[] = [1n, 2n, 0n, -2n, 0n, 2n, 1n];

// ─── Step 2: companion matrices A, B and their inverses ───────────────────

const A     = companion(coefflistf);
const B     = companion(coefflistg);
const A_inv = inverseCompanion(coefflistf);
const B_inv = inverseCompanion(coefflistg);

if (!isIdentity(bigMul(A, A_inv))) throw new Error('A · A⁻¹ ≠ I');
if (!isIdentity(bigMul(B, B_inv))) throw new Error('B · B⁻¹ ≠ I');

// ─── Step 3: transvection T = A · B⁻¹ ──────────────────────────────────────

const T = bigMul(A, B_inv);

// ─── Step 4: the word W ────────────────────────────────────────────────────

console.log('\n┌─ Step 4: the word W ───────────────────────────────────────');
const W_STR = 'baaaabaaaabaaaabaaaabaaaabaaaabaaaaaBABaBABAAbaaB';
console.log(`  W = ${W_STR}   (length ${W_STR.length})`);

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
console.log(`  |W|∞ has ${digitsOf(maxAbsBig(W))} digits,  |W⁻¹|∞ has ${digitsOf(maxAbsBig(W_inv))} digits`);
if (!isIdentity(bigMul(W, W_inv))) throw new Error('W · W⁻¹ ≠ I');

// ─── Step 5: X₁ = T,  X₂ = W·T·W⁻¹ ─────────────────────────────────────────

const X1 = T;
const X2 = bigMul(bigMul(W, T), W_inv);

// ─── Step 6: exact commutativity check ─────────────────────────────────────

console.log('\n┌─ Step 6: commutativity check ──────────────────────────────');
const COMM = bigSub(bigMul(X1, X2), bigMul(X2, X1));
const COMMUTE = isZero(COMM);
console.log(`  X₁·X₂ = X₂·X₁ ?   ${COMMUTE ? '✓ YES' : '✗ NO'}`);
if (!COMMUTE) throw new Error('X1 and X2 do not commute');

// ─── Step 7: extract c, u, v from the structural decomposition ────────────
//
//   X₁ = T = I + c·e_0ᵀ ⇒ c is the 0-th column of N₁ = X₁ − I.
//   X₂ = W T W⁻¹ = I + (Wc)·(e_0ᵀ W⁻¹) = I + u·vᵀ ⇒ u is the 0-th column of
//   N₂ = X₂ − I and v is the 0-th ROW of W⁻¹.

console.log('\n┌─ Step 7: extracting c, u, v ───────────────────────────────');
const I_BIG = bigEye();
const N1 = bigSub(X1, I_BIG);
const N2 = bigSub(X2, I_BIG);

const cBig: bigint[] = new Array(6);
const uBig: bigint[] = new Array(6);
for (let i = 0; i < 6; i++) {
  cBig[i] = N1[i * 6 + 0];
  uBig[i] = N2[i * 6 + 0];
}
const vBig: bigint[] = new Array(6);
for (let j = 0; j < 6; j++) vBig[j] = W_inv[0 * 6 + j];

console.log(`  c       = (${cBig.join(', ')})`);
console.log(`  |u|∞ has ${digitsOf(maxAbsBig(uBig))} digits, |v|∞ has ${digitsOf(maxAbsBig(vBig))} digits`);

// Commute-structure sanity: u_0 = 0 and v · c = 0  ⇒  N₁N₂ = N₂N₁ = 0.
if (uBig[0] !== 0n) throw new Error(`u_0 = ${uBig[0]}, expected 0`);
let vDotC = 0n;
for (let i = 0; i < 6; i++) vDotC += vBig[i] * cBig[i];
if (vDotC !== 0n) throw new Error(`v·c = ${vDotC}, expected 0`);
console.log('  u_0 = 0  ✓   v · c = 0  ✓');

// ─── Step 8: choose the adapted basis completion ─────────────────────────
//
//   Pick (j₁, j₂) ∈ {1,…,5}² (j₁ < j₂) maximizing |D| with
//      D = c_{j₁} u_{j₂} − c_{j₂} u_{j₁}
//   so the change-of-basis determinant is well-conditioned. The completion
//   indices are {0} ∪ ({1,…,5} \ {j₁, j₂}).

console.log('\n┌─ Step 8: choose adapted basis ─────────────────────────────');
let bestAbsDet = 0n, bestJ1 = -1, bestJ2 = -1;
for (let j1 = 1; j1 <= 5; j1++) {
  for (let j2 = j1 + 1; j2 <= 5; j2++) {
    const det = cBig[j1] * uBig[j2] - cBig[j2] * uBig[j1];
    const absDet = det < 0n ? -det : det;
    if (absDet > bestAbsDet) { bestAbsDet = absDet; bestJ1 = j1; bestJ2 = j2; }
  }
}
if (bestAbsDet === 0n) throw new Error('No (j₁,j₂) gives D ≠ 0 — c, u proportional?');
const J1 = bestJ1, J2 = bestJ2;
const completionIdx: number[] = [0];
for (let k = 1; k <= 5; k++) if (k !== J1 && k !== J2) completionIdx.push(k);
const [I0, I1Idx, I2Idx, I3Idx] = completionIdx;
console.log(`  (j₁, j₂) = (${J1}, ${J2})   |D| has ${digitsOf(bestAbsDet)} digits`);
console.log(`  completion {e_${I0}, e_${I1Idx}, e_${I2Idx}, e_${I3Idx}}`);

// ─── Step 9: Float64 versions and rebalance scale s ──────────────────────
//
//   Anisotropy: |u|∞ ≈ 10⁵¹ vs |c|∞ ≈ 4. A unit n-step shifts the u-axis
//   |u|/|c| ≈ 10⁵⁰× harder than a unit m-step shifts the c-axis. We rescale
//   the φ² dual functional by s := |c|∞ / |u|∞ so the chart-space step sizes
//   match. Rescaling φ² doesn't move [c] or [u] in the chart — they sit at
//   (±1, 0, 0) regardless.

const c_F = cBig.map(Number);
const u_F = uBig.map(Number);
const v_F = vBig.map(Number);
const D_F = c_F[J1] * u_F[J2] - c_F[J2] * u_F[J1];

const c_inf = Math.max(...c_F.map(Math.abs));
const u_inf = Math.max(...u_F.map(Math.abs));
const S_REBAL = c_inf / u_inf;
console.log(`\n  rebalance s = |c|∞ / |u|∞ ≈ ${S_REBAL.toExponential(3)}`);

const cJ1 = c_F[J1], cJ2 = c_F[J2];
const uJ1 = u_F[J1], uJ2 = u_F[J2];
const cI1 = c_F[I1Idx];
const uI1 = u_F[I1Idx];

// ─── Step 10: BFS seed orbit ──────────────────────────────────────────────

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

console.log('\n┌─ Step 10: proximal basepoint ξ₊(γ) for γ = T·B·T ──────────');
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

console.log(`\n┌─ Step 11: seed orbit O_${K_DEPTH} ──────────────────────────────────`);
const tOrb = performance.now();
const orbit = generateOrbit(K_DEPTH);
console.log(`  ${orbit.count.toLocaleString()} points in ${(performance.now() - tOrb).toFixed(0)} ms`);

// ─── Step 12: per-seed alpha-coords + chart for each (m, n) ──────────────
//
//   For each ξ in the seed orbit, solve the 2×2 system (rows j₁, j₂):
//      α₁ = (u_{j₂} ξ_{j₁} − u_{j₁} ξ_{j₂}) / D
//      α₂ = (c_{j₁} ξ_{j₂} − c_{j₂} ξ_{j₁}) / D
//   and
//      α₃ = ξ_0
//      α₄ = ξ_{I1} − α₁ c_{I1} − α₂ u_{I1}
//   Track ξ_0 and p_ξ = v · ξ. Then for each (m, n):
//      a := α₁ + m·ξ_0,   b := s·(α₂ + n·p_ξ),   ℓ := a + b
//      π = ( (a − b)/ℓ,  α₃/ℓ,  α₄/ℓ ).

const EPS_DENOM = 1e-9;
const numTranslates = (2 * N_GRID + 1) * (2 * N_GRID + 1);
const totalRaw = numTranslates * orbit.count;
console.log(`\n┌─ Step 12: rendering pass ──────────────────────────────────`);
console.log(`  raw count = ${totalRaw.toLocaleString()}  (${numTranslates} grid × ${orbit.count} seeds)`);

const positionsRaw = new Float32Array(totalRaw * 3);
const colorsRaw    = new Float32Array(totalRaw * 3);
let kept = 0;
let filtered = 0;
let deduped = 0;

// Per-(m, n) color: hue = arg(m + in), saturation = r / N_GRID.
const colorsGrid: Array<[number, number, number]> = new Array(numTranslates);
{
  const tmpColor = new THREE.Color();
  let t = 0;
  for (let mm = -N_GRID; mm <= N_GRID; mm++) {
    for (let nn = -N_GRID; nn <= N_GRID; nn++) {
      const r = Math.sqrt(mm * mm + nn * nn);
      if (r === 0) {
        colorsGrid[t] = [0.55, 0.55, 0.55];
      } else {
        const theta = Math.atan2(nn, mm);
        const hue = ((theta / (2 * Math.PI)) + 1) % 1;
        const sat = Math.min(1, r / N_GRID);
        tmpColor.setHSL(hue, sat, 0.55);
        colorsGrid[t] = [tmpColor.r, tmpColor.g, tmpColor.b];
      }
      t++;
    }
  }
}

const seen = new Set<string>();
const DEDUP_DIGITS = 6;

const tApply = performance.now();
for (let si = 0; si < orbit.count; si++) {
  const off = si * 6;
  const x0 = orbit.vecs[off],     x1 = orbit.vecs[off + 1], x2 = orbit.vecs[off + 2];
  const x3 = orbit.vecs[off + 3], x4 = orbit.vecs[off + 4], x5 = orbit.vecs[off + 5];
  const xs: readonly number[] = [x0, x1, x2, x3, x4, x5];

  const xJ1 = xs[J1], xJ2 = xs[J2];

  // Adapted-basis coords.
  const alpha1 = (uJ2 * xJ1 - uJ1 * xJ2) / D_F;
  const alpha2 = (cJ1 * xJ2 - cJ2 * xJ1) / D_F;
  const alpha3 = xs[I0];
  const alpha4 = xs[I1Idx] - alpha1 * cI1 - alpha2 * uI1;

  // Abelian-shift coefficients.
  const xi0 = xs[0];
  let pxi = 0;
  for (let k = 0; k < 6; k++) pxi += v_F[k] * xs[k];

  let t = 0;
  for (let mm = -N_GRID; mm <= N_GRID; mm++) {
    const a = alpha1 + mm * xi0;
    for (let nn = -N_GRID; nn <= N_GRID; nn++) {
      const b = S_REBAL * (alpha2 + nn * pxi);
      const denom = a + b;
      if (Math.abs(denom) < EPS_DENOM) { filtered++; t++; continue; }

      const inv = 1 / denom;
      const p1 = (a - b) * inv;
      const p2 = alpha3 * inv;
      const p3 = alpha4 * inv;

      if (!Number.isFinite(p1) || !Number.isFinite(p2) || !Number.isFinite(p3)) {
        filtered++; t++; continue;
      }

      const key = `${p1.toFixed(DEDUP_DIGITS)} ${p2.toFixed(DEDUP_DIGITS)} ${p3.toFixed(DEDUP_DIGITS)}`;
      if (seen.has(key)) { deduped++; t++; continue; }
      seen.add(key);

      const col = colorsGrid[t];
      positionsRaw[kept * 3]     = p1;
      positionsRaw[kept * 3 + 1] = p2;
      positionsRaw[kept * 3 + 2] = p3;
      colorsRaw[kept * 3]     = col[0];
      colorsRaw[kept * 3 + 1] = col[1];
      colorsRaw[kept * 3 + 2] = col[2];
      kept++;
      t++;
    }
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

// Marker spheres at [c] = (1,0,0) and [u] = (-1,0,0).
const markerSpec: Array<[number, number, number, number, number, number]> = [
  [ 1, 0, 0,  0.85, 0.20, 0.20],   // [c] red
  [-1, 0, 0,  0.20, 0.40, 0.85],   // [u] blue
];
for (const [x, y, z, r, g, b] of markerSpec) {
  const geo = new THREE.SphereGeometry(0.06, 24, 16);
  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b) });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  app.scene.add(m);
}
app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(0.4, 0.8, 0.6);
app.scene.add(dirLight);

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
  #c55a-panel {
    position: fixed; top: 12px; left: 12px;
    background: rgba(20,22,26,0.85); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.4 system-ui, sans-serif;
    user-select: none; z-index: 10;
    width: 300px; backdrop-filter: blur(6px);
  }
  #c55a-panel .title { font-weight: 600; margin-bottom: 4px; }
  #c55a-panel .meta { color: #bbb; font-size: 11px; line-height: 1.35; margin: 4px 0 6px; }
  #c55a-panel label { display: flex; justify-content: space-between; margin-top: 6px; }
  #c55a-panel input[type=range] { width: 100%; margin: 2px 0 4px; }
  #c55a-panel .row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  #c55a-panel .stats { color: #aaa; margin-top: 8px; font-size: 11px; }
  #c55a-panel .swatch { display: inline-block; width: 10px; height: 10px;
    vertical-align: middle; margin-right: 4px; border-radius: 50%; }
`;
document.head.appendChild(css);

const panel = document.createElement('div');
panel.id = 'c55a-panel';
panel.innerHTML = `
  <div class="title">Sp(6,ℤ) — C-55 adapted chart</div>
  <div class="meta">
    seed: O_K with K = ${K_DEPTH} (${orbit.count.toLocaleString()} pts)<br>
    grid: (m, n) ∈ [-${N_GRID}, ${N_GRID}]² of ⟨X₁, X₂⟩<br>
    basis: {c, u, e₀, e<sub>${I1Idx}</sub>, e<sub>${I2Idx}</sub>, e<sub>${I3Idx}</sub>},
      (j₁,j₂)=(${J1},${J2})<br>
    rebalance s = ${S_REBAL.toExponential(2)}<br>
    chart: ( (α₁−sα₂)/ℓ, α₃/ℓ, α₄/ℓ ), ℓ = α₁ + s·α₂<br>
    <span class="swatch" style="background:#d93333"></span>[c] = (+1, 0, 0)
    &nbsp;
    <span class="swatch" style="background:#3366d9"></span>[u] = (−1, 0, 0)
  </div>

  <label>ball radius <span id="lblR">0.025</span></label>
  <input id="slR" type="range" min="0.001" max="0.20" step="0.001" value="0.025">

  <div class="row">
    <input id="cbMono" type="checkbox">
    <label for="cbMono" style="display:inline">monochrome</label>
  </div>

  <div class="stats">
    ${kept.toLocaleString()} drawn (filtered ${filtered.toLocaleString()},
    deduped ${deduped.toLocaleString()})
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
