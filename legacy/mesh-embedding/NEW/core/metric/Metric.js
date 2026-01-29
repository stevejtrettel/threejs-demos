/**
 * Metric.js - Base class for distance functions on coordinate spaces
 *
 * A Metric knows how to compute distance between two coordinate points.
 * Different metrics handle different geometries.
 */

export class Metric {
    /**
     * Compute distance between two coordinate points.
     * @param {Array} a - coordinates of first point
     * @param {Array} b - coordinates of second point
     * @returns {number} distance
     */
    distance(a, b) {
        throw new Error("Metric.distance() not implemented");
    }

    /**
     * Compute local area element at a coordinate.
     * @param {Array} coord - coordinates of the point
     * @param {number} du - cell size in first direction
     * @param {number} dv - cell size in second direction
     * @returns {number} area
     */
    localArea(coord, du, dv) {
        throw new Error("Metric.localArea() not implemented");
    }
}
