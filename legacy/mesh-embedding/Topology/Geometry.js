import Topology from "./Topology";
import {Edge} from "./Cells";

//compute the opposite side of a triangle with edges x,y incident to angle A
//c² = x² + y² − 2·x·y·cos(A)
const lawOfCosines = function(x, y, cosA){
    return Math.sqrt(x * x + y * y - 2 * x * y * cosA);
}

//an extension of topology that stores edge lenghts, face areas, and interior angles
//also (optionally) stores a law of cosines for computing diagonals
export default class Geometry extends Topology{
    constructor(vertices, edges, faces, diag = lawOfCosines) {
        super(vertices, edges, faces);
        this.diag = diag;
    }

    //geometric static method fromSoup
    //faces need to have the length and angle data set to use
    static fromSoup(vertices, faces, diag = lawOfCosines()){


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

                //the new thing for geometry
                edgesForFace[l].length = f.lengths[l];
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


        return new Geometry(vertices, edges, faces, diag);

    }


    //NEW GEOMETRIC THINGS?




}
