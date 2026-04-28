/**
 * Iwasawa decomposition for `SL(2, ℝ)`: `g = N · A · K`.
 *
 * `N` is upper-unipotent, `A` is positive-diagonal, `K ∈ SO(2)`. Unique
 * for any `g ∈ SL(2, ℝ)`. The decomposition is closed-form via 2×2
 * Gram-Schmidt on the columns of `g`.
 *
 * ## ℍ² coordinates
 *
 * Because `K = SO(2)` stabilizes `i ∈ ℍ²` under the Möbius action, the
 * action of `g` on `i` factors through `N · A`:
 *
 *   g · i = (N · A · K) · i = (N · A) · i = α² i + ν
 *
 * with `A = [[α, 0], [0, 1/α]]` and `N = [[1, ν], [0, 1]]`. So the
 * Iwasawa coordinates `(ν, α²)` of `g` **are** the upper-half-plane
 * coordinates `(x, y)` of `g · i`. Adding the `K`-rotation angle `θ`
 * gives a fully faithful coordinate system `(x, y, θ)` on `SL(2, ℝ)`.
 *
 * ## Closed form
 *
 * For `g = [[a, b], [c, d]]` with `det g = 1`:
 *
 *   r = √(c² + d²)
 *   α = 1 / r           (so α² = 1 / (c² + d²))
 *   ν = (ac + bd) / r²
 *   θ = atan2(c, d)
 *
 * Derivation: from `g · i = (b + ai)(d − ci) / (c² + d²) = (ac + bd)/(c² + d²) + i / (c² + d²)`,
 * read off `y = α²` and `x = ν` directly. The angle `θ` is fixed by
 * matching `g[1][0] = c = (1/α) · sin θ` and `g[1][1] = d = (1/α) · cos θ`.
 */

import { Matrix } from '@/math/linear-algebra';

export interface IwasawaSL2R {
  /** Upper-unipotent factor `N = [[1, x], [0, 1]]`. */
  N: Matrix;
  /** Positive-diagonal factor `A = [[α, 0], [0, 1/α]]`, with `α = √y`. */
  A: Matrix;
  /** Rotation factor `K ∈ SO(2)`. */
  K: Matrix;
}

export interface IwasawaCoords {
  /** ℍ² real coordinate of `g · i`. */
  x: number;
  /** ℍ² imaginary coordinate of `g · i`. Always `> 0`. */
  y: number;
  /** Frame angle of `K`. */
  theta: number;
}

/**
 * Decompose `g ∈ SL(2, ℝ)` as `g = N · A · K`.
 */
export function iwasawaSL2R(g: Matrix): IwasawaSL2R {
  const a = g.data[0], b = g.data[1], c = g.data[2], d = g.data[3];
  const r2 = c * c + d * d;
  const r = Math.sqrt(r2);
  const alpha = 1 / r;
  const x = (a * c + b * d) / r2;
  const cosTheta = d / r;   // = d · α
  const sinTheta = c / r;   // = c · α

  const N = new Matrix(2, 2);
  N.data[0] = 1; N.data[1] = x;
  N.data[2] = 0; N.data[3] = 1;

  const A = new Matrix(2, 2);
  A.data[0] = alpha;
  A.data[3] = 1 / alpha;

  const K = new Matrix(2, 2);
  K.data[0] = cosTheta; K.data[1] = -sinTheta;
  K.data[2] = sinTheta; K.data[3] =  cosTheta;

  return { N, A, K };
}

/**
 * Iwasawa coordinates of `g`: the ℍ² point `(x, y) = g · i` plus the
 * frame angle `θ`. Equivalent to `iwasawaSL2R(g)` but cheaper when
 * the matrix factors aren't needed.
 */
export function iwasawaCoordsSL2R(g: Matrix): IwasawaCoords {
  const a = g.data[0], b = g.data[1], c = g.data[2], d = g.data[3];
  const r2 = c * c + d * d;
  return {
    x: (a * c + b * d) / r2,
    y: 1 / r2,
    theta: Math.atan2(c, d),
  };
}
