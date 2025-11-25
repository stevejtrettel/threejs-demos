import {Group} from "three";
import VertexView from "./VertexView";
import FaceView from "./FaceView";
import SpringView from "./SpringView";
//takes in an embedding and a list of spring systems
//draws the spring systems colored by how well their geometry matches the intrinsic metric

export default class GeometryView extends Group {
    constructor(embedding, springSystems,color = {vertex:0x000000, edge:0x456abc, face:0xffffff }) {
        super();


        this.embedding = embedding;
        this.springSystems = springSystems;

        let verts = embedding.topology.vertices;
        let faces = embedding.topology.faces;

        this.coords = new Float32Array(3*this.embedding.N);
        this.computeCoords();

        //these each run sync() on initialization
        this.v = new VertexView( verts, this.coords, color.vertex);
        this.f = new FaceView(faces, this.coords, color.face);
        this.s = [];
        for(let i=0;i<this.springSystems.length;i++){
            this.s.push(new SpringView(this.springSystems[i],this.coords))
        }

        //add to the group
        this.add(this.v);
        this.add(this.f);
        for(let i=0;i<this.springSystems.length;i++){
            this.add(this.s[i]);
        }



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
        this.f.sync();
        for(let i=0;i<this.springSystems.length;i++){
            this.s[i].sync();
        }

    }


    setSensitivity(sigma){
        //set the sensitivity to the red/green color change
        for(let i=0;i<this.springSystems.length;i++){
            this.s[i].sigma =sigma;
        }
    }

}
