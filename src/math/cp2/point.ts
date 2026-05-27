import type { Complex } from '../algebraic-curves/complex';
import { cAbs2, cRandn } from '../algebraic-curves/complex';

/** A point in CP^2 in homogeneous coordinates [X:Y:Z]. */
export type CP2Point = [Complex, Complex, Complex];

/** Scale (X,Y,Z) so |X|^2 + |Y|^2 + |Z|^2 = 1. Phase is left arbitrary. */
export function cp2Norm(p: CP2Point): CP2Point {
  const n = Math.sqrt(cAbs2(p[0]) + cAbs2(p[1]) + cAbs2(p[2]));
  if (n === 0) return p;
  const inv = 1 / n;
  return [
    { re: p[0].re * inv, im: p[0].im * inv },
    { re: p[1].re * inv, im: p[1].im * inv },
    { re: p[2].re * inv, im: p[2].im * inv },
  ];
}

/** A uniformly random direction in CP^2 from a standard complex Gaussian, then sphere-normalized. */
export function randomCP2Direction(): CP2Point {
  return cp2Norm([cRandn(), cRandn(), cRandn()]);
}

/** Componentwise p + t * q, no normalization. */
export function lineAt(p: CP2Point, q: CP2Point, t: Complex): CP2Point {
  const X = {
    re: p[0].re + t.re * q[0].re - t.im * q[0].im,
    im: p[0].im + t.re * q[0].im + t.im * q[0].re,
  };
  const Y = {
    re: p[1].re + t.re * q[1].re - t.im * q[1].im,
    im: p[1].im + t.re * q[1].im + t.im * q[1].re,
  };
  const Z = {
    re: p[2].re + t.re * q[2].re - t.im * q[2].im,
    im: p[2].im + t.re * q[2].im + t.im * q[2].re,
  };
  return [X, Y, Z];
}
