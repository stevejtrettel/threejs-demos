import { Domain2D, BoundaryType } from './types';

/**
 * Circular disk domain { (u, v) : u² + v² ≤ r² }
 *
 * Useful for surfaces like spherical caps, radial functions, etc.
 *
 * @example
 *   // Unit disk centered at origin
 *   const domain = new Disk2D();
 *
 * @example
 *   // Disk of radius 2, centered at (1, 1)
 *   const domain = new Disk2D({ radius: 2, centerU: 1, centerV: 1 });
 *
 * @example
 *   // Annulus (disk with hole)
 *   const domain = new Disk2D({ outerRadius: 2, innerRadius: 1 });
 */
export class Disk2D implements Domain2D {
  readonly dim = 2 as const;

  public centerU: number;
  public centerV: number;
  public outerRadius: number;
  public innerRadius: number;

  constructor(options: {
    radius?: number;
    outerRadius?: number;
    innerRadius?: number;
    centerU?: number;
    centerV?: number;
  } = {}) {
    this.centerU = options.centerU ?? 0;
    this.centerV = options.centerV ?? 0;

    // Support both 'radius' (for simple disk) and 'outerRadius/innerRadius' (for annulus)
    if (options.radius !== undefined) {
      this.outerRadius = options.radius;
      this.innerRadius = 0;
    } else {
      this.outerRadius = options.outerRadius ?? 1;
      this.innerRadius = options.innerRadius ?? 0;
    }

    if (this.innerRadius < 0 || this.outerRadius <= 0) {
      throw new Error('Invalid disk radii');
    }
    if (this.innerRadius >= this.outerRadius) {
      throw new Error('Inner radius must be less than outer radius');
    }
  }

  contains(u: number, v: number): boolean {
    const du = u - this.centerU;
    const dv = v - this.centerV;
    const r2 = du * du + dv * dv;
    return r2 >= this.innerRadius * this.innerRadius &&
           r2 <= this.outerRadius * this.outerRadius;
  }

  clamp(u: number, v: number): [number, number] {
    const du = u - this.centerU;
    const dv = v - this.centerV;
    const r = Math.sqrt(du * du + dv * dv);

    if (r < this.innerRadius) {
      // Clamp to inner radius
      const scale = this.innerRadius / r;
      return [
        this.centerU + du * scale,
        this.centerV + dv * scale
      ];
    } else if (r > this.outerRadius) {
      // Clamp to outer radius
      const scale = this.outerRadius / r;
      return [
        this.centerU + du * scale,
        this.centerV + dv * scale
      ];
    }

    return [u, v];
  }

  wrap(u: number, v: number): [number, number] {
    // No natural wrapping for disk domains
    return this.clamp(u, v);
  }

  getBoundaryTypes(): BoundaryType[] {
    return ['closed', 'closed'];
  }

  getBounds(): number[] {
    return [
      this.centerU - this.outerRadius,
      this.centerU + this.outerRadius,
      this.centerV - this.outerRadius,
      this.centerV + this.outerRadius
    ];
  }

  sample(resolution: [number, number]): Array<[number, number]> {
    const [radialRes, angularRes] = resolution;
    const samples: Array<[number, number]> = [];

    // Sample in polar coordinates
    for (let i = 0; i < radialRes; i++) {
      const r = this.innerRadius + (i / (radialRes - 1)) * (this.outerRadius - this.innerRadius);
      for (let j = 0; j < angularRes; j++) {
        const theta = (j / angularRes) * 2 * Math.PI;
        const u = this.centerU + r * Math.cos(theta);
        const v = this.centerV + r * Math.sin(theta);
        samples.push([u, v]);
      }
    }

    return samples;
  }

  getBoundaries(): Array<Array<[number, number]>> {
    const boundaries: Array<Array<[number, number]>> = [];
    const resolution = 100;

    // Outer boundary
    const outer: Array<[number, number]> = [];
    for (let i = 0; i <= resolution; i++) {
      const theta = (i / resolution) * 2 * Math.PI;
      const u = this.centerU + this.outerRadius * Math.cos(theta);
      const v = this.centerV + this.outerRadius * Math.sin(theta);
      outer.push([u, v]);
    }
    boundaries.push(outer);

    // Inner boundary (if annulus)
    if (this.innerRadius > 0) {
      const inner: Array<[number, number]> = [];
      for (let i = 0; i <= resolution; i++) {
        const theta = (i / resolution) * 2 * Math.PI;
        const u = this.centerU + this.innerRadius * Math.cos(theta);
        const v = this.centerV + this.innerRadius * Math.sin(theta);
        inner.push([u, v]);
      }
      boundaries.push(inner);
    }

    return boundaries;
  }

  /**
   * Convert to polar coordinates relative to center
   */
  toPolar(u: number, v: number): { r: number; theta: number } {
    const du = u - this.centerU;
    const dv = v - this.centerV;
    return {
      r: Math.sqrt(du * du + dv * dv),
      theta: Math.atan2(dv, du)
    };
  }

  /**
   * Convert from polar coordinates to Cartesian
   */
  fromPolar(r: number, theta: number): [number, number] {
    return [
      this.centerU + r * Math.cos(theta),
      this.centerV + r * Math.sin(theta)
    ];
  }

  /**
   * Get signed distance to domain boundary
   * Negative inside, positive outside
   */
  signedDistance(u: number, v: number): number {
    const du = u - this.centerU;
    const dv = v - this.centerV;
    const r = Math.sqrt(du * du + dv * dv);

    if (this.innerRadius > 0) {
      // Annulus: distance to closest boundary
      const distToOuter = r - this.outerRadius;
      const distToInner = this.innerRadius - r;
      if (r < this.innerRadius) {
        return distToInner; // Outside (inside inner circle)
      } else if (r > this.outerRadius) {
        return distToOuter; // Outside (outside outer circle)
      } else {
        return -Math.min(r - this.innerRadius, this.outerRadius - r); // Inside
      }
    } else {
      // Simple disk
      return r - this.outerRadius;
    }
  }
}
