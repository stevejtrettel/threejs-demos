/**
 * PeriodicMetric.js - Euclidean metric with periodic wrapping
 *
 * For cylinders with flat parameterization where one or more
 * coordinates wrap around (e.g., angle θ with period 2π).
 */

import { Metric } from './Metric.js';

export class PeriodicMetric extends Metric {
    /**
     * @param {Object} periods - which axes wrap and with what period
     *   e.g., { 0: 2*Math.PI } means axis 0 wraps with period 2π
     */
    constructor(periods = {}) {
        super();
        this.periods = periods;
    }

    distance(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            let d = b[i] - a[i];

            // Handle periodicity
            if (this.periods[i] !== undefined) {
                const period = this.periods[i];
                // Wrap to [-period/2, period/2]
                while (d > period / 2) d -= period;
                while (d < -period / 2) d += period;
            }

            sum += d * d;
        }
        return Math.sqrt(sum);
    }

    localArea(coord, du, dv) {
        // Periodic wrapping doesn't affect local area - same as Euclidean
        return du * dv;
    }
}
