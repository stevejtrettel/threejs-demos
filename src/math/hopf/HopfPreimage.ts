/**
 * HopfPreimage.ts
 *
 * Computes preimages under the Hopf fibration:
 *   - Fiber of a point on S² → a closed curve (circle) in R³
 *   - Preimage of a curve on S² → a surface in R³
 *
 * Unlike HopfTorus, this doesn't need isometric parameterization or
 * lattice data — just the raw Hopf map composed with stereographic projection.
 */

import * as THREE from 'three';
import type { Surface, SurfaceDomain } from '../surfaces/types';
import { ParametricCurve } from '../curves/ParametricCurve';
import { toroidalCoords, stereoProj } from './hopfUtils';

const TWO_PI = 2 * Math.PI;

/**
 * Hopf fiber over a point on S² given by spherical coordinates (theta, phi).
 *
 * Returns a ParametricCurve (closed circle in R³ via stereographic projection).
 * Compatible with CurveTube for rendering.
 */
export function hopfFiber(theta: number, phi: number): ParametricCurve {
  const halfPhi = phi / 2;
  return new ParametricCurve({
    parameterization: (t: number) => {
      const p4 = toroidalCoords(theta + t, t, halfPhi);
      return stereoProj(p4);
    },
    domain: { tMin: 0, tMax: TWO_PI },
  });
}

/**
 * Preimage surface of a curve on S² under the Hopf fibration.
 *
 * Given a curve t → (theta(t), phi(t)) on S², returns the Surface
 * swept by the Hopf fibers along that curve, projected to R³.
 *
 * The surface is parameterized by (u, v) ∈ [0, 1]²:
 *   u = fiber direction (around each Hopf circle)
 *   v = along the S² curve
 */
export function hopfPreimage(
  coordCurve: (t: number) => { theta: number; phi: number },
): Surface {
  return {
    evaluate(u: number, v: number): THREE.Vector3 {
      const S = TWO_PI * u;
      const T = TWO_PI * v;
      const { theta, phi } = coordCurve(T);
      const p4 = toroidalCoords(theta + S, S, phi / 2);
      return stereoProj(p4);
    },
    getDomain(): SurfaceDomain {
      return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    },
  };
}
