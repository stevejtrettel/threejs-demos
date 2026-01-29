/**
 * springBuilder.js - Create springs from a Geometry
 *
 * Provides functions to create different types of springs:
 *   - Stretch: on mesh edges (resist stretching)
 *   - Shear: on quad diagonals (resist shearing)
 *   - Bend: across adjacent faces (resist bending)
 */

import { Spring } from './SpringEnergy.js';
import { Charge } from './ChargeEnergy.js';

/**
 * Create stretch springs on all edges
 *
 * @param {Geometry} geometry - geometry with topology and distance function
 * @param {number} k - stiffness (multiplied by rest length)
 * @returns {Spring[]}
 */
export function stretchSprings(geometry, k) {
    const springs = [];

    for (const edge of geometry.topology.uniqueEdges) {
        const i = edge.origin.idx;
        const j = edge.next.origin.idx;
        const rest = geometry.localDistance(i, j);
        const stiffness = k * rest;

        springs.push(new Spring(i, j, stiffness, rest));
    }

    return springs;
}

/**
 * Create shear springs on quad diagonals
 * Only works for quad meshes!
 *
 * @param {Geometry} geometry
 * @param {number} k - stiffness (multiplied by rest length)
 * @returns {Spring[]}
 */
export function shearSprings(geometry, k) {
    const springs = [];

    for (const face of geometry.topology.faces) {
        const verts = face.vertices;

        if (verts.length !== 4) {
            console.warn('shearSprings: skipping non-quad face');
            continue;
        }

        // Diagonal 0-2
        const i0 = verts[0].idx;
        const i2 = verts[2].idx;
        const rest02 = geometry.localDistance(i0, i2);
        springs.push(new Spring(i0, i2, k * rest02, rest02));

        // Diagonal 1-3
        const i1 = verts[1].idx;
        const i3 = verts[3].idx;
        const rest13 = geometry.localDistance(i1, i3);
        springs.push(new Spring(i1, i3, k * rest13, rest13));
    }

    return springs;
}







/**
 * Create bend springs connecting vertices across adjacent faces
 *
 * For quads: connects vertex of one face to the opposite vertex of the adjacent face
 *
 * @param {Geometry} geometry
 * @param {number} k - stiffness (multiplied by rest length)
 * @returns {Spring[]}
 */
export function bendSprings(geometry, k) {
    const springs = [];

    for (const edge of geometry.topology.edges) {
        // Only process if there's a neighboring face
        if (edge.next.twin) {
            const i = edge.origin.idx;
            // Navigate to the opposite vertex across the neighbor face
            const j = edge.next.twin.next.next.origin.idx;

            const rest = geometry.localDistance(i, j);
            springs.push(new Spring(i, j, k * rest, rest));
        }
    }

    return springs;
}



export function boundarySprings(geometry, k){
    let springs = [];
    for(const edge of geometry.topology.boundaryEdges){

        const i = edge.origin.idx;
        const j = geometry.topology.nextBoundaryEdge(edge).next.origin.idx;
        const rest = geometry.localDistance(i, j);

        springs.push( new Spring(i,j,k*rest, rest));
    }

    return springs;

}

/**
 * Create charges on all vertices (uniform charge per vertex)
 *
 * @param {Topology} topology
 * @param {number} q - charge per vertex
 * @returns {Charge[]}
 */
export function vertexCharges(topology, q) {
    return topology.vertices.map(v => new Charge(v.idx, q));
}

/**
 * Create charges based on local metric area (charge = density × area)
 *
 * For uniform grids, du/dv are constants.
 * For non-uniform grids, du/dv can be functions of vertex index.
 *
 * @param {Geometry} geometry - geometry with metric
 * @param {number} qDensity - charge per unit area
 * @param {number|Function} du - cell size in first direction (or function of index)
 * @param {number|Function} dv - cell size in second direction (or function of index)
 * @returns {Charge[]}
 */
export function areaCharges(geometry, qDensity, du, dv) {
    const getDu = typeof du === 'function' ? du : () => du;
    const getDv = typeof dv === 'function' ? dv : () => dv;

    const charges = [];
    for (const vertex of geometry.topology.vertices) {
        const i = vertex.idx;
        const area = geometry.localArea(i, getDu(i), getDv(i));
        charges.push(new Charge(i, qDensity * area));
    }

    return charges;
}
