import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import { ScalarField2D, type SurfaceDomainLite, type Hessian2D } from './ScalarField2D';

/**
 * RippleFunction: A radial wave function with reactive parameters
 *
 * f(u, v) = amplitude * sin(frequency * r + phase)    where r = √(u² + v²)
 *
 * Authored in 2D via `ScalarField2D`; the n-D `DifferentiableScalarField`
 * interface is provided automatically by the base class.
 */
export class RippleFunction extends ScalarField2D implements Parametric {
  readonly params = new Params(this);

  declare amplitude: number;
  declare frequency: number;
  declare phase: number;
  declare decay: number;

  constructor(options: {
    amplitude?: number;
    frequency?: number;
    phase?: number;
    decay?: number;
  } = {}) {
    super();
    this.params.define('amplitude', options.amplitude ?? 1.0, { triggers: 'rebuild' });
    this.params.define('frequency', options.frequency ?? 2.0, { triggers: 'rebuild' });
    this.params.define('phase', options.phase ?? 0, { triggers: 'rebuild' });
    this.params.define('decay', options.decay ?? 0, { triggers: 'rebuild' });
  }

  evaluateAt(u: number, v: number): number {
    const r = Math.sqrt(u * u + v * v);
    const decayFactor = this.decay > 0 ? 1 / (1 + this.decay * r) : 1;
    return this.amplitude * decayFactor * Math.sin(this.frequency * r + this.phase);
  }

  domain2D(): SurfaceDomainLite {
    return { uMin: -3, uMax: 3, vMin: -3, vMax: 3 };
  }

  partialsAt(u: number, v: number): [number, number] {
    const r = Math.sqrt(u * u + v * v);
    if (r < 1e-10) return [0, 0];

    const decayFactor = this.decay > 0 ? 1 / (1 + this.decay * r) : 1;
    const cosArg = Math.cos(this.frequency * r + this.phase);
    const drdU = u / r;
    const drdV = v / r;

    if (this.decay > 0) {
      const decayPrime = -this.decay / Math.pow(1 + this.decay * r, 2);
      const sinArg = Math.sin(this.frequency * r + this.phase);
      const common =
        this.amplitude * (decayPrime * sinArg + decayFactor * cosArg * this.frequency);
      return [common * drdU, common * drdV];
    } else {
      const common = this.amplitude * this.frequency * cosArg;
      return [common * drdU, common * drdV];
    }
  }

  hessianAt(u: number, v: number): Hessian2D {
    const r = Math.sqrt(u * u + v * v);
    if (r < 1e-10) {
      const baseValue = -this.amplitude * this.frequency * this.frequency / 2;
      return [baseValue, 0, baseValue];
    }
    // FD on evaluateAt — matches the original routine.
    const h = 1e-6;
    const f_00 = this.evaluateAt(u, v);
    const f_pu = this.evaluateAt(u + h, v);
    const f_mu = this.evaluateAt(u - h, v);
    const f_pv = this.evaluateAt(u, v + h);
    const f_mv = this.evaluateAt(u, v - h);
    const duu = (f_pu - 2 * f_00 + f_mu) / (h * h);
    const dvv = (f_pv - 2 * f_00 + f_mv) / (h * h);

    const f_pp = this.evaluateAt(u + h, v + h);
    const f_pm = this.evaluateAt(u + h, v - h);
    const f_mp = this.evaluateAt(u - h, v + h);
    const f_mm = this.evaluateAt(u - h, v - h);
    const duv = (f_pp - f_pm - f_mp + f_mm) / (4 * h * h);

    return [duu, duv, dvv];
  }
}
