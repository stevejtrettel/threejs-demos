/**
 * hingeBuilder.js - Create hinges from a Geometry
 *
 * Extracts pairs of adjacent triangular faces sharing an edge.
 */

import { Hinge } from './HingeEnergy.js';

/**
 * Compute triangle area using Heron's formula
 * @param {number} a - edge length
 * @param {number} b - edge length
 * @param {number} c - edge length
 * @returns {number} area
 */
function triangleArea(a, b, c) {
    const s = (a + b + c) / 2;
    const squared = s * (s - a) * (s - b) * (s - c);
    return squared > 0 ? Math.sqrt(squared) : 0;
}

/**
 * Compute area of a triangular face
 * @param {Face} face
 * @param {Geometry} geometry
 * @returns {number} area
 */
function faceArea(face, geometry) {
    const v = face.vertices;
    if (v.length !== 3) {
        console.warn('faceArea: non-triangular face');
        return 0;
    }

    const a = geometry.localDistance(v[0].idx, v[1].idx);
    const b = geometry.localDistance(v[1].idx, v[2].idx);
    const c = geometry.localDistance(v[2].idx, v[0].idx);

    return triangleArea(a, b, c);
}

/**
 * Create hinges for all interior edges (triangular faces only)
 *
 * For edge A→B with face 1 = (A, B, C) and face 2 = (B, A, D):
 *
 *        C
 *       /|\
 *      / | \
 *     / 1|  \
 *    A---+---B
 *     \ 2|  /
 *      \ | /
 *       \|/
 *        D
 *
 * @param {Geometry} geometry - geometry with topology
 * @param {number} k - bending stiffness
 * @returns {Hinge[]}
 */
export function bendingHinges(geometry, k) {
    const hinges = [];

    for (const edge of geometry.topology.uniqueEdges) {
        if (!edge.twin) continue;

        const a = edge.origin.idx;
        const b = edge.next.origin.idx;
        const c = edge.next.next.origin.idx;
        const d = edge.twin.next.next.origin.idx;

        hinges.push(new Hinge(a, b, c, d, k));
    }

    return hinges;
}

/**
 * Create hinges with discrete shells weighting
 *
 * Stiffness = k * |e|² / (A_left + A_right)
 *
 * This makes the discrete bending energy converge to the
 * continuous bending energy as the mesh is refined.
 *
 * Reference: Grinspun et al., "Discrete Shells" (2003)
 *
 * @param {Geometry} geometry
 * @param {number} k - bending stiffness coefficient
 * @returns {Hinge[]}
 */
export function bendingHingesDiscrete(geometry, k) {
    const hinges = [];

    for (const edge of geometry.topology.uniqueEdges) {
        if (!edge.twin) continue;

        const a = edge.origin.idx;
        const b = edge.next.origin.idx;
        const c = edge.next.next.origin.idx;
        const d = edge.twin.next.next.origin.idx;

        const edgeLength = geometry.localDistance(a, b);
        const areaLeft = faceArea(edge.face, geometry);
        const areaRight = faceArea(edge.twin.face, geometry);

        const totalArea = areaLeft + areaRight;
        if (totalArea < 1e-10) continue;  // degenerate

        const stiffness = k * edgeLength * edgeLength / totalArea;

        hinges.push(new Hinge(a, b, c, d, stiffness));
    }

    return hinges;
}