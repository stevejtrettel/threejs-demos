import { Domain2D, BoundaryType, ImplicitDomain2D } from './types';

/**
 * Arbitrary 2D domain defined by a predicate function
 *
 * Maximum flexibility - define any domain shape you want.
 * Just provide a function that returns true if (u, v) is in the domain.
 *
 * @example
 *   // Triangle domain
 *   const triangle = new Implicit2D({
 *     predicate: (u, v) => u >= 0 && v >= 0 && u + v <= 1,
 *     bounds: [0, 1, 0, 1]
 *   });
 *
 * @example
 *   // Heart-shaped domain
 *   const heart = new Implicit2D({
 *     predicate: (u, v) => {
 *       const x = u, y = v;
 *       return Math.pow(x*x + y*y - 1, 3) - x*x*y*y*y <= 0;
 *     },
 *     bounds: [-2, 2, -2, 2]
 *   });
 *
 * @example
 *   // Union of two disks
 *   const lemniscate = new Implicit2D({
 *     predicate: (u, v) => {
 *       const d1 = (u - 1)*(u - 1) + v*v;
 *       const d2 = (u + 1)*(u + 1) + v*v;
 *       return d1 <= 1 || d2 <= 1;
 *     },
 *     bounds: [-2, 2, -1, 1]
 *   });
 */
export class Implicit2D implements ImplicitDomain2D {
  readonly dim = 2 as const;

  public predicate: (u: number, v: number) => boolean;
  public signedDistance?: (u: number, v: number) => number;
  private bounds: [number, number, number, number];

  constructor(options: {
    predicate: (u: number, v: number) => boolean;
    bounds: [number, number, number, number]; // [uMin, uMax, vMin, vMax]
    signedDistance?: (u: number, v: number) => number;
  }) {
    this.predicate = options.predicate;
    this.bounds = options.bounds;
    this.signedDistance = options.signedDistance;
  }

  contains(u: number, v: number): boolean {
    return this.predicate(u, v);
  }

  clamp(u: number, v: number): [number, number] {
    // For implicit domains, clamping is not well-defined
    // We can clamp to bounding box
    const [uMin, uMax, vMin, vMax] = this.bounds;
    return [
      Math.max(uMin, Math.min(uMax, u)),
      Math.max(vMin, Math.min(vMax, v))
    ];
  }

  wrap(u: number, v: number): [number, number] {
    // No natural wrapping for implicit domains
    return [u, v];
  }

  getBoundaryTypes(): BoundaryType[] {
    return ['closed', 'closed'];
  }

  getBounds(): number[] {
    return [...this.bounds];
  }

  sample(resolution: [number, number]): Array<[number, number]> {
    const [uRes, vRes] = resolution;
    const [uMin, uMax, vMin, vMax] = this.bounds;
    const samples: Array<[number, number]> = [];

    for (let i = 0; i < uRes; i++) {
      for (let j = 0; j < vRes; j++) {
        const u = uMin + (i / (uRes - 1)) * (uMax - uMin);
        const v = vMin + (j / (vRes - 1)) * (vMax - vMin);
        if (this.contains(u, v)) {
          samples.push([u, v]);
        }
      }
    }

    return samples;
  }

  getBoundaries(): Array<Array<[number, number]>> {
    // Boundary extraction for implicit domains is complex
    // Would require marching squares or similar algorithm
    // For now, return empty array
    // TODO: Implement boundary extraction using marching squares
    return [];
  }

  /**
   * Create a triangular domain
   */
  static triangle(
    p1: [number, number],
    p2: [number, number],
    p3: [number, number]
  ): Implicit2D {
    const sign = (u: number, v: number, a: [number, number], b: [number, number]): number => {
      return (u - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (v - b[1]);
    };

    return new Implicit2D({
      predicate: (u, v) => {
        const d1 = sign(u, v, p1, p2);
        const d2 = sign(u, v, p2, p3);
        const d3 = sign(u, v, p3, p1);
        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(hasNeg && hasPos);
      },
      bounds: [
        Math.min(p1[0], p2[0], p3[0]),
        Math.max(p1[0], p2[0], p3[0]),
        Math.min(p1[1], p2[1], p3[1]),
        Math.max(p1[1], p2[1], p3[1])
      ]
    });
  }

  /**
   * Create a polygonal domain
   */
  static polygon(vertices: Array<[number, number]>): Implicit2D {
    if (vertices.length < 3) {
      throw new Error('Polygon must have at least 3 vertices');
    }

    // Point-in-polygon using ray casting algorithm
    const predicate = (u: number, v: number): boolean => {
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [xi, yi] = vertices[i];
        const [xj, yj] = vertices[j];

        const intersect = ((yi > v) !== (yj > v)) &&
          (u < (xj - xi) * (v - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const uCoords = vertices.map(v => v[0]);
    const vCoords = vertices.map(v => v[1]);

    return new Implicit2D({
      predicate,
      bounds: [
        Math.min(...uCoords),
        Math.max(...uCoords),
        Math.min(...vCoords),
        Math.max(...vCoords)
      ]
    });
  }

  /**
   * Create union of two domains
   */
  static union(a: Domain2D, b: Domain2D): Implicit2D {
    const aBounds = a.getBounds();
    const bBounds = b.getBounds();

    return new Implicit2D({
      predicate: (u, v) => a.contains(u, v) || b.contains(u, v),
      bounds: [
        Math.min(aBounds[0], bBounds[0]),
        Math.max(aBounds[1], bBounds[1]),
        Math.min(aBounds[2], bBounds[2]),
        Math.max(aBounds[3], bBounds[3])
      ]
    });
  }

  /**
   * Create intersection of two domains
   */
  static intersection(a: Domain2D, b: Domain2D): Implicit2D {
    const aBounds = a.getBounds();
    const bBounds = b.getBounds();

    return new Implicit2D({
      predicate: (u, v) => a.contains(u, v) && b.contains(u, v),
      bounds: [
        Math.max(aBounds[0], bBounds[0]),
        Math.min(aBounds[1], bBounds[1]),
        Math.max(aBounds[2], bBounds[2]),
        Math.min(aBounds[3], bBounds[3])
      ]
    });
  }

  /**
   * Create difference of two domains (a minus b)
   */
  static difference(a: Domain2D, b: Domain2D): Implicit2D {
    const aBounds = a.getBounds();

    return new Implicit2D({
      predicate: (u, v) => a.contains(u, v) && !b.contains(u, v),
      bounds: aBounds as [number, number, number, number]
    });
  }
}
