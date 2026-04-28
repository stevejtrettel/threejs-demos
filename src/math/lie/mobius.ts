/**
 * Möbius action of `SL(2, ℝ)` on the upper half plane `ℍ²`.
 *
 *   g · z = (a z + b) / (c z + d),    g = [[a, b], [c, d]]
 *
 * Preserves `ℍ²` (sends points with `Im z > 0` to points with `Im z > 0`)
 * and acts transitively, with `K = SO(2)` stabilizing `i`. So
 * `ℍ² ≅ SL(2, ℝ) / SO(2)` as a homogeneous space.
 *
 * Points are passed and returned as `[Re, Im]` tuples — lightest possible
 * complex-number representation, no ceremony.
 *
 * ## Boundary
 *
 * The action extends to `∂ℍ² = ℝ ∪ {∞}`. We don't represent `∞` here;
 * callers wanting boundary points should special-case it (or use the
 * `SL(2, ℂ)` Möbius helper once that ships, which handles the Riemann
 * sphere uniformly).
 *
 * ## Cocycle property
 *
 * `(g · h) · z = g · (h · z)`. Verified in smoke tests.
 */

import type { Matrix, ComplexMatrix } from '@/math/linear-algebra';

/** Apply the Möbius action of `g ∈ SL(2, ℝ)` to a point `z ∈ ℂ`. */
export function mobiusSL2R(g: Matrix, z: [number, number]): [number, number] {
  const a = g.data[0], b = g.data[1], c = g.data[2], d = g.data[3];
  const zr = z[0], zi = z[1];

  const numR = a * zr + b;
  const numI = a * zi;
  const denR = c * zr + d;
  const denI = c * zi;
  const den2 = denR * denR + denI * denI;

  return [
    (numR * denR + numI * denI) / den2,
    (numI * denR - numR * denI) / den2,
  ];
}

/**
 * Möbius action of `g ∈ SU(1, 1)` on the Poincaré disk. With
 * `g = [[α, β], [β̄, ᾱ]]` (stored as `(Re α, Im α, Re β, Im β)`):
 *
 *   `g · z = (α z + β) / (β̄ z + ᾱ)`
 *
 * preserves `|z| < 1` and acts isometrically on the hyperbolic metric.
 */
export function mobiusSU11(g: Matrix, z: [number, number]): [number, number] {
  const ar = g.data[0], ai = g.data[1], br = g.data[2], bi = g.data[3];
  const zr = z[0], zi = z[1];

  // num = α · z + β = (ar + ai·i)(zr + zi·i) + (br + bi·i)
  const numR = ar * zr - ai * zi + br;
  const numI = ar * zi + ai * zr + bi;

  // den = β̄ · z + ᾱ = (br − bi·i)(zr + zi·i) + (ar − ai·i)
  const denR = br * zr + bi * zi + ar;
  const denI = br * zi - bi * zr - ai;

  const denMag2 = denR * denR + denI * denI;
  return [
    (numR * denR + numI * denI) / denMag2,
    (numI * denR - numR * denI) / denMag2,
  ];
}

/**
 * Möbius action of `g ∈ SL(2, ℂ)` on the Riemann sphere. Acts on the
 * complex plane as `g · z = (a z + b) / (c z + d)`; the point `z = ∞`
 * isn't represented here — caller-side concern. (Effectively `g · ∞ = a/c`
 * for `c ≠ 0`, and `g · ∞ = ∞` for `c = 0`.)
 */
export function mobiusSL2C(g: ComplexMatrix, z: [number, number]): [number, number] {
  const [ar, ai] = g.get(0, 0);
  const [br, bi] = g.get(0, 1);
  const [cr, ci] = g.get(1, 0);
  const [dr, di] = g.get(1, 1);

  const zr = z[0], zi = z[1];

  // num = a · z + b
  const numR = ar * zr - ai * zi + br;
  const numI = ar * zi + ai * zr + bi;

  // den = c · z + d
  const denR = cr * zr - ci * zi + dr;
  const denI = cr * zi + ci * zr + di;

  const denMag2 = denR * denR + denI * denI;
  return [
    (numR * denR + numI * denI) / denMag2,
    (numI * denR - numR * denI) / denMag2,
  ];
}
