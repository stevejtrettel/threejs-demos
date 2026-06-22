/**
 * Isometric embedding of CP^{k-1} into R^{k²} via rank-1 Hermitian projectors.
 *
 * A point [v] ∈ CP^{k-1} (a unit vector v ∈ C^k up to phase) maps to the
 * rank-1 Hermitian projector P = v v† ∈ Herm(k). This is injective (distinct
 * CP points give distinct projectors, since the overall phase drops out of
 * v v†), and isometric for the Fubini–Study metric (up to a constant).
 *
 * To store P as a real vector in R^{k²} we flatten:
 *
 *   [ P_{00}, P_{11}, ..., P_{k-1,k-1},          ← k diagonal reals
 *     √2 Re P_{01}, √2 Re P_{02}, ...,            ← k(k-1)/2 upper-tri Re
 *     √2 Im P_{01}, √2 Im P_{02}, ... ]            ← k(k-1)/2 upper-tri Im
 *
 * The √2 on off-diagonal terms ensures ‖flat(P)‖² = tr(P P†) = tr(P) = 1
 * for any unit-norm v — the Euclidean norm in R^{k²} equals the Frobenius
 * norm of P, which equals 1 because P is a rank-1 projector of trace 1.
 *
 * Combined with the Veronese map ν_d: CP² → CP^N, this gives a faithful
 * embedding of CP² into R^{(N+1)²} — no quotient, no chart singularities,
 * no blow-ups.
 */

import type { Complex } from '../algebraic-curves/complex';

/**
 * Dimension of the projector embedding output for a k-dim complex vector.
 * Always k².
 */
export function projectorDim(k: number): number {
  return k * k;
}

/**
 * Embed a unit-norm complex vector v ∈ C^k as the flattened rank-1 Hermitian
 * projector P = v v†, writing k² real values into `out` starting at `off`.
 *
 * The caller is responsible for ensuring v is unit-norm (|v|² = 1). If not,
 * the output scales as |v|⁴ (since P = v v† has entries proportional to
 * |v|²), breaking the isometry. Use `projectorEmbeddingNormalized` for
 * auto-normalization.
 */
export function projectorEmbedding(
  v: Complex[],
  out: Float64Array,
  off: number,
): void {
  const k = v.length;
  const S = Math.SQRT2;
  let idx = off;

  // Diagonal: P_{ii} = |v_i|²
  for (let i = 0; i < k; i++) {
    out[idx++] = v[i].re * v[i].re + v[i].im * v[i].im;
  }

  // Upper-triangular real parts: √2 Re(v_i conj(v_j)) for i < j
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      out[idx++] = S * (v[i].re * v[j].re + v[i].im * v[j].im);
    }
  }

  // Upper-triangular imaginary parts: √2 Im(v_i conj(v_j)) for i < j
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      out[idx++] = S * (v[i].im * v[j].re - v[i].re * v[j].im);
    }
  }
}

/**
 * Same as `projectorEmbedding` but normalizes v to unit length first.
 */
export function projectorEmbeddingNormalized(
  v: Complex[],
  out: Float64Array,
  off: number,
): void {
  let norm2 = 0;
  for (let i = 0; i < v.length; i++) {
    norm2 += v[i].re * v[i].re + v[i].im * v[i].im;
  }
  if (norm2 === 0) {
    for (let i = 0; i < v.length * v.length; i++) out[off + i] = 0;
    return;
  }
  const inv = 1 / Math.sqrt(norm2);
  const normalized: Complex[] = v.map((z) => ({
    re: z.re * inv,
    im: z.im * inv,
  }));
  projectorEmbedding(normalized, out, off);
}
