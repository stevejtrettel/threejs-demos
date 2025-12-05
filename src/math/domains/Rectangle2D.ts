import { Domain2D, BoundaryType } from './types';

/**
 * Rectangular 2D domain [uMin, uMax] × [vMin, vMax]
 *
 * The most common domain for surfaces. Supports periodic boundaries
 * (useful for torus, cylinder, etc.)
 *
 * @example
 *   // Simple rectangle
 *   const domain = new Rectangle2D({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });
 *
 * @example
 *   // Torus domain (both dimensions periodic)
 *   const domain = new Rectangle2D({
 *     uMin: 0, uMax: 2 * Math.PI,
 *     vMin: 0, vMax: 2 * Math.PI,
 *     periodicU: true,
 *     periodicV: true
 *   });
 *
 * @example
 *   // Cylinder domain (u periodic, v bounded)
 *   const domain = new Rectangle2D({
 *     uMin: 0, uMax: 2 * Math.PI,
 *     vMin: 0, vMax: 1,
 *     periodicU: true
 *   });
 */
export class Rectangle2D implements Domain2D {
  readonly dim = 2 as const;

  public uMin: number;
  public uMax: number;
  public vMin: number;
  public vMax: number;
  public periodicU: boolean;
  public periodicV: boolean;

  constructor(options: {
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
    periodicU?: boolean;
    periodicV?: boolean;
  }) {
    this.uMin = options.uMin;
    this.uMax = options.uMax;
    this.vMin = options.vMin;
    this.vMax = options.vMax;
    this.periodicU = options.periodicU ?? false;
    this.periodicV = options.periodicV ?? false;

    if (this.uMin >= this.uMax || this.vMin >= this.vMax) {
      throw new Error('Invalid rectangle domain: min must be less than max');
    }
  }

  contains(u: number, v: number): boolean {
    const uOk = this.periodicU || (u >= this.uMin && u <= this.uMax);
    const vOk = this.periodicV || (v >= this.vMin && v <= this.vMax);
    return uOk && vOk;
  }

  clamp(u: number, v: number): [number, number] {
    const uClamped = this.periodicU ? this.wrapU(u) : Math.max(this.uMin, Math.min(this.uMax, u));
    const vClamped = this.periodicV ? this.wrapV(v) : Math.max(this.vMin, Math.min(this.vMax, v));
    return [uClamped, vClamped];
  }

  wrap(u: number, v: number): [number, number] {
    return [this.wrapU(u), this.wrapV(v)];
  }

  private wrapU(u: number): number {
    if (!this.periodicU) return u;
    const range = this.uMax - this.uMin;
    const normalized = ((u - this.uMin) % range + range) % range;
    return this.uMin + normalized;
  }

  private wrapV(v: number): number {
    if (!this.periodicV) return v;
    const range = this.vMax - this.vMin;
    const normalized = ((v - this.vMin) % range + range) % range;
    return this.vMin + normalized;
  }

  getBoundaryTypes(): BoundaryType[] {
    return [
      this.periodicU ? 'periodic' : 'closed',
      this.periodicV ? 'periodic' : 'closed'
    ];
  }

  getBounds(): number[] {
    return [this.uMin, this.uMax, this.vMin, this.vMax];
  }

  sample(resolution: [number, number]): Array<[number, number]> {
    const [uRes, vRes] = resolution;
    const samples: Array<[number, number]> = [];

    for (let i = 0; i < uRes; i++) {
      for (let j = 0; j < vRes; j++) {
        const u = this.uMin + (i / (uRes - 1)) * (this.uMax - this.uMin);
        const v = this.vMin + (j / (vRes - 1)) * (this.vMax - this.vMin);
        samples.push([u, v]);
      }
    }

    return samples;
  }

  getBoundaries(): Array<Array<[number, number]>> {
    const boundaries: Array<Array<[number, number]>> = [];
    const resolution = 100;

    // Don't add boundaries for periodic dimensions
    if (!this.periodicU) {
      // Left boundary (u = uMin)
      const left: Array<[number, number]> = [];
      for (let i = 0; i <= resolution; i++) {
        const v = this.vMin + (i / resolution) * (this.vMax - this.vMin);
        left.push([this.uMin, v]);
      }
      boundaries.push(left);

      // Right boundary (u = uMax)
      const right: Array<[number, number]> = [];
      for (let i = 0; i <= resolution; i++) {
        const v = this.vMin + (i / resolution) * (this.vMax - this.vMin);
        right.push([this.uMax, v]);
      }
      boundaries.push(right);
    }

    if (!this.periodicV) {
      // Bottom boundary (v = vMin)
      const bottom: Array<[number, number]> = [];
      for (let i = 0; i <= resolution; i++) {
        const u = this.uMin + (i / resolution) * (this.uMax - this.uMin);
        bottom.push([u, this.vMin]);
      }
      boundaries.push(bottom);

      // Top boundary (v = vMax)
      const top: Array<[number, number]> = [];
      for (let i = 0; i <= resolution; i++) {
        const u = this.uMin + (i / resolution) * (this.uMax - this.uMin);
        top.push([u, this.vMax]);
      }
      boundaries.push(top);
    }

    return boundaries;
  }

  /**
   * Get width and height
   */
  get width(): number {
    return this.uMax - this.uMin;
  }

  get height(): number {
    return this.vMax - this.vMin;
  }

  /**
   * Get area
   */
  get area(): number {
    return this.width * this.height;
  }

  /**
   * Normalize coordinates to [0, 1]²
   */
  normalize(u: number, v: number): [number, number] {
    return [
      (u - this.uMin) / this.width,
      (v - this.vMin) / this.height
    ];
  }

  /**
   * Denormalize from [0, 1]² to domain
   */
  denormalize(u: number, v: number): [number, number] {
    return [
      this.uMin + u * this.width,
      this.vMin + v * this.height
    ];
  }
}
