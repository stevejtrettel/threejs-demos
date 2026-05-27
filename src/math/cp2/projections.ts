/**
 * Projections from CP^2 to R^3 for visualization.
 *
 * A `CP2Projection` writes three real numbers (x, y, z) into a Float32Array
 * given a CP^2 point. Different projections give different visual pictures
 * of the same data: the toric/moment-map shadow lives in a 2-simplex
 * (z = 0); the affine chart gives a 3D image of the curve's complex
 * structure.
 */

import type { Complex } from '../algebraic-curves/complex';
import type { CP2Point } from './point';
import { momentMap, triangleTo2D } from './momentMap';
import { veroneseFor, veroneseDim, type VeroneseMap } from './veronese';

export type CP2Projection = (
  p: CP2Point,
  out: Float32Array,
  off: number,
) => void;

/**
 * Toric / moment-map projection: lands in the 2-simplex at z = 0.
 *
 *   [X:Y:Z] ↦ triangleTo2D(momentMap(·, weights)) × {0}
 *
 * Default weights [1, 1, 1] give the standard CP^2 picture; [1, 3, 1] gives
 * the weighted-projective P(1, 3, 1) picture for genus-2 hyperelliptic curves.
 */
export function toricProjection(
  weights: [number, number, number] = [1, 1, 1],
): CP2Projection {
  return (p, out, off) => {
    const [x, y] = triangleTo2D(momentMap(p, weights));
    out[off] = x;
    out[off + 1] = y;
    out[off + 2] = 0;
  };
}

/**
 * Affine-chart projection to R^3.
 *
 * On the chart {Z ≠ 0}, [X : Y : Z] becomes (x, y) = (X/Z, Y/Z) ∈ C^2 — four
 * real numbers. This projection keeps (Re x, Im x, Re y) — the textbook
 * "torus / pretzel" picture of a Riemann surface (drop one R-coordinate
 * out of four).
 *
 * To keep points near the line at infinity {Z = 0} from running off to
 * infinity, the result is conformally compactified onto a ball of radius
 * `scale` by v ↦ v · scale / (scale + |v|). This is bijective on R^3 and
 * sends ∞ to the sphere of radius `scale`.
 *
 * @param scale Bounding-ball radius (default 1.5).
 */
export function affineR3Projection(opts: {
  scale?: number;
} = {}): CP2Projection {
  const scale = opts.scale ?? 1.5;
  return (p, out, off) => {
    const zRe = p[2].re;
    const zIm = p[2].im;
    const zSq = zRe * zRe + zIm * zIm;

    // Points effectively at infinity: park on the boundary sphere.
    if (zSq < 1e-30) {
      out[off] = scale;
      out[off + 1] = 0;
      out[off + 2] = 0;
      return;
    }

    const inv = 1 / zSq;
    // X/Z and Y/Z via complex division
    const xRe = (p[0].re * zRe + p[0].im * zIm) * inv;
    const xIm = (p[0].im * zRe - p[0].re * zIm) * inv;
    const yRe = (p[1].re * zRe + p[1].im * zIm) * inv;

    // Conformal compactification onto ball of radius `scale`.
    const mag = Math.sqrt(xRe * xRe + xIm * xIm + yRe * yRe);
    const k = scale / (scale + mag);

    out[off] = xRe * k;
    out[off + 1] = xIm * k;
    out[off + 2] = yRe * k;
  };
}

// --- Box–Muller for the random projection matrix ----------------------------
function randn(): number {
  const u = Math.random() || 1e-300;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Generate a 3 × dim row-major matrix whose three rows form an orthonormal
 * basis of a random 3-plane in R^dim. Uses Gram–Schmidt on Gaussian samples.
 */
function randomOrthoMatrix3(dim: number): Float64Array {
  const m = new Float64Array(3 * dim);
  for (let i = 0; i < 3 * dim; i++) m[i] = randn();
  for (let r = 0; r < 3; r++) {
    for (let s = 0; s < r; s++) {
      let dot = 0;
      for (let i = 0; i < dim; i++) dot += m[r * dim + i] * m[s * dim + i];
      for (let i = 0; i < dim; i++) m[r * dim + i] -= dot * m[s * dim + i];
    }
    let n2 = 0;
    for (let i = 0; i < dim; i++) n2 += m[r * dim + i] * m[r * dim + i];
    const n = Math.sqrt(n2) || 1;
    for (let i = 0; i < dim; i++) m[r * dim + i] /= n;
  }
  return m;
}

/**
 * Project a CP² point via the degree-d Veronese embedding into CP^N, treat
 * the complex coordinates as real (re, im, re, im, …), and apply a 3-plane
 * projection onto R³.
 *
 * Because the Veronese map (with isometric multinomial weighting) sends
 * unit-norm inputs to unit-norm outputs, the source vector lies on the unit
 * sphere of R^(2N+2). Orthonormal projection then lands in the unit ball of
 * R³; we rescale by `scale` for a comfortable viewing radius.
 *
 * If `matrix` is omitted, a random orthonormal 3-plane is sampled at
 * construction. For data-aligned projections that preserve curve structure,
 * use `veronesePcaR3Projection` instead.
 *
 * @param degree  Veronese degree (2 or 3).
 * @param scale   Ball radius (default 1.5).
 * @param matrix  Optional 3 × (2N+2) row-major projection matrix.
 */
export function veroneseR3Projection(opts: {
  degree: 2 | 3;
  scale?: number;
  matrix?: Float64Array;
}): CP2Projection {
  const degree = opts.degree;
  const map = veroneseFor(degree);
  const numComplex = veroneseDim(degree);
  const sourceDim = 2 * numComplex;
  const matrix = opts.matrix ?? randomOrthoMatrix3(sourceDim);
  const scale = opts.scale ?? 1.5;
  return (p, out, off) => {
    const v = map(p);
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < numComplex; i++) {
      const re = v[i].re;
      const im = v[i].im;
      const j = 2 * i;
      x += matrix[j] * re + matrix[j + 1] * im;
      y += matrix[sourceDim + j] * re + matrix[sourceDim + j + 1] * im;
      z += matrix[2 * sourceDim + j] * re + matrix[2 * sourceDim + j + 1] * im;
    }
    out[off] = x * scale;
    out[off + 1] = y * scale;
    out[off + 2] = z * scale;
  };
}

// --- PCA: top-3 principal components -----------------------------------------

/**
 * Compute the 3 × dim row-major matrix whose rows are the top-3 eigenvectors
 * (largest eigenvalues) of the sample covariance of a dataset.
 *
 * Uses power iteration with deflation: cheap and accurate enough for the
 * 12-dim / 20-dim covariances that arise from ν₂, ν₃. For data with very
 * close top eigenvalues, the second/third PCs are only orthogonally fixed up
 * to a basis rotation within their joint span — not visually relevant here.
 *
 * Returns a freshly allocated Float64Array of length 3 * dim.
 */
export function pcaMatrix3(samples: Float64Array[], dim: number): Float64Array {
  const N = samples.length;
  if (N === 0) {
    // Fall back to a random orthonormal projection.
    return randomOrthoMatrix3(dim);
  }

  // Centroid
  const mean = new Float64Array(dim);
  for (const s of samples) {
    for (let i = 0; i < dim; i++) mean[i] += s[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= N;

  // Covariance C = (1/N) Σ (s - μ)(s - μ)^T,  dim × dim, symmetric
  const cov = new Float64Array(dim * dim);
  const buf = new Float64Array(dim);
  for (const s of samples) {
    for (let i = 0; i < dim; i++) buf[i] = s[i] - mean[i];
    for (let i = 0; i < dim; i++) {
      const bi = buf[i];
      for (let j = 0; j < dim; j++) {
        cov[i * dim + j] += bi * buf[j];
      }
    }
  }
  for (let i = 0; i < dim * dim; i++) cov[i] /= N;

  // Deflate-and-power-iterate the top 3 eigenvectors.
  const work = new Float64Array(cov); // we'll mutate this
  const out = new Float64Array(3 * dim);
  const v = new Float64Array(dim);
  const Av = new Float64Array(dim);
  const ITERS = 200;

  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < dim; i++) v[i] = randn();
    normalizeInPlace(v, dim);
    for (let iter = 0; iter < ITERS; iter++) {
      // Av = work · v
      for (let i = 0; i < dim; i++) {
        let s = 0;
        for (let j = 0; j < dim; j++) s += work[i * dim + j] * v[j];
        Av[i] = s;
      }
      // re-orthogonalize against previously found PCs (numerical stability)
      for (let s = 0; s < r; s++) {
        let dot = 0;
        for (let i = 0; i < dim; i++) dot += Av[i] * out[s * dim + i];
        for (let i = 0; i < dim; i++) Av[i] -= dot * out[s * dim + i];
      }
      const n = normalizeInPlace(Av, dim);
      if (n === 0) break;
      // copy Av → v
      for (let i = 0; i < dim; i++) v[i] = Av[i];
    }
    // Eigenvalue ≈ v^T (work · v)
    let lambda = 0;
    for (let i = 0; i < dim; i++) {
      let s = 0;
      for (let j = 0; j < dim; j++) s += work[i * dim + j] * v[j];
      lambda += v[i] * s;
    }
    // Store the eigenvector
    for (let i = 0; i < dim; i++) out[r * dim + i] = v[i];
    // Deflate: work ← work − λ v vᵀ
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        work[i * dim + j] -= lambda * v[i] * v[j];
      }
    }
  }
  return out;
}

function normalizeInPlace(v: Float64Array, dim: number): number {
  let n = 0;
  for (let i = 0; i < dim; i++) n += v[i] * v[i];
  n = Math.sqrt(n);
  if (n === 0) return 0;
  for (let i = 0; i < dim; i++) v[i] /= n;
  return n;
}

/**
 * Veronese R³ projection whose 3-plane is aligned with the top-3 principal
 * components of the actual Veronese-mapped point cloud — preserves the most
 * variance and therefore the most curve structure under projection.
 *
 * The PCA is computed on the un-rotated cloud, so as the U(3) rotation
 * animates the curve moves through this fixed lens.
 */
export function veronesePcaR3Projection(opts: {
  degree: 2 | 3;
  samples: CP2Point[];
  scale?: number;
}): CP2Projection {
  const { degree, samples } = opts;
  const map: VeroneseMap = veroneseFor(degree);
  const numComplex = veroneseDim(degree);
  const sourceDim = 2 * numComplex;

  if (samples.length === 0) {
    return veroneseR3Projection({ degree, scale: opts.scale });
  }

  // Vectorize each sample's Veronese image as (re, im, re, im, ...).
  const data: Float64Array[] = new Array(samples.length);
  for (let s = 0; s < samples.length; s++) {
    const v = map(samples[s]);
    const r = new Float64Array(sourceDim);
    for (let i = 0; i < numComplex; i++) {
      r[2 * i] = v[i].re;
      r[2 * i + 1] = v[i].im;
    }
    data[s] = r;
  }

  const matrix = pcaMatrix3(data, sourceDim);
  return veroneseR3Projection({ degree, matrix, scale: opts.scale });
}

// --- CP³ tetrahedron view ---------------------------------------------------
//
// Every CPⁿ has a Fubini–Study moment map onto the standard n-simplex Δⁿ.
// For n = 3 this lands in a tetrahedron — the unique simplex above CP² that
// still sits naturally in R³. To use it for our CP² curves we need 4
// coordinates per point; we get them from 4 of the 6 ν₂ monomials, defining
// a map CP² → CP³. The image fills part of the tetrahedron.

const _TS = 1 / Math.sqrt(3);

/**
 * Vertices of a regular tetrahedron centered at the origin, circumradius 1.
 * Chosen as the four "even-parity" corners of the cube [±1]³, scaled to the
 * unit sphere.
 */
export const TETRAHEDRON_VERTICES: ReadonlyArray<readonly [number, number, number]> = [
  [_TS, _TS, _TS],
  [_TS, -_TS, -_TS],
  [-_TS, _TS, -_TS],
  [-_TS, -_TS, _TS],
];

/**
 * Tetrahedron view of CP³ via a linear embedding.
 *
 * Maps [X:Y:Z] → [X:Y:Z:L(X,Y,Z)] for a complex linear functional
 *   L(X, Y, Z) = α X + β Y + γ Z,
 * then applies the CP³ Fubini–Study moment map and embeds the resulting
 * 3-simplex Δ³ as a regular tetrahedron in R³.
 *
 * Unlike a single-monomial polynomial map (whose moment image factors through
 * the (|X|², |Y|², |Z|²) triangle), |L|² has phase-dependent cross terms
 *   |L|² = |α|²a + |β|²b + |γ|²c + 2 Re(αβ̄ XȲ) + 2 Re(αγ̄ XZ̄) + 2 Re(βγ̄ YZ̄).
 * The cross terms depend on the inter-coordinate phases of (X, Y, Z), so
 * different CP² curves produce different 2D surfaces inside the tetrahedron
 * rather than all collapsing onto a single fixed 2D moment submanifold.
 *
 * @param L  Complex linear coefficients (α, β, γ). Default (1, 1, 1) — the
 *           "uniform sum" X + Y + Z.
 */
export function cp3TetrahedronProjection(opts: {
  L?: [Complex, Complex, Complex];
} = {}): CP2Projection {
  const L = opts.L ?? [
    { re: 1, im: 0 },
    { re: 1, im: 0 },
    { re: 1, im: 0 },
  ];
  return (p, out, off) => {
    const X = p[0], Y = p[1], Z = p[2];
    // L_total = α·X + β·Y + γ·Z (complex linear combination)
    const Lre =
      L[0].re * X.re - L[0].im * X.im +
      L[1].re * Y.re - L[1].im * Y.im +
      L[2].re * Z.re - L[2].im * Z.im;
    const Lim =
      L[0].re * X.im + L[0].im * X.re +
      L[1].re * Y.im + L[1].im * Y.re +
      L[2].re * Z.im + L[2].im * Z.re;
    const a = X.re * X.re + X.im * X.im;
    const b = Y.re * Y.re + Y.im * Y.im;
    const c = Z.re * Z.re + Z.im * Z.im;
    const d = Lre * Lre + Lim * Lim;
    const s = a + b + c + d;
    if (s === 0) {
      out[off] = 0;
      out[off + 1] = 0;
      out[off + 2] = 0;
      return;
    }
    const inv = 1 / s;
    const w0 = a * inv, w1 = b * inv, w2 = c * inv, w3 = d * inv;
    const t = TETRAHEDRON_VERTICES;
    out[off]     = w0 * t[0][0] + w1 * t[1][0] + w2 * t[2][0] + w3 * t[3][0];
    out[off + 1] = w0 * t[0][1] + w1 * t[1][1] + w2 * t[2][1] + w3 * t[3][1];
    out[off + 2] = w0 * t[0][2] + w1 * t[1][2] + w2 * t[2][2] + w3 * t[3][2];
  };
}


