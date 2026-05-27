/**
 * Group action on R⁶, proximal basepoint, non-backtracking BFS.
 *
 * Generator codes:  0 = A,  1 = A⁻¹,  2 = B,  3 = B⁻¹.
 *
 * A is the companion matrix of f; B is the companion matrix of g.
 * Both follow the same shift-with-last-column pattern, just with
 * coefficients from f and g respectively.
 */

import { type ExampleGroup } from './examples';

// Inverse generator codes (0 ↔ 1, 2 ↔ 3).
export const INV = new Uint8Array([1, 0, 3, 2]);

export interface GroupAction {
  applyGen: (
    g: number,
    src: Float64Array, srcOff: number,
    dst: Float64Array, dstOff: number,
  ) => void;
  applyGamma: (buf: Float64Array) => void;
}

export interface Orbit {
  vecs: Float64Array;     // 6 · count, renormalized to S⁵
  lastGen: Uint8Array;    // count, last generator applied (255 = basepoint)
  parents: Uint32Array;   // count, index of BFS parent (basepoint stores 0)
  count: number;
}

export function totalNodes(N: number): number {
  return 1 + 2 * (Math.pow(3, N) - 1);
}

function normalize6InPlace(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 6; i++) buf[off + i] *= inv;
}

/**
 * Builds applyGen and applyGamma closing over an example's coefficient
 * arrays and γ word. Keeping these in the closure (rather than passing
 * them in on every call) lets V8 inline them efficiently in the BFS hot
 * loop.
 */
export function makeGroupAction(ex: ExampleGroup): GroupAction {
  // f and g are length-7 palindromic. We only need the middle five
  // coefficients to apply A and B via their companion shift+last-column form.
  const F_C = ex.coefflistf.slice(1, 6); // [f_1, f_2, f_3, f_4, f_5]
  const B_C = ex.coefflistg.slice(1, 6); // [g_1, g_2, g_3, g_4, g_5]
  const gamma = ex.gamma;
  const gammaLen = gamma.length;

  // Pull out for the hot path.
  const f1 = F_C[0], f2 = F_C[1], f3 = F_C[2], f4 = F_C[3], f5 = F_C[4];
  const g1 = B_C[0], g2 = B_C[1], g3 = B_C[2], g4 = B_C[3], g5 = B_C[4];

  function applyGen(
    gen: number,
    src: Float64Array, srcOff: number,
    dst: Float64Array, dstOff: number,
  ): void {
    const a = src[srcOff], b = src[srcOff + 1], c = src[srcOff + 2];
    const d = src[srcOff + 3], e = src[srcOff + 4], f = src[srcOff + 5];

    switch (gen) {
      case 0: // A = companion of f
        dst[dstOff]     = -f;
        dst[dstOff + 1] =  a - f1 * f;
        dst[dstOff + 2] =  b - f2 * f;
        dst[dstOff + 3] =  c - f3 * f;
        dst[dstOff + 4] =  d - f4 * f;
        dst[dstOff + 5] =  e - f5 * f;
        return;
      case 1: // A⁻¹
        dst[dstOff]     =  b - f1 * a;
        dst[dstOff + 1] =  c - f2 * a;
        dst[dstOff + 2] =  d - f3 * a;
        dst[dstOff + 3] =  e - f4 * a;
        dst[dstOff + 4] =  f - f5 * a;
        dst[dstOff + 5] = -a;
        return;
      case 2: // B = companion of g
        dst[dstOff]     = -f;
        dst[dstOff + 1] =  a - g1 * f;
        dst[dstOff + 2] =  b - g2 * f;
        dst[dstOff + 3] =  c - g3 * f;
        dst[dstOff + 4] =  d - g4 * f;
        dst[dstOff + 5] =  e - g5 * f;
        return;
      case 3: // B⁻¹
        dst[dstOff]     =  b - g1 * a;
        dst[dstOff + 1] =  c - g2 * a;
        dst[dstOff + 2] =  d - g3 * a;
        dst[dstOff + 3] =  e - g4 * a;
        dst[dstOff + 4] =  f - g5 * a;
        dst[dstOff + 5] = -a;
        return;
    }
  }

  function applyGamma(buf: Float64Array): void {
    for (let i = 0; i < gammaLen; i++) {
      applyGen(gamma[i], buf, 0, buf, 0);
    }
  }

  return { applyGen, applyGamma };
}

/**
 * Power-iterate γ to find ξ₊(γ) ∈ Λ. Also returns the convergence diagnostics
 * |λ_max(γ)| and the post-step drift (drift ≈ 0 ⇒ λ > 0, drift ≈ 2 ⇒ λ < 0;
 * anything else ⇒ γ is not loxodromic and a different word is needed).
 */
export function computeProximalBasepoint(
  ex: ExampleGroup,
  action: GroupAction,
): { basepoint: Float64Array; lambdaMax: number; drift: number } {
  const v = new Float64Array(6);
  v[0] = 1.0;  v[1] = 0.7;  v[2] = -0.3;
  v[3] = 0.1;  v[4] = -0.5; v[5] = 0.2;
  normalize6InPlace(v, 0);

  for (let k = 0; k < ex.powerIter; k++) {
    action.applyGamma(v);
    normalize6InPlace(v, 0);
  }

  const tmp = new Float64Array(v);
  action.applyGamma(tmp);
  let lam2 = 0;
  for (let i = 0; i < 6; i++) lam2 += tmp[i] * tmp[i];
  const lambdaMax = Math.sqrt(lam2);

  const tmp2 = new Float64Array(tmp);
  normalize6InPlace(tmp2, 0);
  let drift = 0;
  for (let i = 0; i < 6; i++) {
    const d = tmp2[i] - v[i];
    drift += d * d;
  }

  return { basepoint: v, lambdaMax, drift: Math.sqrt(drift) };
}

/**
 * Non-backtracking BFS from the basepoint up to depth N in {A,A⁻¹,B,B⁻¹}.
 * After every matrix-vector product, the new 6-vector is renormalized to S⁵
 * to keep Float64 stable.
 */
export function generateOrbit(
  action: GroupAction,
  basepoint: Float64Array,
  N: number,
): Orbit {
  const total = totalNodes(N);
  const vecs = new Float64Array(total * 6);
  const lastGen = new Uint8Array(total);
  const parents = new Uint32Array(total);

  for (let i = 0; i < 6; i++) vecs[i] = basepoint[i];
  lastGen[0] = 255;
  parents[0] = 0; // basepoint is its own "parent" (never read; we stop at lastGen==255)

  let parentStart = 0;
  let parentEnd = 1;
  let writeIdx = 1;

  for (let d = 1; d <= N; d++) {
    for (let p = parentStart; p < parentEnd; p++) {
      const pLast = lastGen[p];
      const pOff = p * 6;
      for (let g = 0; g < 4; g++) {
        if (pLast < 4 && g === INV[pLast]) continue;
        const wOff = writeIdx * 6;
        action.applyGen(g, vecs, pOff, vecs, wOff);
        normalize6InPlace(vecs, wOff);
        lastGen[writeIdx] = g;
        parents[writeIdx] = p;
        writeIdx++;
      }
    }
    parentStart = parentEnd;
    parentEnd = writeIdx;
  }

  return { vecs, lastGen, parents, count: writeIdx };
}
