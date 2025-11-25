import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { DifferentiableScalarField2D } from './types';

/**
 * RippleFunction: A radial wave function with reactive parameters
 *
 * f(x, y) = amplitude * sin(frequency * r + phase)
 * where r = sqrt(x² + y²)
 *
 * Creates concentric circular ripples emanating from the origin.
 *
 * @example
 *   const ripple = new RippleFunction({
 *     amplitude: 1.0,
 *     frequency: 2.0,
 *     phase: 0
 *   });
 *
 *   const z = ripple.evaluate(1, 1);  // Height at (1, 1)
 */
export class RippleFunction implements DifferentiableScalarField2D, Parametric {
  readonly params = new Params(this);

  /**
   * Wave amplitude (height of peaks)
   */
  declare amplitude: number;

  /**
   * Wave frequency (number of ripples per unit distance)
   */
  declare frequency: number;

  /**
   * Wave phase offset (shifts the wave pattern)
   */
  declare phase: number;

  /**
   * Decay factor (how quickly amplitude decreases with distance)
   * If 0, no decay. If > 0, amplitude decays as 1/(1 + decay*r)
   */
  declare decay: number;

  constructor(options: {
    amplitude?: number;
    frequency?: number;
    phase?: number;
    decay?: number;
  } = {}) {
    this.params.define('amplitude', options.amplitude ?? 1.0, { triggers: 'rebuild' });
    this.params.define('frequency', options.frequency ?? 2.0, { triggers: 'rebuild' });
    this.params.define('phase', options.phase ?? 0, { triggers: 'rebuild' });
    this.params.define('decay', options.decay ?? 0, { triggers: 'rebuild' });
  }

  evaluate(u: number, v: number): number {
    const r = Math.sqrt(u * u + v * v);
    const decayFactor = this.decay > 0 ? 1 / (1 + this.decay * r) : 1;
    return this.amplitude * decayFactor * Math.sin(this.frequency * r + this.phase);
  }

  getDomain() {
    return {
      uMin: -3,
      uMax: 3,
      vMin: -3,
      vMax: 3
    };
  }

  computePartials(u: number, v: number): { du: number; dv: number } {
    const r = Math.sqrt(u * u + v * v);

    // Handle singularity at origin
    if (r < 1e-10) {
      return { du: 0, dv: 0 };
    }

    const decayFactor = this.decay > 0 ? 1 / (1 + this.decay * r) : 1;
    const cosArg = Math.cos(this.frequency * r + this.phase);

    // ∂f/∂u using chain rule
    // f = A * decay(r) * sin(freq * r + phase)
    // ∂f/∂u = A * [decay'(r) * sin(...) + decay(r) * cos(...) * freq] * (∂r/∂u)
    // where ∂r/∂u = u/r

    const drdU = u / r;
    const drdV = v / r;

    let du: number, dv: number;

    if (this.decay > 0) {
      const decayPrime = -this.decay / Math.pow(1 + this.decay * r, 2);
      const sinArg = Math.sin(this.frequency * r + this.phase);

      du =
        this.amplitude *
        (decayPrime * sinArg + decayFactor * cosArg * this.frequency) *
        drdU;

      dv =
        this.amplitude *
        (decayPrime * sinArg + decayFactor * cosArg * this.frequency) *
        drdV;
    } else {
      du = this.amplitude * this.frequency * cosArg * drdU;
      dv = this.amplitude * this.frequency * cosArg * drdV;
    }

    return { du, dv };
  }

  computeSecondPartials(u: number, v: number): {
    duu: number;
    duv: number;
    dvv: number;
  } {
    const r = Math.sqrt(u * u + v * v);

    // Handle singularity at origin
    if (r < 1e-10) {
      const baseValue = -this.amplitude * this.frequency * this.frequency / 2;
      return {
        duu: baseValue,
        duv: 0,
        dvv: baseValue
      };
    }

    // For simplicity with decay, use finite differences
    const h = 1e-6;

    const f_uu = this.evaluate(u + h, v);
    const f_ud = this.evaluate(u - h, v);
    const f_du = this.evaluate(u, v + h);
    const f_dd = this.evaluate(u, v - h);
    const f_00 = this.evaluate(u, v);

    const duu = (f_uu - 2 * f_00 + f_ud) / (h * h);
    const dvv = (f_du - 2 * f_00 + f_dd) / (h * h);

    const f_uu_corner = this.evaluate(u + h, v + h);
    const f_ud_corner = this.evaluate(u + h, v - h);
    const f_du_corner = this.evaluate(u - h, v + h);
    const f_dd_corner = this.evaluate(u - h, v - h);

    const duv = (f_uu_corner - f_ud_corner - f_du_corner + f_dd_corner) / (4 * h * h);

    return { duu, duv, dvv };
  }
}
