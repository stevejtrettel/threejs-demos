import {Vertex,Face} from "../Topology/Cells";
import Topology from "../Topology/Topology";
import Embedding from "../Embedding/Embedding";


function vertexKey(v){
    return v.prettyPrint();
}

//a face is an array of Vector3s
//vertex average is interior to face: this is a unique identifier
// use vertex sum
function faceKey(f){
    let sum = f[0].clone();
    for(let i=1;i<f.length;i++){
        sum = sum.add(f[i]);
    }
    return sum.prettyPrint();
}


function reverseOrientation(f){
    //f is a list of vertex coordinates
    //swap the last two
    let v = f.pop();
    let w = f.pop();
    f.push(v);
    f.push(w)
}




export default class Tiling{

    constructor(generators, domain) {
        //domain is an array of polygons making up the fundamental domain

        //references to the algebraic data
        this.generators = generators;
        this.domain = domain;

        //lists to build the tiling
        this.vertices = [];
        this.faces = [];
        this.vertexCoords = [];

        //hashmap stuff
        this.faceHash = null;
        this.vertexHash = null;

    }


    _applyGenerators(face){
        let images = [];
        for(const g of this.generators){
            let newFace = [];
            for(const v of face){
                newFace.push(v.applyMatrix3(g));
            }

            reverseOrientation(newFace); //if our generator is orientation reversing!
            images.push(newFace);
        }
        return images;
    }


    _processFace(f){

        //process a face and update our vertexHash, faceHash
        //as well as add to vertices, faces, and vertexCoords

        // check if we've seen the triangle before!
        const key = faceKey(f);
        if (this.faceHash.has(key)) return false;     // duplicate = ignore
        this.faceHash.add(key);//otherwise add it

        const faceVerts = f.map(v => {
            //for each vertex of the triangle, get its key
            const vKey = vertexKey(v);
            //is this a thing in the vertex map already?
            let vert = this.vertexHash.get(vKey);
            if (!vert) {
                // if it's a brand-new vertex
                vert = new Vertex();                // create the new vertex
                vert.id = this.vertices.length;      // index = next slot
                this.vertexHash.set(vKey, vert);          // add it to our Map
                this.vertices.push(vert);           // add the new vertex to our array
                this.vertexCoords.push(v.clone());       // store the coordinate Vector3 to our array
            }
            return vert;
        });

        // build the Face
        const face = new Face();
        face.idx = this.faces.length;                  // give the face an index
        face.vertices = faceVerts;                // assign its boundary vertices
        this.faces.push(face);

        return true;//new face
    }


    generate(n){


        //reset the hashmaps
        this.vertexHash = new Map();
        this.faceHash = new Set();

        let frontier = [];
        for(const polygon of this.domain){
            frontier.push(polygon);
        }

        //iterate over all the faces in domain;
        for(const face of this.domain) {
            this._processFace(face);    // make sure the very first one gets added to the list
        }

        for (let depth = 0; depth < n; depth++) {
            const nextFrontier = []; //store the new triangles we discover this round
            for (const face of frontier) {
                // reflect this triangle in each mirror to get its images under the generators
                const images = this._applyGenerators(face);
                for (const img of images) {
                    // if it's new, record it and push for next round
                    if (this._processFace(img)) {
                        nextFrontier.push(img);
                    }
                    //otherwise do nothing: we've already seen it!
                }
            }
            //all the new triangles we discovered this round are now stored in nextFrontier
            //so, set this as our starting point of things to reflect, and begin again!
            frontier = nextFrontier;
        }



        this.topology = Topology.fromSoup(this.vertices,this.faces);

    }



    createEmbedding(vertexFn = v=>v ){

        //process the coordinates into real numbers
        const coords = this.vertexCoords.map(v => {
            let w=vertexFn(v);
            return w.realEmbedding();
        });

        const emb =  new Embedding(this.topology,coords);
       //emb.setPositions(coords);

        return emb;
    }

}
