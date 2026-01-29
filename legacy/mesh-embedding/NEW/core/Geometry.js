/**
 * Geometry.js - Intrinsic geometry of a mesh
 *
 * Combines:
 *   - Topology: which vertices are connected
 *   - Coordinates: positions in some coordinate system
 *   - Metric: how to measure distance in that coordinate system
 *
 * Provides localDistance(i, j) for computing rest lengths of springs.
 * This is only valid for nearby vertices (edges, diagonals, bend pairs).
 */

import { EuclideanMetric } from './metric/EuclideanMetric.js';

export default class Geometry {
    /**
     * @param {Topology} topology - the mesh topology
     * @param {Array} coords - coordinates for each vertex (any format the metric understands)
     * @param {Metric} metric - how to measure distance
     */
    constructor(topology, coords, metric = new EuclideanMetric()) {
        this.topology = topology;
        this.coords = coords;
        this.metric = metric;
    }

    /**
     * Compute intrinsic distance between vertices i and j.
     * Only valid for topologically nearby vertices!
     */
    localDistance(i, j) {
        return this.metric.distance(this.coords[i], this.coords[j]);
    }

    /**
     * Compute local area element at vertex i.
     * @param {number} i - vertex index
     * @param {number} du - cell size in first direction
     * @param {number} dv - cell size in second direction
     */
    localArea(i, du, dv) {
        return this.metric.localArea(this.coords[i], du, dv);
    }

    // ========================================================================
    // Factory methods
    // ========================================================================

    /**
     * Create geometry with Euclidean metric from an Embedding
     */
    static euclidean(topology, embedding) {
        // Extract coordinates as arrays
        const coords = [];
        for (let i = 0; i < embedding.N; i++) {
            const p = embedding.position(i, new Float32Array(3));
            coords.push([p[0], p[1], p[2]]);
        }
        return new Geometry(topology, coords, new EuclideanMetric());
    }

    /**
     * Create geometry from coordinate arrays and a metric
     */
    static fromCoords(topology, coords, metric) {
        return new Geometry(topology, coords, metric);
    }
}
