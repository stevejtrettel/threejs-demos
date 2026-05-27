import type { Complex } from '../algebraic-curves/complex';
import { cAdd, cMul, C0, C1 } from '../algebraic-curves/complex';
import type { CP2Point } from './point';

/**
 * 3x3 complex matrices acting on CP^2 by left multiplication.
 * Stored row-major: M[row][col].
 */
export type Mat3C = [
  [Complex, Complex, Complex],
  [Complex, Complex, Complex],
  [Complex, Complex, Complex],
];

export function identityMat3C(): Mat3C {
  return [
    [C1, C0, C0],
    [C0, C1, C0],
    [C0, C0, C1],
  ];
}

/** (M p)_i = sum_j M[i][j] * p[j]. */
export function applyMat3C(M: Mat3C, p: CP2Point): CP2Point {
  return [
    cAdd(cAdd(cMul(M[0][0], p[0]), cMul(M[0][1], p[1])), cMul(M[0][2], p[2])),
    cAdd(cAdd(cMul(M[1][0], p[0]), cMul(M[1][1], p[1])), cMul(M[1][2], p[2])),
    cAdd(cAdd(cMul(M[2][0], p[0]), cMul(M[2][1], p[1])), cMul(M[2][2], p[2])),
  ];
}

/** (A B)_{ik} = sum_j A_{ij} B_{jk}. */
export function composeMat3C(A: Mat3C, B: Mat3C): Mat3C {
  const out = identityMat3C();
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) {
      let s: Complex = C0;
      for (let j = 0; j < 3; j++) s = cAdd(s, cMul(A[i][j], B[j][k]));
      out[i][k] = s;
    }
  }
  return out;
}

const cr = (re: number): Complex => ({ re, im: 0 });

/** Real rotation in the (X, Y) plane fixing Z. SO(2) ⊂ U(3). */
export function planeRotXY(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [cr(c), cr(-s), C0],
    [cr(s), cr(c), C0],
    [C0, C0, C1],
  ];
}

/** Real rotation in the (Y, Z) plane fixing X. */
export function planeRotYZ(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [C1, C0, C0],
    [C0, cr(c), cr(-s)],
    [C0, cr(s), cr(c)],
  ];
}

/** Real rotation in the (Z, X) plane fixing Y. */
export function planeRotZX(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [cr(c), C0, cr(s)],
    [C0, C1, C0],
    [cr(-s), C0, cr(c)],
  ];
}

// --- Complex (non-real) plane rotations. These are unitary 2×2 blocks of the
//     form exp(i θ σ_x) = ((cos θ, i sin θ), (i sin θ, cos θ)) embedded into
//     U(3), each fixing the remaining axis. Together with planeRotXY/YZ/ZX
//     they generate enough of U(3) to break the conjugation symmetry that
//     can collapse a moment-image (the one that makes the r₂→r₃ loop look
//     like an arc when the cubic has three real roots). ---

const ci = (im: number): Complex => ({ re: 0, im });

export function complexRotXY(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [cr(c), ci(s), C0],
    [ci(s), cr(c), C0],
    [C0, C0, C1],
  ];
}

export function complexRotYZ(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [C1, C0, C0],
    [C0, cr(c), ci(s)],
    [C0, ci(s), cr(c)],
  ];
}

export function complexRotZX(theta: number): Mat3C {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [cr(c), C0, ci(s)],
    [C0, C1, C0],
    [ci(s), C0, cr(c)],
  ];
}

// --- One-parameter rotation paths through U(3) -------------------------------
//
// A natural family of continuous rotations is built from the six plane-rotation
// generators (three real, three complex) each spinning at its own rate. With
// incommensurate rates the path is non-periodic and dense enough to break the
// conjugation-symmetry collapse of moment-map images that pure SO(3) rotations
// suffer from.

export type U3RotationSpeeds = {
  xy: number;
  yz: number;
  zx: number;
  cxy: number;
  cyz: number;
  czx: number;
};

/**
 * Sample a random set of rotation rates, each in ±[minRate, maxRate]. Defaults
 * give visually slow but varying speeds suitable for live visualization.
 */
export function randomU3Speeds(minRate = 0.04, maxRate = 0.2): U3RotationSpeeds {
  const pick = () =>
    (minRate + (maxRate - minRate) * Math.random()) *
    (Math.random() < 0.5 ? -1 : 1);
  return {
    xy: pick(), yz: pick(), zx: pick(),
    cxy: pick(), cyz: pick(), czx: pick(),
  };
}

/**
 * Build the composed rotation g(t) = R_XY · R_YZ · R_ZX · C_XY · C_YZ · C_ZX,
 * each plane factor evaluated at `phase * speeds.<axis>`. The result is a
 * unitary 3×3 matrix that can be applied to any CP² point.
 */
export function composeU3Rotation(phase: number, speeds: U3RotationSpeeds): Mat3C {
  const real3 = composeMat3C(
    planeRotXY(phase * speeds.xy),
    composeMat3C(planeRotYZ(phase * speeds.yz), planeRotZX(phase * speeds.zx)),
  );
  const cplx3 = composeMat3C(
    complexRotXY(phase * speeds.cxy),
    composeMat3C(complexRotYZ(phase * speeds.cyz), complexRotZX(phase * speeds.czx)),
  );
  return composeMat3C(real3, cplx3);
}
