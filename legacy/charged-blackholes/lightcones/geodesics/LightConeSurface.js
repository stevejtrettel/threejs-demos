import {MeshPhysicalMaterial, Mesh, Vector3, DoubleSide, Group, CatmullRomCurve3, TubeGeometry} from "three";

import State from "../integrators/States/State.js";
import NumericalGeometry from "./NumericalGeometry.js";
import NumericalCurve from "./NumericalCurve.js";


let defaultSurfMat = new MeshPhysicalMaterial({
    color:0xf5c542,
    roughness:0,
    metalness:0,
    clearcoat:1,
    side:DoubleSide,
});

let defaultEdgeMat = new MeshPhysicalMaterial({
    color:0xff770f,
    roughness:0,
    metalness:0,
    clearcoat:1,
    side:DoubleSide,
});

class LightConeSurface{
    constructor(bh,pos,length=100, scaleyz=1,scalex=1,mat=defaultSurfMat,edgeMat=defaultEdgeMat) {

        this.bh = bh;
        this.pos = pos;
        this.length = length;
        this.scaleX=scalex;
        this.scaleYZ=scaleyz;


        //make the array:
        let lengthRes = this.length;
        let angRes = 8192;

        let ptGrid = [];
        for(let i=0;i<angRes;i++){
            //push a new list to ptGrid
            ptGrid.push([]);

            //set the new point to start:
            let ang = 2*Math.PI*i/angRes-1;
            let vel = new Vector3(1,Math.cos(ang),Math.sin(ang));
            let state = new State(this.pos.clone(), vel);
            this.bh.normalize(state);

            for(let j=0; j<lengthRes; j++) {
                //push result of geodesic flow to the list
                ptGrid[i].push(state.pos.clone());

                //step ahead some number of times
                for (let k = 0; k < 20; k++){
                    state = this.bh.integrator.step(state);
                 }
            }
        }
        //copy first geodesic as last to make the surface close up
        ptGrid.push(ptGrid[0]);

        let coneGeom = new NumericalGeometry(ptGrid);


        this.mesh = new Group();
        this.mesh.add(new Mesh(coneGeom,mat));

        //now make the edge:
        //grab the very end of each geodesic strand
        let edgePts = [];
        for(let i=0; i< ptGrid.length-1;i++){
            edgePts.push(ptGrid[i].pop());
        }

        let curve = new CatmullRomCurve3(edgePts);
        let edgeGeom = new TubeGeometry(curve,8192,0.15,8,true);
        this.mesh.add(new Mesh(edgeGeom,edgeMat));


        this.mesh.scale.set(this.scaleX,this.scaleYZ,this.scaleYZ);
    }


    addToScene(scene){
        scene.add(this.mesh);
    }

}


export default LightConeSurface;
