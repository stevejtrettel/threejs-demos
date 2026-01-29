/**
 * EuclideanMetric.js - Standard Euclidean distance
 *
 * Works in R², R³, or any dimension.
 * Simply computes sqrt(sum of squared coordinate differences).
 */

import { Metric } from './Metric.js';

export class EuclideanMetric extends Metric {
    distance(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const d = b[i] - a[i];
            sum += d * d;
        }
        return Math.sqrt(sum);
    }

    localArea(coord, du, dv) {
        return du * dv;  // Euclidean area is just du * dv
    }
}
