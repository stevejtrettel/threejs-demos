import type { Complex } from './complex';
import { cAdd, cMul } from './complex';
import type { CP2Point } from '../cp2/point';

/** A monomial c * X^i Y^j Z^k of a homogeneous polynomial. i+j+k = degree. */
export type Monomial = { i: number; j: number; k: number; c: Complex };

export type HomoPoly = { degree: number; terms: Monomial[] };

/**
 * Build a HomoPoly from concise tuples.
 * Each entry is [i, j, k, c] where c is a real number (treated as real Complex) or a Complex.
 */
export function homoPoly(
  degree: number,
  terms: Array<[number, number, number, number] | [number, number, number, Complex]>,
): HomoPoly {
  return {
    degree,
    terms: terms.map(([i, j, k, c]) => ({
      i,
      j,
      k,
      c: typeof c === 'number' ? { re: c, im: 0 } : c,
    })),
  };
}

/** Evaluate F(X, Y, Z). */
export function evaluateAt(F: HomoPoly, X: Complex, Y: Complex, Z: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 };
  for (const m of F.terms) {
    let term = m.c;
    for (let a = 0; a < m.i; a++) term = cMul(term, X);
    for (let a = 0; a < m.j; a++) term = cMul(term, Y);
    for (let a = 0; a < m.k; a++) term = cMul(term, Z);
    acc = cAdd(acc, term);
  }
  return acc;
}

export function evaluateAtPoint(F: HomoPoly, p: CP2Point): Complex {
  return evaluateAt(F, p[0], p[1], p[2]);
}

// --- univariate poly helpers (Complex coeffs, coeffs[i] = coefficient of t^i) ---

function polyMul(a: Complex[], b: Complex[]): Complex[] {
  const out: Complex[] = new Array(a.length + b.length - 1);
  for (let i = 0; i < out.length; i++) out[i] = { re: 0, im: 0 };
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] = cAdd(out[i + j], cMul(a[i], b[j]));
    }
  }
  return out;
}

function polyPow(p: Complex[], n: number): Complex[] {
  let acc: Complex[] = [{ re: 1, im: 0 }];
  for (let i = 0; i < n; i++) acc = polyMul(acc, p);
  return acc;
}

function polyAddInPlace(target: Complex[], src: Complex[]): Complex[] {
  if (src.length > target.length) {
    for (let i = target.length; i < src.length; i++) target.push({ re: 0, im: 0 });
  }
  for (let i = 0; i < src.length; i++) target[i] = cAdd(target[i], src[i]);
  return target;
}

function polyScale(p: Complex[], s: Complex): Complex[] {
  return p.map((c) => cMul(c, s));
}

/**
 * Restrict F to the line {p + t*q : t in C} in CP^2: returns f(t) = F(p + t q) as
 * coefficients in t with f.length = degree+1, coeffs[i] = coefficient of t^i.
 */
export function restrictToLine(F: HomoPoly, p: CP2Point, q: CP2Point): Complex[] {
  // Each variable becomes a degree-1 polynomial in t: X(t) = p[0] + t * q[0], etc.
  const Xt: Complex[] = [p[0], q[0]];
  const Yt: Complex[] = [p[1], q[1]];
  const Zt: Complex[] = [p[2], q[2]];

  const acc: Complex[] = [{ re: 0, im: 0 }];
  for (const m of F.terms) {
    let term: Complex[] = [{ re: 1, im: 0 }];
    if (m.i > 0) term = polyMul(term, polyPow(Xt, m.i));
    if (m.j > 0) term = polyMul(term, polyPow(Yt, m.j));
    if (m.k > 0) term = polyMul(term, polyPow(Zt, m.k));
    term = polyScale(term, m.c);
    polyAddInPlace(acc, term);
  }
  return acc;
}
