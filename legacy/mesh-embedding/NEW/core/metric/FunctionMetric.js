/**
 * FunctionMetric.js - Metric from a custom distance function
 *
 * A simple metric wrapper that delegates to a provided distance function.
 * Used with createTriangleTiling which returns a distanceFn for the
 * appropriate geometry (Euclidean, spherical, or hyperbolic).
 */

import { Metric } from './Metric.js';

export class FunctionMetric extends Metric {
    /**
     * @param {Function} distanceFn - (a, b) => distance between coordinates
     */
    constructor(distanceFn) {
        super();
        this.distanceFn = distanceFn;
    }

    distance(a, b) {
        return this.distanceFn(a, b);
    }

    localArea(coord, du, dv) {
        // Approximate - exact formula depends on the specific geometry
        return du * dv;
    }
}
