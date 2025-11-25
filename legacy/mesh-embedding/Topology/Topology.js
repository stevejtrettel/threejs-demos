import {Vertex,Edge,Face} from "./Cells";


//this does not have to be FAST: we use it to precompute things
export default class Topology{
    constructor(vertices, edges, faces) {

        //these already form the data of a half-edge mesh
        this.vertices = vertices;
        this.edges = edges;
        this.faces = faces;


        //---useful derived quantities-------

        //create the list of unique edges
        this.uniqueEdges = [];
        for (const e of this.edges) {
            if (!e.twin) { // boundary edge
                this.uniqueEdges.push(e);
            } else if (e.origin.idx < e.twin.origin.idx) {
                this.uniqueEdges.push(e); // interior, but only true for one of the pair
            }
        }

        //create a list of boundaryEdges
        this.boundaryEdges = [];
        for (const e of this.edges) {
            if (!e.twin) { // boundary edge
                this.boundaryEdges.push(e);
            }
        }

    }

    //---factory methods---
    static fromSoup(vertices, faces){


        //create the edges!
        let edges = [];

        for(const f of faces){

            //make the right number for this face
            let edgesForFace = [];
            for(const vertex of f.vertices){
                edgesForFace.push(new Edge());
            }

            //associate the first of these as the marked edge for the face
            f.markedEdge = edgesForFace[0];

            //set their data around the face correctly
            for(let l = 0; l< f.vertices.length; l++){
                edgesForFace[l].face = f;
                edgesForFace[l].origin = f.vertices[l];
                edgesForFace[l].next = edgesForFace[(l+1) % f.vertices.length ];//the next one modulo length
            }

            //push them to the overall edges list
            edges.push(...edgesForFace);

        }


        //THE LISTS ARE DONE!
        /* set the correct .idx */
        vertices.forEach((v, i) => (v.idx = i));
        edges.forEach((e, i) => (e.idx = i));
        faces.forEach((f, i) => (f.idx = i));




        //----SET TWINS-----

        // helper: build a unique string for the directed edge a → b
        const keyOf = (aIdx, bIdx) => `${aIdx}-${bIdx}`;

        // Map:  directed-edge key  → half-edge object waiting for its twin
        const pending = new Map();

        for (const e of edges) {
            const a = e.origin.idx;           // idx of this half-edge's start vertex
            const b = e.next.origin.idx;      // idx of its end vertex
            const revKey = keyOf(b, a);       // key of the opposite direction

            const twin = pending.get(revKey);
            if (twin) {
                /* interior edge – match found */
                e.twin    = twin;
                twin.twin = e;
                pending.delete(revKey);         // pair resolved
            } else {
                /* store this half-edge until we see its reverse */
                pending.set(keyOf(a, b), e);
            }
        }

        /* Anything still in `pending` has no twin ⇒ boundary edge */
        for (const boundaryEdge of pending.values()) {
            boundaryEdge.twin = null;
        }


        return new Topology(vertices, edges, faces);

    }




    //---------------------------------------
    //---methods for traversing a topology---
    //---------------------------------------

    // Get all faces that share an edge with the given face (i.e., neighboring faces)
    neighboringFaces(face) {
        const neighbors = new Set(); // Use a Set to avoid duplicates because two eddges can share the same faces
        let startEdge = face.markedEdge;
        let currentEdge = startEdge;

        do {
            if (currentEdge.twin && currentEdge.twin.face) {
                neighbors.add(currentEdge.twin.face);
            }
            currentEdge = currentEdge.next;
        } while (currentEdge !== startEdge);

        return Array.from(neighbors); // ordered by insertion order (I read online that Set maintains insertion order)
    }

    // Get all outgoing edges incident to a vertex
    outgoingVertexEdges(vertex) {
        const edges = [];
        for (const edge of this.edges) { // "const" because we don't modify edges, otherwise we could use "let edge of this.edges". "for (edge of this.edges)" is bad practice I read.
            if (edge.origin === vertex) {
                edges.push(edge);
                break;
            }
        }
        return edges; // Return all outgoing edges -- If null, no outgoing edges found for this vertex
    }

    // Get all incoming edges incident to a vertex
    incomingVertexEdges(vertex) {
        const edges = [];
        for (const edge of this.edges) {
            if (edge.next.origin === vertex) {
                edges.push(edge);
            }
        }
        return edges; // Return all incoming edges -- If null, no incoming edges found for this vertex
    }

    vertexEdges(vertex) {
        const edges = new Set(); // Could be an array unless we allow an edge to start and end at the same vertex for whatever reason.
        // Find all edges incident to this vertex
        // Note: might have outgoing and incoming edges that are not twins, so we need to check both directions individually
        for (const edge of this.edges) {
            if (edge.origin === vertex || (edge.next.origin === vertex)) { // Check if the edge originates from-, or points to the vertex.
                edges.add(edge);
                edges.add(edge.twin); // Include the twin edge as well
            }
        }

        return Array.from(edges); // Return all incident edges -- If null, no incident edges found for this vertex
    }

    // Get all faces incident to a vertex
    vertexFaces(vertex) {
        const faces = [];
        for (const face of this.faces) {
            for (const vert of face.vertices) {
                if (vert === vertex) {
                    faces.push(face);
                }
            }
        }

        return faces; // Return all incident faces -- If null, no incident faces found for this vertex
    }

    // Check if the mesh is closed (no boundary edges)
    isClosed() {
        // Here we use that edges know to which face they belong
        return this.edges.every(edge => edge.twin && edge.twin.face); // AI told me to use "every" method of arrays here, it is just a loop under the hood though... and "=>" is lambda syntax in JavaScript
    }

    // Get boundary edges
    getBoundaryEdges() {
        // Here we use that edges know to which face they belong
        return this.edges.filter(edge => !edge.face || !edge.twin.face);
    }

    // Get all possible diagonals in a face (edges between non-adjacent vertices)
    getAllDiagonals(face) {
        const diagonals = [];
        const vertices = [];

        // Collect all vertices of the face
        let startEdge = face.markedEdge;
        let currentEdge = startEdge;
        do {
            vertices.push(currentEdge.origin);
            currentEdge = currentEdge.next;
        } while (currentEdge !== startEdge);

        // Generate all pairs of non-adjacent vertices
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 2; j < n; j++) {
                // Skip if they would be adjacent in the cyclic order
                if ((j - i) === n - 1) continue;
                diagonals.push([vertices[i], vertices[j]]);
            }
        }

        return diagonals;
    }

}
