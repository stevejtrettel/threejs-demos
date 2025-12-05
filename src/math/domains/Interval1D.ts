import { Domain1D, BoundaryType } from './types';

/**
 * 1D interval domain [tMin, tMax]
 *
 * The most common domain for curves.
 *
 * @example
 *   const domain = new Interval1D(0, 2 * Math.PI);
 *   domain.contains(Math.PI); // true
 *
 * @example
 *   // Periodic domain (like angle parameter)
 *   const domain = new Interval1D(0, 2 * Math.PI, { periodic: true });
 *   domain.wrap(3 * Math.PI); // π
 */
export class Interval1D implements Domain1D {
  readonly dim = 1 as const;

  constructor(
    public tMin: number,
    public tMax: number,
    public options: { periodic?: boolean } = {}
  ) {
    if (tMin >= tMax) {
      throw new Error(`Invalid interval: [${tMin}, ${tMax}]`);
    }
  }

  get periodic(): boolean {
    return this.options.periodic ?? false;
  }

  contains(t: number): boolean {
    if (this.periodic) {
      return true; // Periodic domains contain all values after wrapping
    }
    return t >= this.tMin && t <= this.tMax;
  }

  clamp(t: number): number {
    if (this.periodic) {
      return this.wrap(t);
    }
    return Math.max(this.tMin, Math.min(this.tMax, t));
  }

  wrap(t: number): number {
    if (!this.periodic) {
      return t;
    }
    const range = this.tMax - this.tMin;
    const normalized = ((t - this.tMin) % range + range) % range;
    return this.tMin + normalized;
  }

  getBoundaryTypes(): BoundaryType[] {
    return [this.periodic ? 'periodic' : 'closed'];
  }

  getBounds(): number[] {
    return [this.tMin, this.tMax];
  }

  sample(resolution: number): number[] {
    const samples: number[] = [];
    for (let i = 0; i < resolution; i++) {
      const t = this.tMin + (i / (resolution - 1)) * (this.tMax - this.tMin);
      samples.push(t);
    }
    return samples;
  }

  /**
   * Get the length of the interval
   */
  get length(): number {
    return this.tMax - this.tMin;
  }

  /**
   * Normalize a value to [0, 1]
   */
  normalize(t: number): number {
    return (t - this.tMin) / (this.tMax - this.tMin);
  }

  /**
   * Denormalize from [0, 1] to [tMin, tMax]
   */
  denormalize(t: number): number {
    return this.tMin + t * (this.tMax - this.tMin);
  }
}
