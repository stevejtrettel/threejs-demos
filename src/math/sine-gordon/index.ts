/**
 * Sine-Gordon machinery for K = -1 surfaces.
 *
 * The sine-Gordon equation ω_uv = sin ω is the Gauss–Codazzi compatibility
 * condition for a surface of constant negative Gaussian curvature in
 * asymptotic coordinates. Every solution ω(u, v) ∈ (0, π) reconstructs a
 * pseudospherical surface in ℝ³ via the moving-frame integrator.
 *
 * Layout:
 *   connection.ts      — A_u(ω_u), A_v(ω) skew matrices + RK4 deriv fns.
 *   frameIntegrator.ts — Two-pass grid integrator: bottom edge in u, then
 *                        up in v from each column.
 *   SineGordonSurface  — DifferentialSurface wrapper around a FrameGrid.
 *   omega/             — Solution providers (closed-form and, later,
 *                        numerically Goursat-solved).
 */

export { connU, connV, derivU, derivV, INIT_STATE } from './connection';
export { buildFrameGrid } from './frameIntegrator';
export type { FrameGrid, FrameGridOptions } from './frameIntegrator';
export { SineGordonSurface } from './SineGordonSurface';
export type { SineGordonSurfaceOptions } from './SineGordonSurface';
export { PseudosphereOmega } from './omega/Pseudosphere';
export { BreatherOmega } from './omega/Breather';
export { Kuen2Soliton } from './omega/Kuen';
export { GoursatOmega } from './omega/GoursatOmega';
export type { GoursatOmegaOptions } from './omega/GoursatOmega';
export { solveGoursat } from './goursat';
export type { GoursatOptions } from './goursat';
