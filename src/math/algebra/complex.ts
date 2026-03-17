/**
 * Complex number arithmetic using tuples for performance.
 *
 * A complex number z = a + bi is represented as [a, b].
 * All functions return new tuples (no mutation).
 */

export type Complex = [number, number];

// ── Constants ────────────────────────────────────────────

export const CZERO: Complex = [0, 0];
export const CONE: Complex = [1, 0];
export const CI: Complex = [0, 1];

// ── Basic arithmetic ─────────────────────────────────────

export function cadd(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}

export function csub(a: Complex, b: Complex): Complex {
  return [a[0] - b[0], a[1] - b[1]];
}

export function cmul(a: Complex, b: Complex): Complex {
  return [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
  ];
}

export function cscale(s: number, z: Complex): Complex {
  return [s * z[0], s * z[1]];
}

export function cneg(z: Complex): Complex {
  return [-z[0], -z[1]];
}

export function cconj(z: Complex): Complex {
  return [z[0], -z[1]];
}

export function cinv(z: Complex): Complex {
  const d = z[0] * z[0] + z[1] * z[1];
  return [z[0] / d, -z[1] / d];
}

export function cdiv(a: Complex, b: Complex): Complex {
  const d = b[0] * b[0] + b[1] * b[1];
  return [
    (a[0] * b[0] + a[1] * b[1]) / d,
    (a[1] * b[0] - a[0] * b[1]) / d,
  ];
}

// ── Norm and argument ────────────────────────────────────

export function cabs2(z: Complex): number {
  return z[0] * z[0] + z[1] * z[1];
}

export function cabs(z: Complex): number {
  return Math.hypot(z[0], z[1]);
}

export function carg(z: Complex): number {
  return Math.atan2(z[1], z[0]);
}

// ── Transcendentals ──────────────────────────────────────

export function cexp(z: Complex): Complex {
  const r = Math.exp(z[0]);
  return [r * Math.cos(z[1]), r * Math.sin(z[1])];
}

export function clog(z: Complex): Complex {
  return [0.5 * Math.log(z[0] * z[0] + z[1] * z[1]), Math.atan2(z[1], z[0])];
}

export function csqrt(z: Complex): Complex {
  const r = Math.sqrt(Math.hypot(z[0], z[1]));
  const theta = 0.5 * Math.atan2(z[1], z[0]);
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

export function cpow(z: Complex, w: Complex): Complex {
  // z^w = exp(w * log(z))
  if (z[0] === 0 && z[1] === 0) return CZERO;
  return cexp(cmul(w, clog(z)));
}
