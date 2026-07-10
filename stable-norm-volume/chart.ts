import type { TraceTriple } from "./curves.ts";

// Parameterize Teichmüller space by two of the three traces. Solving the
// Markoff cubic x² + y² + z² = xyz for z given (x, y):
//
//     z = (xy ± √((xy)² − 4(x² + y²))) / 2.
//
// We take the minus branch — the sheet through the modular torus (3,3,3) — and
// return null when the discriminant is negative, i.e. when (x, y) lies outside
// Teichmüller space and there is no real structure. Convenient for sweeping a
// grid: skip the nulls.
//
// This is the algebraic chart on the Markoff cubic surface, NOT the (harder,
// transcendental) conformal-modulus τ chart.
export function tripleFromTraces(x: number, y: number): TraceTriple | null {
  const disc = (x * y) ** 2 - 4 * (x * x + y * y);
  if (disc < 0) return null;
  return { x, y, z: (x * y - Math.sqrt(disc)) / 2 };
}
