


export class Vertex{
    constructor() {
        this.idx = null;//index in vertex array
    }
}


export class Edge{
    constructor() {

        this.idx = null; //index in the edge array

        //for topology
        this.origin = null; //vertex where directed edge starts
        this.twin = null; //edge: opposite orientation on neighbor polygon
        this.next = null;//edge: next along polygon
        this.face = null;//face its contained in


        //extra structure: for geometry
        this.length = null;
    }
}



export class Face{
    constructor() {

        this.idx = null; // index in the faces array

        this.vertices = null; //ordered list of vertices going around the face
        this.markedEdge = null;// one edge on face: to start traversing


        //extra structure: for geometry
        this.area = null;
        this.angles = null;// ordered list of interior angles (same order as vertex list)
        this.lengths = null;// ordered list of sidelengths (0 is side from V0 to V1, 1 is side from V1 to V2 ,etc)
    }

}
