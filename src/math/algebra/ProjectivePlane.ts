/**
 * Projective plane P²(F_p): the affine plane F_p × F_p plus a point at infinity,
 * embedded into R³ via a chosen embedding function.
 *
 * Pure math — no Three.js dependency.
 */

import { FiniteField } from './finiteField';

export type Embedding = (p: number, pt: [number, number]) => [number, number, number];

/**
 * Standard donut torus embedding.
 * F_p is a circle, so F_p × F_p maps to a torus with major radius R=2, minor radius r=1.
 */
export const torusEmbedding: Embedding = (p, pt) => {
  const u = (2 * Math.PI * pt[0]) / p;
  const v = (2 * Math.PI * pt[1]) / p;
  const R = 2;
  const r = 1;
  const ring = r * Math.cos(u) + R;
  const x = ring * Math.cos(v);
  const y = ring * Math.sin(v);
  const z = r * Math.sin(u);
  return [x, -z, y];
};

/**
 * Flat grid embedding.
 * F_p laid out on a line, so F_p × F_p is a planar grid at y=0.
 */
export const gridEmbedding: Embedding = (_p, pt) => {
  return [pt[0], 0, pt[1]];
};

/** Grid embedding with custom spacing. */
export function scaledGridEmbedding(scale: number): Embedding {
  return (_p, pt) => [pt[0] * scale, 0, pt[1] * scale];
}

export interface EmbeddedPoint {
  fp: [number, number];
  pos: [number, number, number];
}

export class ProjectivePlane {
  readonly field: FiniteField;
  readonly embed: Embedding;

  constructor(field: FiniteField, embed: Embedding) {
    this.field = field;
    this.embed = embed;
  }

  /** Map a single F_p × F_p point to R³. */
  pointAt(x: number, y: number): [number, number, number] {
    return this.embed(this.field.p, [x, y]);
  }

  /** All p² affine points with their R³ positions. */
  allPoints(): EmbeddedPoint[] {
    const els = this.field.elements();
    const pts: EmbeddedPoint[] = [];
    for (const x of els) {
      for (const y of els) {
        pts.push({ fp: [x, y], pos: this.embed(this.field.p, [x, y]) });
      }
    }
    return pts;
  }
}
