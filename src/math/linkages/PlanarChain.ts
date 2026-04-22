/**
 * PlanarChain — helper for building and posing a pinned chain of rods.
 *
 * Builds a Linkage whose topology is a path graph: joint 0 and joint n are
 * pinned, joints 1..n-1 are free, rods connect consecutive joints.
 *
 * Provides an angle-based pose function (forward kinematics) so you can
 * think in `θ_i` (angle of rod i from +x). The underlying storage is
 * still positions; angles are just a convenient parameterization.
 *
 * Angles are measured globally: each θ_i is the angle of rod i from the
 * +x axis. Relative-angle conventions (bend at each joint) are not
 * supported in this helper; if you want them, compute the global angles
 * from the relatives at the call site.
 *
 * Closure is not enforced. setAngles will happily place the chain
 * anywhere θ sends it — if your angles don't close to pinB, you'll see
 * the tail dangle, and the last rod will render at the wrong length
 * (since it connects the computed tail to pinB). This is useful as a
 * visual closure-error indicator. project() (coming in a later pass)
 * will snap arbitrary angles onto the closure variety.
 */

import type { Joint, Rod } from './types';
import { Linkage } from './Linkage';

export interface PlanarChainOptions {
  /** Rod lengths, in order from pinA to pinB. Number of rods = lengths.length. */
  lengths: number[];
  /** Pinned position of joint 0. */
  pinA: readonly [number, number];
  /** Pinned position of joint n (where n = lengths.length). */
  pinB: readonly [number, number];
}

/**
 * Build a Linkage representing a pinned planar chain.
 */
export function buildPlanarChain(options: PlanarChainOptions): Linkage {
  const n = options.lengths.length;
  if (n < 1) throw new Error('PlanarChain needs at least one rod');

  const joints: Joint[] = [];
  for (let i = 0; i <= n; i++) {
    const joint: Joint = { id: i };
    if (i === 0) joint.pinned = [options.pinA[0], options.pinA[1]];
    else if (i === n) joint.pinned = [options.pinB[0], options.pinB[1]];
    joints.push(joint);
  }

  const rods: Rod[] = [];
  for (let i = 0; i < n; i++) {
    rods.push({ a: i, b: i + 1, length: options.lengths[i] });
  }

  return new Linkage({ joints, rods, dim: 2 });
}

/**
 * Pose a planar chain by forward kinematics from global angles.
 *
 * angles.length must equal the number of rods. The result is written
 * into a fresh Float32Array and installed via linkage.setPositions,
 * triggering reactive update() on dependents.
 *
 * joint[0] stays at its pin (pinA). Subsequent joints are placed by:
 *   joint[i+1] = joint[i] + L_i · (cosθ_i, sinθ_i)
 *
 * joint[n] is written to the forward-kinematics position, which in
 * general will not equal pinB. The rendering layer draws the last rod
 * between joint[n-1] and joint[n]; if you want it drawn to pinB
 * instead, you can clamp joint[n] to pinB yourself, but then the rod
 * will render at whatever length is needed to reach (no longer rigid).
 */
export function setChainAngles(linkage: Linkage, angles: number[]): void {
  if (angles.length + 1 !== linkage.joints.length) {
    throw new Error(
      `setChainAngles: expected ${linkage.joints.length - 1} angles, got ${angles.length}`
    );
  }

  const d = linkage.dim;
  const n = angles.length;
  const out = new Float32Array(linkage.joints.length * d);

  // joint[0] at its pin (or origin if unpinned)
  const pin = linkage.joints[0].pinned;
  out[0] = pin ? pin[0] : 0;
  out[1] = pin ? pin[1] : 0;

  for (let i = 0; i < n; i++) {
    const L = linkage.rods[i].length;
    out[(i + 1) * d] = out[i * d] + L * Math.cos(angles[i]);
    out[(i + 1) * d + 1] = out[i * d + 1] + L * Math.sin(angles[i]);
  }

  linkage.setPositions(out);
}
