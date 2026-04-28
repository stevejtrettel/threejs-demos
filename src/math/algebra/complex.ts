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

// ── Hyperbolic + trig (used by closed-form Lie-group exp/log) ─

/** `cosh(z) = cosh(x) cos(y) + i sinh(x) sin(y)`. */
export function ccosh(z: Complex): Complex {
  return [Math.cosh(z[0]) * Math.cos(z[1]), Math.sinh(z[0]) * Math.sin(z[1])];
}

/** `sinh(z) = sinh(x) cos(y) + i cosh(x) sin(y)`. */
export function csinh(z: Complex): Complex {
  return [Math.sinh(z[0]) * Math.cos(z[1]), Math.cosh(z[0]) * Math.sin(z[1])];
}

/** `cos(z) = cos(x) cosh(y) − i sin(x) sinh(y)`. */
export function ccos(z: Complex): Complex {
  return [Math.cos(z[0]) * Math.cosh(z[1]), -Math.sin(z[0]) * Math.sinh(z[1])];
}

/** `sin(z) = sin(x) cosh(y) + i cos(x) sinh(y)`. */
export function csin(z: Complex): Complex {
  return [Math.sin(z[0]) * Math.cosh(z[1]), Math.cos(z[0]) * Math.sinh(z[1])];
}

// ── Equality with tolerance ─────────────────────────────────

export function cclose(z: Complex, w: Complex, tol = 1e-12): boolean {
  return Math.abs(z[0] - w[0]) <= tol && Math.abs(z[1] - w[1]) <= tol;
}

// ── Convenience constructor ─────────────────────────────────

export function complex(re: number, im = 0): Complex {
  return [re, im];
}
