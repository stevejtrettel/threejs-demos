/**
 * Projective plane P²(F_p): all p²+p+1 points in homogeneous coordinates,
 * embedded into R³ via a chosen embedding function.
 *
 * Pure math — no Three.js dependency.
 */

import { FiniteField, type ProjectivePoint } from './finiteField';

export type ProjectiveEmbedding = (p: number, pt: ProjectivePoint) => [number, number, number];

/** @deprecated Use ProjectiveEmbedding instead. */
export type Embedding = (p: number, pt: [number, number]) => [number, number, number];

// ── Helpers ───────────────────────────────────────────────

/** Place an affine [x,y] on a torus with given R, r. */
function torusAffine(p: number, x: number, y: number, R: number, r: number): [number, number, number] {
  const u = (2 * Math.PI * x) / p;
  const v = (2 * Math.PI * y) / p;
  const ring = r * Math.cos(u) + R;
  return [ring * Math.cos(v), -r * Math.sin(u), ring * Math.sin(v)];
}

/**
 * Angle of the direction a point at infinity represents.
 * [1:m:0] → direction (1, m) → atan2(m, 1)
 * [0:1:0] → direction (0, 1) → π/2
 */
function infinityAngle(_p: number, pt: ProjectivePoint): number {
  if (pt[0] === 0) return Math.PI / 2;
  return Math.atan2(pt[1], 1);
}

// ── Embeddings ────────────────────────────────────────────

/**
 * Standard donut torus embedding.
 * Affine points on the torus, infinity points on a halo circle
 * placed at the angle matching their slope direction.
 */
export const torusEmbedding: ProjectiveEmbedding = (p, pt) => {
  if (pt[2] !== 0) return torusAffine(p, pt[0], pt[1], 2, 1);
  const angle = infinityAngle(p, pt);
  return [2 * Math.cos(angle), 2.5, 2 * Math.sin(angle)];
};

/**
 * Flat grid embedding.
 * Affine points on the xz-plane, infinity points placed on a circle
 * around the grid at the angle corresponding to their slope.
 */
export const gridEmbedding: ProjectiveEmbedding = (p, pt) => {
  if (pt[2] !== 0) return [pt[0], 0, pt[1]];
  const half = (p - 1) / 2;
  const radius = half * Math.SQRT2 + 2; // clear of grid corners
  const angle = infinityAngle(p, pt);
  return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
};

/** Torus embedding with radii scaled so point spacing stays ~constant. */
export function scaledTorusEmbedding(scale: number): ProjectiveEmbedding {
  return (p, pt) => {
    const R = 2 * scale;
    const r = 1 * scale;
    if (pt[2] !== 0) return torusAffine(p, pt[0], pt[1], R, r);
    const angle = infinityAngle(p, pt);
    const haloY = (r + R) * 0.7;
    return [R * Math.cos(angle), haloY, R * Math.sin(angle)];
  };
}

/** Grid embedding with custom spacing. */
export function scaledGridEmbedding(scale: number): ProjectiveEmbedding {
  return (p, pt) => {
    if (pt[2] !== 0) return [pt[0] * scale, 0, pt[1] * scale];
    const half = (p - 1) / 2;
    const radius = (half * Math.SQRT2 + 2) * scale;
    const angle = infinityAngle(p, pt);
    return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
  };
}

// ── Data types ────────────────────────────────────────────

export interface EmbeddedPoint {
  proj: ProjectivePoint;
  pos: [number, number, number];
  isInfinity: boolean;
}

export class ProjectivePlane {
  readonly field: FiniteField;
  readonly embed: ProjectiveEmbedding;

  constructor(field: FiniteField, embed: ProjectiveEmbedding) {
    this.field = field;
    this.embed = embed;
  }

  /** Map a projective point to R³. */
  pointAt(pt: ProjectivePoint): [number, number, number];
  /** Map an affine point [x,y] (shorthand for [x:y:1]) to R³. */
  pointAt(x: number, y: number): [number, number, number];
  pointAt(a: ProjectivePoint | number, b?: number): [number, number, number] {
    if (typeof a === 'number') {
      return this.embed(this.field.p, [a, b!, 1]);
    }
    return this.embed(this.field.p, a);
  }

  /** All p²+p+1 projective points with their R³ positions. */
  allPoints(): EmbeddedPoint[] {
    const pts: EmbeddedPoint[] = [];
    for (const proj of this.field.projectivePoints()) {
      pts.push({
        proj,
        pos: this.embed(this.field.p, proj),
        isInfinity: proj[2] === 0,
      });
    }
    return pts;
  }
}
