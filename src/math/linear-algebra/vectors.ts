/**
 * Vector utilities on plain `number[]`.
 *
 * Free functions, not a class — `THREE.Vector3` covers the 3D graphics case
 * and plain arrays cover the variable-dimension case for manifolds, forms,
 * and phase space. A wrapper class here would just duplicate both of them.
 *
 * All functions are pure and return new arrays.
 */

export function dot(a: number[], b: number[]): number {
  const n = a.length;
  if (b.length !== n) throw new Error(`dot: length mismatch ${n} ≠ ${b.length}`);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

export function normalize(a: number[]): number[] {
  const n = norm(a);
  if (n === 0) throw new Error('normalize: zero vector');
  const inv = 1 / n;
  return a.map((x) => x * inv);
}

export function add(a: number[], b: number[]): number[] {
  if (a.length !== b.length) throw new Error(`add: length mismatch ${a.length} ≠ ${b.length}`);
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

export function sub(a: number[], b: number[]): number[] {
  if (a.length !== b.length) throw new Error(`sub: length mismatch ${a.length} ≠ ${b.length}`);
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

export function scale(a: number[], s: number): number[] {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

/** 3D cross product. Throws if either input is not length 3. */
export function cross(a: number[], b: number[]): number[] {
  if (a.length !== 3 || b.length !== 3) {
    throw new Error('cross: only defined for 3D vectors');
  }
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
