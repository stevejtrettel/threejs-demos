/**
 * Complex numbers as plain {re, im} objects.
 * Functional ops — no class, no method dispatch cost in tight inner loops.
 */

export type Complex = { re: number; im: number };

export const C = (re: number, im = 0): Complex => ({ re, im });
export const C0: Complex = { re: 0, im: 0 };
export const C1: Complex = { re: 1, im: 0 };

export const cAdd = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

export const cSub = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const cScale = (a: Complex, s: number): Complex => ({
  re: a.re * s,
  im: a.im * s,
});

export const cDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
};

export const cNeg = (a: Complex): Complex => ({ re: -a.re, im: -a.im });
export const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cAbs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re);

// Standard normal via Box-Muller.
function randn(): number {
  const u = Math.random() || 1e-300;
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Complex standard normal: real and imaginary parts independent N(0,1).
export const cRandn = (): Complex => ({ re: randn(), im: randn() });
