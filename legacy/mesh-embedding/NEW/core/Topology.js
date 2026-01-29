/**
 * Topology.js - Half-edge mesh data structure
 *
 * A topology consists of vertices, edges (half-edges), and faces.
 * Each edge knows its origin vertex, twin edge, next edge around the face, and containing face.
 * This allows efficient traversal of the mesh.
 */

// ============================================================================
// Cell Types
// ============================================================================

export class Vertex {
    constructor() {
        this.idx = null;  // index in vertex array
    }
}

export class Edge {
    constructor() {
        this.idx = null;     // index in edge array
        this.origin = null;  // vertex where this half-edge starts
        this.twin = null;    // opposite half-edge (null if boundary)
        this.next = null;    // next half-edge around the face
        this.face = null;    // face this edge belongs to
    }
}

export class Face {
    constructor() {
        this.idx = null;        // index in face array
        this.vertices = null;   // ordered list of vertices (CCW)
        this.markedEdge = null; // one edge on face, for traversal
        this.data = null;       // optional user data (e.g., for coloring)
    }
}

// ============================================================================
// Topology Class
// ============================================================================

export default class Topology {
    constructor(vertices, edges, faces) {
        this.vertices = vertices;
        this.edges = edges;
        this.faces = faces;

        // Derived: unique edges (one per pair of twins)
        this.uniqueEdges = [];
        for (const e of this.edges) {
            if (!e.twin) {
                // boundary edge
                this.uniqueEdges.push(e);
            } else if (e.origin.idx < e.twin.origin.idx) {
                // interior edge, but only count once
                this.uniqueEdges.push(e);
            }
        }

        // Derived: boundary edges
        this.boundaryEdges = this.edges.filter(e => !e.twin);
    }

    /**
     * Build a Topology from a "soup" of vertices and faces.
     * Faces should have a .vertices array of Vertex objects (CCW order).
     */
    static fromSoup(vertices, faces) {
        const edges = [];

        // Create half-edges for each face
        for (const f of faces) {
            const edgesForFace = f.vertices.map(() => new Edge());
            f.markedEdge = edgesForFace[0];

            for (let i = 0; i < f.vertices.length; i++) {
                const e = edgesForFace[i];
                e.face = f;
                e.origin = f.vertices[i];
                e.next = edgesForFace[(i + 1) % f.vertices.length];
            }

            edges.push(...edgesForFace);
        }

        // Assign indices
        vertices.forEach((v, i) => v.idx = i);
        edges.forEach((e, i) => e.idx = i);
        faces.forEach((f, i) => f.idx = i);

        // Find twin edges
        const keyOf = (a, b) => `${a}-${b}`;
        const pending = new Map();

        for (const e of edges) {
            const a = e.origin.idx;
            const b = e.next.origin.idx;
            const revKey = keyOf(b, a);

            const twin = pending.get(revKey);
            if (twin) {
                e.twin = twin;
                twin.twin = e;
                pending.delete(revKey);
            } else {
                pending.set(keyOf(a, b), e);
            }
        }

        // Anything still in pending is a boundary edge
        for (const boundaryEdge of pending.values()) {
            boundaryEdge.twin = null;
        }

        return new Topology(vertices, edges, faces);
    }

    /**
     * Get faces adjacent to the given face (sharing an edge)
     */
    neighboringFaces(face) {
        const neighbors = new Set();
        let e = face.markedEdge;
        do {
            if (e.twin && e.twin.face) {
                neighbors.add(e.twin.face);
            }
            e = e.next;
        } while (e !== face.markedEdge);
        return Array.from(neighbors);
    }

    nextBoundaryEdge(edge) {
         let currentEdge = edge;
        let nextEdge=edge.next;

        if(edge.twin==null){
           
            while(nextEdge.twin){
                currentEdge = nextEdge;
                nextEdge= nextEdge.twin.next;
            }
        }

        return nextEdge;
    }


    /**
     * Check if the mesh is closed (no boundary)
     */
    isClosed() {
        return this.boundaryEdges.length === 0;
    }
}
