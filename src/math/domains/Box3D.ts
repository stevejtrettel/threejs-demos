import { Domain3D, BoundaryType } from './types';

/**
 * Rectangular 3D box domain [uMin, uMax] × [vMin, vMax] × [wMin, wMax]
 *
 * Used for volumetric data, 3D scalar fields, etc.
 *
 * @example
 *   // Unit cube
 *   const domain = new Box3D({
 *     uMin: 0, uMax: 1,
 *     vMin: 0, vMax: 1,
 *     wMin: 0, wMax: 1
 *   });
 *
 * @example
 *   // Periodic in one dimension (like a 3D torus)
 *   const domain = new Box3D({
 *     uMin: 0, uMax: 2 * Math.PI,
 *     vMin: 0, vMax: 2 * Math.PI,
 *     wMin: 0, wMax: 1,
 *     periodicU: true,
 *     periodicV: true
 *   });
 */
export class Box3D implements Domain3D {
  readonly dim = 3 as const;

  public uMin: number;
  public uMax: number;
  public vMin: number;
  public vMax: number;
  public wMin: number;
  public wMax: number;
  public periodicU: boolean;
  public periodicV: boolean;
  public periodicW: boolean;

  constructor(options: {
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
    wMin: number;
    wMax: number;
    periodicU?: boolean;
    periodicV?: boolean;
    periodicW?: boolean;
  }) {
    this.uMin = options.uMin;
    this.uMax = options.uMax;
    this.vMin = options.vMin;
    this.vMax = options.vMax;
    this.wMin = options.wMin;
    this.wMax = options.wMax;
    this.periodicU = options.periodicU ?? false;
    this.periodicV = options.periodicV ?? false;
    this.periodicW = options.periodicW ?? false;

    if (this.uMin >= this.uMax || this.vMin >= this.vMax || this.wMin >= this.wMax) {
      throw new Error('Invalid box domain: min must be less than max');
    }
  }

  contains(u: number, v: number, w: number): boolean {
    const uOk = this.periodicU || (u >= this.uMin && u <= this.uMax);
    const vOk = this.periodicV || (v >= this.vMin && v <= this.vMax);
    const wOk = this.periodicW || (w >= this.wMin && w <= this.wMax);
    return uOk && vOk && wOk;
  }

  clamp(u: number, v: number, w: number): [number, number, number] {
    const uClamped = this.periodicU ? this.wrapU(u) : Math.max(this.uMin, Math.min(this.uMax, u));
    const vClamped = this.periodicV ? this.wrapV(v) : Math.max(this.vMin, Math.min(this.vMax, v));
    const wClamped = this.periodicW ? this.wrapW(w) : Math.max(this.wMin, Math.min(this.wMax, w));
    return [uClamped, vClamped, wClamped];
  }

  wrap(u: number, v: number, w: number): [number, number, number] {
    return [this.wrapU(u), this.wrapV(v), this.wrapW(w)];
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

  private wrapW(w: number): number {
    if (!this.periodicW) return w;
    const range = this.wMax - this.wMin;
    const normalized = ((w - this.wMin) % range + range) % range;
    return this.wMin + normalized;
  }

  getBoundaryTypes(): BoundaryType[] {
    return [
      this.periodicU ? 'periodic' : 'closed',
      this.periodicV ? 'periodic' : 'closed',
      this.periodicW ? 'periodic' : 'closed'
    ];
  }

  getBounds(): number[] {
    return [this.uMin, this.uMax, this.vMin, this.vMax, this.wMin, this.wMax];
  }

  sample(resolution: [number, number, number]): Array<[number, number, number]> {
    const [uRes, vRes, wRes] = resolution;
    const samples: Array<[number, number, number]> = [];

    for (let i = 0; i < uRes; i++) {
      for (let j = 0; j < vRes; j++) {
        for (let k = 0; k < wRes; k++) {
          const u = this.uMin + (i / (uRes - 1)) * (this.uMax - this.uMin);
          const v = this.vMin + (j / (vRes - 1)) * (this.vMax - this.vMin);
          const w = this.wMin + (k / (wRes - 1)) * (this.wMax - this.wMin);
          samples.push([u, v, w]);
        }
      }
    }

    return samples;
  }

  /**
   * Get dimensions
   */
  get width(): number {
    return this.uMax - this.uMin;
  }

  get height(): number {
    return this.vMax - this.vMin;
  }

  get depth(): number {
    return this.wMax - this.wMin;
  }

  /**
   * Get volume
   */
  get volume(): number {
    return this.width * this.height * this.depth;
  }

  /**
   * Normalize coordinates to [0, 1]³
   */
  normalize(u: number, v: number, w: number): [number, number, number] {
    return [
      (u - this.uMin) / this.width,
      (v - this.vMin) / this.height,
      (w - this.wMin) / this.depth
    ];
  }

  /**
   * Denormalize from [0, 1]³ to domain
   */
  denormalize(u: number, v: number, w: number): [number, number, number] {
    return [
      this.uMin + u * this.width,
      this.vMin + v * this.height,
      this.wMin + w * this.depth
    ];
  }
}
