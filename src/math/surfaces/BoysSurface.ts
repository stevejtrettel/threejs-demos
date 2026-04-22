/**
 * Boy's surface — an immersion of RP² in R³.
 *
 * Uses the Bryant–Kusner parametrization over the unit disk.
 * Domain: u ∈ [0, 1] (radius), v ∈ [0, 2π] (angle).
 * The complex coordinate is z = u · e^(iv).
 *
 * The parametrization maps through complex rational functions:
 *   G₁(z) = -3/2 · z(1 - z⁴) / (z⁶ + √5·z³ - 1)
 *   G₂(z) = -3/2 · z(1 + z⁴) / (z⁶ + √5·z³ - 1)
 *   G₃(z) = (1 + z⁶) / (z⁶ + √5·z³ - 1)
 *
 * Then projects via (g₁, g₂, g₃) ↦ (g₁, g₂, g₃) / (g₁² + g₂² + g₃²)
 * where g₁ = Im(G₁), g₂ = Re(G₂), g₃ = Im(G₃) - 1/2.
 */

import * as THREE from 'three';
import type { Surface, SurfaceDomain } from './types';
import { cmul, cdiv, cadd, csub, cscale, type Complex } from '../algebra/complex';

const SQRT5 = Math.sqrt(5);
const ONE: Complex = [1, 0];

export class BoysSurface implements Surface {
  private readonly epsilon: number;
  private readonly scale: number;

  constructor(options?: { epsilon?: number; scale?: number }) {
    this.epsilon = options?.epsilon ?? 0.0001;
    this.scale = options?.scale ?? 2;
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    const r = u + this.epsilon;
    const z: Complex = [r * Math.cos(v), r * Math.sin(v)];

    const z2 = cmul(z, z);
    const z3 = cmul(z2, z);
    const z4 = cmul(z, z3);
    const z6 = cmul(z3, z3);

    // denom = z⁶ + √5·z³ - 1
    const denom = csub(cadd(z6, cscale(SQRT5, z3)), ONE);

    // G₁ = -3/2 · z(1 - z⁴) / denom
    const G1 = cscale(-1.5, cdiv(cmul(z, csub(ONE, z4)), denom));
    // G₂ = -3/2 · z(1 + z⁴) / denom
    const G2 = cscale(-1.5, cdiv(cmul(z, cadd(ONE, z4)), denom));
    // G₃ = (1 + z⁶) / denom
    const G3 = cdiv(cadd(ONE, z6), denom);

    const g1 = G1[1];       // Im(G₁)
    const g2 = G2[0];       // Re(G₂)
    const g3 = G3[1] - 0.5; // Im(G₃) - 1/2

    const g = g1 * g1 + g2 * g2 + g3 * g3;

    const x = g1 / g;
    const y = g2 / g;
    const zed = -g3 / g;

    return new THREE.Vector3(x, zed - 0.5, y).multiplyScalar(this.scale);
  }

  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 2 * Math.PI };
  }
}
