/**
 * Veronese embeddings ν_d: CP² → CP^N for visualization in higher codim.
 *
 * The degree-d Veronese map sends [X:Y:Z] to a tuple of all degree-d
 * monomials in (X, Y, Z), with multinomial-coefficient weighting:
 *
 *   ν_d([X:Y:Z]) = [√(d!/(i!j!k!)) · X^i Y^j Z^k]   for i + j + k = d.
 *
 * The square-root multinomial factors make ν_d an *isometric* embedding of
 * the Fubini–Study metric: if |X|² + |Y|² + |Z|² = 1, then the sum of
 * squared moduli of the image is also 1. So unit-norm CP² points land on
 * the unit sphere in C^(N+1).
 *
 * The target dimension is N + 1 = (d + 2 choose 2). A curve in CP²
 * (real codim 2) embeds via ν_d as a curve in CP^N (real codim 2N) — the
 * abstract Riemann surface is the same, but it now sits in a much richer
 * ambient projective space.
 */

import type { Complex } from '../algebraic-curves/complex';
import { cMul, cScale } from '../algebraic-curves/complex';
import type { CP2Point } from './point';

/**
 * Degree-2 Veronese: CP² → CP⁵.
 *
 * [X:Y:Z] ↦ [X², Y², Z², √2·XY, √2·XZ, √2·YZ]
 *
 * Image length: 6 complex (= 12 real). For a curve in CP², ν₂ gives a
 * curve in CP⁵ — real codim 8 in real 10D.
 */
export function veronese2(p: CP2Point): Complex[] {
  const X = p[0], Y = p[1], Z = p[2];
  const S = Math.SQRT2;
  return [
    cMul(X, X),
    cMul(Y, Y),
    cMul(Z, Z),
    cScale(cMul(X, Y), S),
    cScale(cMul(X, Z), S),
    cScale(cMul(Y, Z), S),
  ];
}

/**
 * Degree-3 Veronese: CP² → CP⁹.
 *
 * [X:Y:Z] ↦ [X³, Y³, Z³, √3·X²Y, √3·X²Z, √3·XY², √3·Y²Z, √3·XZ², √3·YZ², √6·XYZ]
 *
 * Image length: 10 complex (= 20 real). For a curve in CP², ν₃ gives a
 * curve in CP⁹ — real codim 16 in real 18D.
 */
export function veronese3(p: CP2Point): Complex[] {
  const X = p[0], Y = p[1], Z = p[2];
  const X2 = cMul(X, X);
  const Y2 = cMul(Y, Y);
  const Z2 = cMul(Z, Z);
  const S3 = Math.sqrt(3);
  const S6 = Math.sqrt(6);
  return [
    cMul(X2, X),                       // X³
    cMul(Y2, Y),                       // Y³
    cMul(Z2, Z),                       // Z³
    cScale(cMul(X2, Y), S3),           // √3 X²Y
    cScale(cMul(X2, Z), S3),           // √3 X²Z
    cScale(cMul(X, Y2), S3),           // √3 XY²
    cScale(cMul(Y2, Z), S3),           // √3 Y²Z
    cScale(cMul(X, Z2), S3),           // √3 XZ²
    cScale(cMul(Y, Z2), S3),           // √3 YZ²
    cScale(cMul(cMul(X, Y), Z), S6),   // √6 XYZ
  ];
}

/** A Veronese map for a chosen degree. */
export type VeroneseMap = (p: CP2Point) => Complex[];

/** Returns the dimension (= number of complex coords) of the Veronese image. */
export function veroneseDim(degree: 2 | 3): number {
  return degree === 2 ? 6 : 10;
}

export function veroneseFor(degree: 2 | 3): VeroneseMap {
  return degree === 2 ? veronese2 : veronese3;
}
