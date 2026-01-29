/**
 * SurfaceMetricTensor.js - Metric tensors for curved surfaces
 *
 * For surfaces where distances scale based on position.
 * Includes factory functions for common curved geometries.
 */

import { Metric } from './Metric.js';

// ============================================================================
// CylinderMetricTensor - for [θ, y] parameterization
// ============================================================================

/**
 * Metric tensor for surfaces of revolution (cylinder-like)
 *
 * Coordinates: [θ, y] where θ is angular and y is height
 * Metric: ds² = scaleY(y)² dy² + scaleTheta(y)² dθ²
 *
 * Uses midpoint approximation for the scaling factors.
 */
export class CylinderMetricTensor extends Metric {
    /**
     * @param {number} period - period of θ coordinate (usually 2π)
     * @param {Function} scaleTheta - function(y) → scaling for θ direction
     * @param {Function} scaleY - function(y) → scaling for y direction (default: 1)
     */
    constructor(period, scaleTheta, scaleY = () => 1) {
        super();
        this.period = period;
        this.scaleTheta = scaleTheta;
        this.scaleY = scaleY;
    }

    distance(a, b) {
        // a, b are [θ, y] coordinates
        let dTheta = b[0] - a[0];

        // Handle periodicity in θ
        while (dTheta > this.period / 2) dTheta -= this.period;
        while (dTheta < -this.period / 2) dTheta += this.period;

        const dY = b[1] - a[1];

        // Midpoint y for scaling
        const yMid = (a[1] + b[1]) / 2;
        const sTheta = this.scaleTheta(yMid);
        const sY = this.scaleY(yMid);

        return Math.hypot(sTheta * dTheta, sY * dY);
    }

    localArea(coord, dTheta, dY) {
        const y = coord[1];
        return this.scaleTheta(y) * dTheta * this.scaleY(y) * dY;
    }
}

// ============================================================================
// SurfaceMetricTensor - for R³ embedded surfaces
// ============================================================================

/**
 * General R³ metric tensor for surfaces embedded in 3D
 *
 * Coordinates are [x, y, z] in R³, but we measure distance using a metric
 * that scales horizontal (xz-plane) and vertical (y) differently based on y.
 *
 * This is for surfaces like hyperbolic cylinders where the reference
 * is already embedded as a cylinder in R³.
 */
export class SurfaceMetricTensor extends Metric {
    /**
     * @param {Function} scaleHoriz - function(y) → scaling for horizontal (xz) distance
     * @param {Function} scaleVert - function(y) → scaling for vertical (y) distance
     */
    constructor(scaleHoriz, scaleVert = () => 1) {
        super();
        this.scaleHoriz = scaleHoriz;
        this.scaleVert = scaleVert;
    }

    distance(a, b) {
        // a, b are [x, y, z] coordinates
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];

        const dHoriz = Math.hypot(dx, dz);  // horizontal distance in xz-plane

        // Midpoint y for scaling
        const yMid = (a[1] + b[1]) / 2;
        const sH = this.scaleHoriz(yMid);
        const sV = this.scaleVert(yMid);

        return Math.hypot(sH * dHoriz, sV * dy);
    }

    localArea(coord, dHoriz, dVert) {
        const y = coord[1];
        return this.scaleHoriz(y) * dHoriz * this.scaleVert(y) * dVert;
    }
}

// ============================================================================
// Factory functions for common metrics
// ============================================================================

/**
 * Hyperbolic cylinder metric: horizontal distances scale by cosh(λy)
 */
export function hyperbolicCylinderMetric(lambda, height) {
    const scaleHoriz = (y) => Math.cosh(lambda * y / height);
    return new SurfaceMetricTensor(scaleHoriz);
}

/**
 * Schwarzschild (black hole) metric on a cylinder
 *
 * Metric tensor: ds² = α(u)² du² + β(u)² dθ²
 * where α(u) = 1/(1 - R/u) and β(u) = u/√(1 - R/u)
 *
 * u is the radial coordinate (stored in y), R is Schwarzschild radius
 */
export function schwarzschildMetric(R) {
    const alpha = (u) => 1 / (1 - R / u);
    const beta = (u) => u / Math.sqrt(1 - R / u);

    return new SurfaceMetricTensor(beta, alpha);
}

/**
 * Hyperbolic strip metric: a strip of constant width around a geodesic
 *
 * In Fermi coordinates around a geodesic in the hyperbolic plane:
 *   ds² = cosh²(y) dx² + dy²
 *
 * where x is arc length along the geodesic and y is signed distance from it.
 * The parameter lambda controls how quickly distances scale (curvature scaling).
 *
 * @param {number} lambda - curvature scaling (default 1 for standard H²)
 * @param {number} halfWidth - half-width of strip (for normalizing y to [-1,1] → [-halfWidth, halfWidth])
 */
export function hyperbolicStripMetric(lambda = 1, halfWidth = 1) {
    // Scale y so that y in [-halfWidth, halfWidth] maps to effective hyperbolic distance
    const scaleHoriz = (y) => Math.cosh(lambda * y / halfWidth);
    return new SurfaceMetricTensor(scaleHoriz);
}

