/**
 * HopfChart.ts
 *
 * A stereographic window onto the Hopf fibration, and the group that moves it.
 *
 * ## The picture
 *
 * Writing S³ ⊂ ℂ² as pairs (z₁, z₂) with |z₁|² + |z₂|² = 1, the Hopf fibration
 * is the quotient by the diagonal circle action (z₁, z₂) ↦ e^{it}(z₁, z₂), and
 * the base coordinate is w = z₁/z₂ ∈ ℂ ∪ {∞} ≅ S². Drawing any of this in ℝ³
 * requires a stereographic projection S³ → ℝ³, which needs a projection point,
 * and the fiber through that point is sent to a straight line through infinity.
 *
 * That straight fiber is an artifact of *where the window is*, not a feature of
 * the fibration — but with a fixed projection point it looks like one. This
 * class makes the window movable.
 *
 * ## The group
 *
 * The rotations of S³ that preserve the fibration are U(2). Its centre — the
 * diagonal circle — is exactly the fiber action, so it preserves each fiber
 * *setwise* and does nothing to the picture in ℝ³. Everything visible therefore
 * comes from SU(2), acting by
 *
 *     (z₁, z₂) ↦ (α z₁ + β z₂, −β̄ z₁ + ᾱ z₂),     |α|² + |β|² = 1
 *
 * and inducing on the base the Möbius map w ↦ (αw + β)/(−β̄w + ᾱ), i.e. the
 * corresponding rotation of S². Since stereographic projection is conformal,
 * conjugating this action by it acts on ℝ³ ∪ {∞} by Möbius transformations —
 * so "rotating" the ℝ³ picture is a conformal motion, not a rigid one, and
 * circles stay circles while their radii change.
 *
 * Applying A to the object and projecting from n gives the same ℝ³ picture as
 * leaving the object alone and projecting from A⁻¹n. This class takes the
 * second reading: the curve on S² and its preimage in S³ are never touched, and
 * `rotate` only moves the window. `singularBase` reports where the blow-up
 * currently sits, which is the one thing on the base that moves.
 *
 * ## Conventions
 *
 * Pinned down numerically in `scripts/validate-hopf.ts` against the existing
 * `toroidalCoords` / `stereoProj`, which use a non-obvious coordinate layout:
 *
 *   base point in ℝ³   h(θ, φ) = (sin φ cos θ, sin φ sin θ, −cos φ)
 *   fiber over (θ, φ)  t ↦ (e^{i(θ+t)} sin(φ/2), e^{it} cos(φ/2))
 *   ℝ⁴ layout          (Re z₁, Re z₂, −Im z₁, Im z₂)
 *   projection point   (z₁, z₂) = (−i, 0), whose base point is h = (0, 0, 1)
 *
 * Note h is *not* `fromSphericalCoords(θ, φ)` — the third component is negated.
 */

import * as THREE from 'three';
import { stereoProj } from './hopfUtils';
import type { Surface, SurfaceDomain } from '../surfaces/types';
import type { SphericalPath } from '../spherical/SphericalPath';

const TWO_PI = Math.PI * 2;
const UP = new THREE.Vector3(0, 0, 1);

/**
 * Base point in ℝ³ → a representative (z₁, z₂) ∈ S³ over it, as
 * [Re z₁, Im z₁, Re z₂, Im z₂]. Any point of the fiber will do; the phase is
 * irrelevant because the SU(2) action commutes with the fiber circle.
 */
function lift(p: THREE.Vector3): [number, number, number, number] {
  const half = (1 - p.z) / 2;
  // p at the far pole has an empty second coordinate — the other chart on ℂP¹.
  if (half < 1e-12) return [1, 0, 0, 0];
  const z2 = Math.sqrt(half);
  return [p.x / (2 * z2), p.y / (2 * z2), z2, 0];
}

/** (z₁, z₂) → its base point h = (2 Re(z₁z̄₂), 2 Im(z₁z̄₂), |z₁|² − |z₂|²). */
function project(
  z1Re: number, z1Im: number, z2Re: number, z2Im: number,
  out?: THREE.Vector3,
): THREE.Vector3 {
  const n1 = z1Re * z1Re + z1Im * z1Im;
  const n2 = z2Re * z2Re + z2Im * z2Im;
  const scale = n1 + n2;
  return (out ?? new THREE.Vector3())
    .set(2 * (z1Re * z2Re + z1Im * z2Im), 2 * (z1Im * z2Re - z1Re * z2Im), n1 - n2)
    .divideScalar(scale || 1);
}

export interface HopfChartOptions {
  /**
   * Points landing further than this from the origin are reported as NaN.
   *
   * Every window has exactly one fiber running to infinity; rotating moves it
   * but cannot remove it. Excising it by radius keeps the surface finite and,
   * because a non-finite vertex marks a hole, leaves clean missing geometry
   * rather than a spike. A fiber's radius grows as 4/(π − φ) in the angle to
   * the singular base point, so a cutoff R hides a disk of angular radius
   * about 4/R around it. Default 14 ≈ 16° of the sphere.
   */
  cutoffRadius?: number;
}

/** Base point in ℝ³ (unit vector) → the (θ, φ) this file's formulas expect. */
export function baseAngles(p: THREE.Vector3): { theta: number; phi: number } {
  return {
    theta: Math.atan2(p.y, p.x),
    phi: Math.acos(THREE.MathUtils.clamp(-p.z, -1, 1)),
  };
}

/** (θ, φ) → base point in ℝ³. Inverse of `baseAngles`. */
export function basePoint(theta: number, phi: number, out?: THREE.Vector3): THREE.Vector3 {
  const sinPhi = Math.sin(phi);
  return (out ?? new THREE.Vector3()).set(sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), -Math.cos(phi));
}

export class HopfChart {
  /** The window's SU(2) element, as α = (aRe, aIm), β = (bRe, bIm). */
  private aRe = 1;
  private aIm = 0;
  private bRe = 0;
  private bIm = 0;

  cutoffRadius: number;

  /** Incremented whenever the window moves. */
  revision = 0;

  private readonly p4 = new THREE.Vector4();

  constructor(options: HopfChartOptions = {}) {
    this.cutoffRadius = options.cutoffRadius ?? 14;
  }

  /** Reset the window to the identity. */
  reset(): void {
    this.aRe = 1; this.aIm = 0; this.bRe = 0; this.bIm = 0;
    this.revision++;
  }

  /**
   * Move the window by the rotation of angle `angle` about unit `axis`,
   * expressed in base-sphere coordinates. Composes on the left, so successive
   * drags accumulate in the order performed.
   */
  rotate(axis: THREE.Vector3, angle: number): void {
    const half = angle / 2;
    const c = Math.cos(half);
    const s = Math.sin(half);

    // The base vector h is the Bloch vector of (z₁, z₂) reflected in y — see
    // `project`, whose second component is +2 Im(z₁z̄₂) where the Bloch vector
    // has −2 Im(z₁z̄₂). Conjugating a rotation by that reflection negates both
    // the axis' y component and the angle, so the SU(2) element realizing
    // R(axis, ψ) on h is exp(+i(ψ/2) n̂′·σ) with n̂′ = (x, −y, z).
    const dRe = c, dIm = s * axis.z;
    const eRe = -s * axis.y, eIm = s * axis.x;

    // (α, β) ← (δ, ε) · (α, β), the SU(2) product written out on the top row.
    const aRe = dRe * this.aRe - dIm * this.aIm - eRe * this.bRe - eIm * this.bIm;
    const aIm = dRe * this.aIm + dIm * this.aRe + eRe * this.bIm - eIm * this.bRe;
    const bRe = dRe * this.bRe - dIm * this.bIm + eRe * this.aRe + eIm * this.aIm;
    const bIm = dRe * this.bIm + dIm * this.bRe - eRe * this.aIm + eIm * this.aRe;

    // Renormalize: thousands of composed drags would otherwise drift off SU(2).
    const norm = Math.hypot(Math.hypot(aRe, aIm), Math.hypot(bRe, bIm)) || 1;
    this.aRe = aRe / norm; this.aIm = aIm / norm;
    this.bRe = bRe / norm; this.bIm = bIm / norm;
    this.revision++;
  }

  /**
   * The rotation of the base sphere this window induces.
   *
   * Lifts the base point to (z₁, z₂) ∈ S³, applies the SU(2) element, and
   * projects back — so it is the honest induced map rather than a separately
   * maintained rotation that could drift out of step with the window.
   */
  mapBase(p: THREE.Vector3, out?: THREE.Vector3): THREE.Vector3 {
    const [z1Re, z1Im, z2Re, z2Im] = lift(p);
    const w1Re = this.aRe * z1Re - this.aIm * z1Im + this.bRe * z2Re - this.bIm * z2Im;
    const w1Im = this.aRe * z1Im + this.aIm * z1Re + this.bRe * z2Im + this.bIm * z2Re;
    const w2Re = -this.bRe * z1Re - this.bIm * z1Im + this.aRe * z2Re + this.aIm * z2Im;
    const w2Im = -this.bRe * z1Im + this.bIm * z1Re + this.aRe * z2Im - this.aIm * z2Re;
    return project(w1Re, w1Im, w2Re, w2Im, out);
  }

  /** The inverse of `mapBase`: applies A⁻¹ = [[ᾱ, −β], [β̄, α]]. */
  unmapBase(p: THREE.Vector3, out?: THREE.Vector3): THREE.Vector3 {
    const [z1Re, z1Im, z2Re, z2Im] = lift(p);
    const w1Re = this.aRe * z1Re + this.aIm * z1Im - this.bRe * z2Re + this.bIm * z2Im;
    const w1Im = this.aRe * z1Im - this.aIm * z1Re - this.bRe * z2Im - this.bIm * z2Re;
    const w2Re = this.bRe * z1Re + this.bIm * z1Im + this.aRe * z2Re - this.aIm * z2Im;
    const w2Im = this.bRe * z1Im - this.bIm * z1Re + this.aRe * z2Im + this.aIm * z2Re;
    return project(w1Re, w1Im, w2Re, w2Im, out);
  }

  /**
   * The base point whose fiber currently runs to infinity.
   *
   * The window projects from n = (−i, 0), whose base point is (0, 0, 1); the
   * offending fiber is therefore the one over A⁻¹ applied to that.
   */
  singularBase(out?: THREE.Vector3): THREE.Vector3 {
    return this.unmapBase(UP, out);
  }

  /**
   * A point of the fiber over (θ, φ), as seen through this window.
   *
   * Returns NaN coordinates beyond `cutoffRadius`.
   */
  fiberPoint(theta: number, phi: number, t: number, out?: THREE.Vector3): THREE.Vector3 {
    const result = out ?? new THREE.Vector3();

    // (z₁, z₂) = (e^{i(θ+t)} sin(φ/2), e^{it} cos(φ/2))
    const sc = Math.sin(phi / 2);
    const cc = Math.cos(phi / 2);
    const z1Re = Math.cos(theta + t) * sc;
    const z1Im = Math.sin(theta + t) * sc;
    const z2Re = Math.cos(t) * cc;
    const z2Im = Math.sin(t) * cc;

    // Apply the window: (z₁, z₂) ↦ (αz₁ + βz₂, −β̄z₁ + ᾱz₂)
    const w1Re = this.aRe * z1Re - this.aIm * z1Im + this.bRe * z2Re - this.bIm * z2Im;
    const w1Im = this.aRe * z1Im + this.aIm * z1Re + this.bRe * z2Im + this.bIm * z2Re;
    const w2Re = -this.bRe * z1Re - this.bIm * z1Im + this.aRe * z2Re + this.aIm * z2Im;
    const w2Im = -this.bRe * z1Im + this.bIm * z1Re + this.aRe * z2Im - this.aIm * z2Re;

    this.p4.set(w1Re, w2Re, -w1Im, w2Im);
    const p = stereoProj(this.p4);

    if (!(p.lengthSq() <= this.cutoffRadius * this.cutoffRadius)) {
      return result.set(NaN, NaN, NaN); // also catches the non-finite pole
    }
    return result.copy(p);
  }

  /**
   * The fiber over (θ, φ) as polyline runs, split where it leaves the cutoff.
   *
   * A fiber is a circle, so an unclipped one comes back as a single closed run;
   * one clipped by the cutoff comes back as one or more open arcs.
   */
  fiberRuns(theta: number, phi: number, segments = 256): THREE.Vector3[][] {
    const runs: THREE.Vector3[][] = [];
    let run: THREE.Vector3[] = [];
    const point = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
      const p = this.fiberPoint(theta, phi, (i / segments) * TWO_PI, point);
      if (Number.isFinite(p.x)) {
        run.push(p.clone());
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }

    // The sample at t = 2π repeats t = 0. If nothing was clipped, that makes
    // one closed loop; stitch the wrap-around seam back together.
    if (run.length) {
      if (runs.length && run.length > 1) {
        const first = runs[0];
        run.pop();
        runs[0] = run.concat(first);
      } else {
        runs.push(run);
      }
    }
    return runs;
  }

  /** Whether a fiber is drawn as one unbroken circle at this window. */
  fiberIsWhole(theta: number, phi: number, segments = 64): boolean {
    const point = new THREE.Vector3();
    for (let i = 0; i < segments; i++) {
      if (!Number.isFinite(this.fiberPoint(theta, phi, (i / segments) * TWO_PI, point).x)) return false;
    }
    return true;
  }

  /**
   * The preimage of a path on S², as a surface in ℝ³.
   *
   * u runs around the fiber, v runs along the path — matching the existing
   * `hopfPreimage`. The surface reads the path live, so editing the path and
   * re-sampling the surface is enough; nothing needs rebuilding here.
   *
   * The preimage of a closed path is a torus, and of an arc an annular strip.
   */
  preimage(path: SphericalPath): Surface {
    const chart = this;
    const base = new THREE.Vector3();

    // Callers sample row-major with v fixed across a whole row, so evaluating
    // the path once per row instead of once per vertex removes ~99% of the
    // spline evaluations.
    let cachedV = NaN;
    let theta = 0;
    let phi = 0;

    return {
      evaluate(u: number, v: number): THREE.Vector3 {
        if (v !== cachedV) {
          cachedV = v;
          const angles = baseAngles(path.evaluate(v, base));
          theta = angles.theta;
          phi = angles.phi;
        }
        return chart.fiberPoint(theta, phi, TWO_PI * u);
      },
      getDomain(): SurfaceDomain {
        return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
      },
    };
  }
}
