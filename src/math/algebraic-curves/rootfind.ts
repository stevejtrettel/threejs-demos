import type { Complex } from './complex';
import { cMul, cSub, cDiv, cAbs2 } from './complex';

/** Horner evaluation of c_0 + c_1 t + ... + c_n t^n at z. */
function evalPoly(coeffs: Complex[], z: Complex): Complex {
  const n = coeffs.length - 1;
  let acc: Complex = { re: coeffs[n].re, im: coeffs[n].im };
  for (let i = n - 1; i >= 0; i--) {
    const re = acc.re * z.re - acc.im * z.im + coeffs[i].re;
    const im = acc.re * z.im + acc.im * z.re + coeffs[i].im;
    acc = { re, im };
  }
  return acc;
}

/**
 * Durand–Kerner (Weierstrass) iteration for all roots of a univariate complex
 * polynomial. coeffs[i] is the coefficient of t^i.
 *
 * Returns all complex roots; for a degree-n poly with nonzero leading coeff,
 * returns n roots (counted with multiplicity, though multiplicities converge
 * slowly — fine for visualization).
 */
export function findRoots(coeffsIn: Complex[], maxIter = 120, tol = 1e-13): Complex[] {
  // Strip trailing zeros so leading coefficient is nonzero.
  const coeffs = coeffsIn.slice();
  while (coeffs.length > 1 && cAbs2(coeffs[coeffs.length - 1]) < 1e-300) coeffs.pop();
  const n = coeffs.length - 1;
  if (n <= 0) return [];

  // Monic-normalize.
  const lead = coeffs[n];
  const monic = coeffs.map((c) => cDiv(c, lead));

  // Cauchy's bound on root moduli: r = 1 + max_{i<n} |a_i|.
  let bound = 0;
  for (let i = 0; i < n; i++) {
    const m = Math.hypot(monic[i].re, monic[i].im);
    if (m > bound) bound = m;
  }
  const r = 1 + bound;

  // Seed roots on a circle of radius r, slightly offset rotation so no z_k is real.
  const roots: Complex[] = [];
  const seedRot = 0.4; // arbitrary phase offset
  for (let k = 0; k < n; k++) {
    const theta = (2 * Math.PI * (k + 0.5)) / n + seedRot;
    roots.push({ re: r * Math.cos(theta), im: r * Math.sin(theta) });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta2 = 0;
    for (let k = 0; k < n; k++) {
      const z = roots[k];
      const pz = evalPoly(monic, z);
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j === k) continue;
        denom = cMul(denom, cSub(z, roots[j]));
      }
      // Guard against denom underflow (two seeds coincide).
      if (cAbs2(denom) < 1e-300) continue;
      const delta = cDiv(pz, denom);
      roots[k] = cSub(z, delta);
      const d2 = delta.re * delta.re + delta.im * delta.im;
      if (d2 > maxDelta2) maxDelta2 = d2;
    }
    if (maxDelta2 < tol * tol) break;
  }
  return roots;
}
