/**
 * smoothCurve.ts - Curve smoothing utilities
 *
 * Functions for smoothing noisy point sequences, particularly useful
 * for boundary curves extracted from meshes.
 */

import { Vector3 } from 'three';

/**
 * Smoothing method options
 */
export type SmoothingMethod = 'laplacian' | 'chaikin' | 'resample';

/**
 * Options for curve smoothing
 */
export interface SmoothCurveOptions {
    /** Smoothing method to use */
    method?: SmoothingMethod;
    /** Number of iterations (for laplacian and chaikin) */
    iterations?: number;
    /** Smoothing factor 0-1 (for laplacian, higher = more smoothing) */
    factor?: number;
    /** Number of output samples (for resample method) */
    numSamples?: number;
    /** Whether the curve is closed (default: true for boundary loops) */
    closed?: boolean;
}

/**
 * Smooth a curve using Laplacian smoothing
 *
 * Each point is moved toward the average of its neighbors.
 * This is an iterative relaxation that preserves overall shape
 * while reducing local noise.
 *
 * @param points - Input point array
 * @param iterations - Number of smoothing passes (default: 3)
 * @param factor - How much to move toward average, 0-1 (default: 0.5)
 * @param closed - Whether the curve is closed (default: true)
 * @returns Smoothed point array
 *
 * @example
 * const smooth = laplacianSmooth(boundaryLoop, 5, 0.5);
 */
export function laplacianSmooth(
    points: Vector3[],
    iterations = 3,
    factor = 0.5,
    closed = true
): Vector3[] {
    if (points.length < 3) return points.map(p => p.clone());

    let result = points.map(p => p.clone());
    const n = result.length;

    for (let iter = 0; iter < iterations; iter++) {
        const smoothed: Vector3[] = [];

        for (let i = 0; i < n; i++) {
            const curr = result[i];

            if (closed || (i > 0 && i < n - 1)) {
                const prevIdx = closed ? (i - 1 + n) % n : i - 1;
                const nextIdx = closed ? (i + 1) % n : i + 1;
                const prev = result[prevIdx];
                const next = result[nextIdx];

                // Average of neighbors
                const avg = new Vector3().addVectors(prev, next).multiplyScalar(0.5);
                // Lerp toward average
                smoothed.push(curr.clone().lerp(avg, factor));
            } else {
                // Keep endpoints fixed for open curves
                smoothed.push(curr.clone());
            }
        }

        result = smoothed;
    }

    return result;
}

/**
 * Smooth a curve using Chaikin's corner cutting algorithm
 *
 * Subdivides by cutting corners at 1/4 and 3/4 points along each edge.
 * Creates progressively smoother curves with more points.
 * Converges to a quadratic B-spline.
 *
 * @param points - Input point array
 * @param iterations - Number of subdivision passes (default: 2)
 * @param closed - Whether the curve is closed (default: true)
 * @returns Smoothed point array (note: point count increases with iterations)
 *
 * @example
 * const smooth = chaikinSmooth(boundaryLoop, 3);
 */
export function chaikinSmooth(
    points: Vector3[],
    iterations = 2,
    closed = true
): Vector3[] {
    if (points.length < 2) return points.map(p => p.clone());

    let result = points.map(p => p.clone());

    for (let iter = 0; iter < iterations; iter++) {
        const newPoints: Vector3[] = [];
        const n = result.length;
        const limit = closed ? n : n - 1;

        for (let i = 0; i < limit; i++) {
            const p0 = result[i];
            const p1 = result[(i + 1) % n];

            // Cut at 1/4 and 3/4
            newPoints.push(p0.clone().lerp(p1, 0.25));
            newPoints.push(p0.clone().lerp(p1, 0.75));
        }

        if (!closed && result.length > 0) {
            // For open curves, keep the endpoints
            newPoints.unshift(result[0].clone());
            newPoints.push(result[result.length - 1].clone());
        }

        result = newPoints;
    }

    return result;
}

/**
 * Resample a curve at uniform arc-length intervals
 *
 * Uses CatmullRom interpolation to create evenly-spaced points.
 * Good for removing clustering and creating consistent point density.
 *
 * @param points - Input point array
 * @param numSamples - Number of output samples (default: same as input)
 * @param closed - Whether the curve is closed (default: true)
 * @returns Resampled point array with uniform spacing
 *
 * @example
 * const uniform = resampleUniform(boundaryLoop, 100);
 */
export function resampleUniform(
    points: Vector3[],
    numSamples?: number,
    closed = true
): Vector3[] {
    if (points.length < 2) return points.map(p => p.clone());

    const count = numSamples ?? points.length;

    // Compute cumulative arc lengths
    const arcLengths: number[] = [0];
    let totalLength = 0;

    for (let i = 1; i < points.length; i++) {
        totalLength += points[i].distanceTo(points[i - 1]);
        arcLengths.push(totalLength);
    }

    if (closed) {
        totalLength += points[points.length - 1].distanceTo(points[0]);
        arcLengths.push(totalLength);
    }

    // Sample at uniform arc-length intervals
    const result: Vector3[] = [];
    const segmentLength = totalLength / count;

    for (let i = 0; i < count; i++) {
        const targetLength = i * segmentLength;

        // Find which segment contains this arc length
        let segIdx = 0;
        while (segIdx < arcLengths.length - 1 && arcLengths[segIdx + 1] < targetLength) {
            segIdx++;
        }

        // Interpolate within segment
        const segStart = arcLengths[segIdx];
        const segEnd = arcLengths[segIdx + 1] ?? totalLength;
        const segLen = segEnd - segStart;
        const t = segLen > 0 ? (targetLength - segStart) / segLen : 0;

        const p0 = points[segIdx % points.length];
        const p1 = points[(segIdx + 1) % points.length];

        result.push(p0.clone().lerp(p1, t));
    }

    return result;
}

/**
 * Combined smoothing pipeline
 *
 * Applies multiple smoothing techniques in sequence for best results:
 * 1. Optional resampling for uniform density
 * 2. Laplacian smoothing to reduce noise
 *
 * @param points - Input point array
 * @param options - Smoothing options
 * @returns Smoothed point array
 *
 * @example
 * const smooth = smoothCurve(boundaryLoop, {
 *     method: 'laplacian',
 *     iterations: 5,
 *     factor: 0.5
 * });
 */
export function smoothCurve(
    points: Vector3[],
    options: SmoothCurveOptions = {}
): Vector3[] {
    const {
        method = 'laplacian',
        iterations = 3,
        factor = 0.5,
        numSamples,
        closed = true
    } = options;

    switch (method) {
        case 'laplacian':
            return laplacianSmooth(points, iterations, factor, closed);

        case 'chaikin':
            return chaikinSmooth(points, iterations, closed);

        case 'resample':
            return resampleUniform(points, numSamples ?? points.length, closed);

        default:
            return points.map(p => p.clone());
    }
}

/**
 * Multi-stage smoothing: resample then smooth
 *
 * Best results for noisy mesh boundaries:
 * 1. Resample to uniform arc-length (removes point clustering)
 * 2. Apply Laplacian smoothing (reduces local noise)
 *
 * @param points - Input point array
 * @param numSamples - Number of resampled points (default: input length)
 * @param smoothIterations - Laplacian smoothing iterations (default: 3)
 * @param smoothFactor - Laplacian factor 0-1 (default: 0.5)
 * @param closed - Whether curve is closed (default: true)
 * @returns Smoothed point array
 */
export function smoothBoundary(
    points: Vector3[],
    numSamples?: number,
    smoothIterations = 3,
    smoothFactor = 0.5,
    closed = true
): Vector3[] {
    // Step 1: Resample to uniform arc-length
    const resampled = resampleUniform(points, numSamples ?? points.length, closed);

    // Step 2: Laplacian smoothing
    return laplacianSmooth(resampled, smoothIterations, smoothFactor, closed);
}
