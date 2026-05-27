import type { Complex } from '../algebraic-curves/complex';

/**
 * Gauge-invariant phase ratio arg(a/b) ∈ [0, 1).
 *
 * Useful for coloring points in CP^2 by an angle the moment map throws away:
 * arg(p_k / p_j) is invariant under the diagonal U(1)^3 that the moment map
 * quotients out, so it's a genuine "extra coordinate" beyond the (|X|², |Y|²,
 * |Z|²) image.
 */
export function phase01(a: Complex, b: Complex): number {
  const re = a.re * b.re + a.im * b.im;
  const im = a.im * b.re - a.re * b.im;
  const t = Math.atan2(im, re) / (2 * Math.PI) + 0.5;
  return t - Math.floor(t);
}

/**
 * Cyclic hue → RGB via three phase-shifted cosines centered at 0.5. h ∈ [0, 1].
 *
 * Cheaper than HSL→RGB and produces smoother gradients with no saturation
 * discontinuities at hue boundaries. Writes into out[off..off+2].
 */
export function hueToRgb(h: number, out: Float32Array, off: number): void {
  const t = h * 2 * Math.PI;
  out[off] = 0.5 + 0.5 * Math.cos(t);
  out[off + 1] = 0.5 + 0.5 * Math.cos(t - (2 * Math.PI) / 3);
  out[off + 2] = 0.5 + 0.5 * Math.cos(t - (4 * Math.PI) / 3);
}
