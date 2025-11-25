import {Group} from "three";
import VertexView from "./VertexView";
import FaceView from "./FaceView";
import EdgeView from "./EdgeView";



export default class TopologyView extends Group {
    constructor(embedding, color = {vertex:0x000000, edge:0x456abc, face:0xffe9ad }) {
        super();


        this.embedding = embedding;

        let verts = embedding.topology.vertices;
        let edges = embedding.topology.uniqueEdges;
        let faces = embedding.topology.faces;

        this.coords = new Float32Array(3*this.embedding.N);
        this.computeCoords();

        //these each run sync() on initialization
        this.v = new VertexView( verts, this.coords, color.vertex);
        this.e = new EdgeView( edges, this.coords, color.edge);
        this.f = new FaceView(faces, this.coords, color.face);

        //add to the group
        this.add(this.v);
        this.add(this.e);
        this.add(this.f);

    }

    computeCoords(){
        for(let i=0; i<this.embedding.N; i++){

            //compute the coordinates of vertex i
            const uvw = this.embedding.coords(i);

            //set these into the coordinate array
            const a = 3*i;
            this.coords[a]   = uvw[0];
            this.coords[a+1] = uvw[1];
            this.coords[a+2] = uvw[2];
        }
    }


    sync(){

        //compute the display coordinates of the point in R3
        this.computeCoords();

        //synchronize the visuals (each has this.pos stored internally)
        this.v.sync();
        this.e.sync();
        this.f.sync();

    }

}
