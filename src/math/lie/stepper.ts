/**
 * Lie-group stepper — one-step update `R → R'` for a group element under
 * an angular-velocity vector in the Lie algebra.
 *
 * Two conventions, corresponding to whether the velocity is expressed in
 * the **body** or **world** frame:
 *
 *   stepBody:   R_next = R · exp(dt · ξ_body)      (right-multiply)
 *   stepWorld:  R_next = exp(dt · ξ_world) · R     (left-multiply)
 *
 * The two are related by the adjoint: if `ξ_world = Ad_R(ξ_body)`, the
 * resulting `R_next` is the same. Pick whichever frame you're computing
 * `ξ` in.
 *
 * Both variants preserve the group *exactly* — no need for re-projection
 * or renormalization — because `exp` lands on the group by construction.
 * This is the standard Lie-group integration step used by Dzhanibekov
 * (body-frame angular velocity from Euler's equation), the rolling-ball
 * demo (world-frame `ω = n × v / r`), and the spinning top (body-frame
 * via the rigid-body splitting scheme).
 */

import type { Matrix } from '@/math/linear-algebra';
import type { MatrixLieGroup } from './types';

/**
 * Body-frame step: `R_next = R · exp(dt · ξ_body)`.
 *
 * Use when `ξ` is expressed in the body-fixed frame — e.g. Euler's
 * equation for a rigid body gives `Ω_body = I⁻¹ L_body`, and the
 * orientation update is `R ← R · exp(dt · hat(Ω_body))`.
 */
export function stepBody(
  group: MatrixLieGroup,
  R: Matrix,
  xi: number[],
  dt: number,
): Matrix {
  const dR = group.exp(xi.map((x) => x * dt));
  return group.multiply(R, dR);
}

/**
 * World-frame step: `R_next = exp(dt · ξ_world) · R`.
 *
 * Use when `ξ` is expressed in the fixed world frame — e.g. a ball
 * rolling on a surface has world-frame angular velocity
 * `ω = n × v_center / r`, and the orientation update is
 * `R ← exp(dt · hat(ω)) · R`.
 */
export function stepWorld(
  group: MatrixLieGroup,
  R: Matrix,
  xi: number[],
  dt: number,
): Matrix {
  const dR = group.exp(xi.map((x) => x * dt));
  return group.multiply(dR, R);
}
