import {Group, Mesh, SphereGeometry, Vector3} from "three";

import {colors, makeMaterial} from "./utils";

let toVec3 = function(p){
    return new Vector3(p[0],0,p[1]);
}

class FP2{
    constructor(p=7,scale=1) {
        this.p = p;
        this.range = (this.p-1)/2;
        this.scale = scale;
        this.modp = function(x){
            x = x % p;
            if(x>(p-1)/2){
                return x-p;
            }
            return x;
        }
        this.toTorus = function(pt){

            let s = 2*Math.PI*pt[0]/p;
            let t = 2*Math.PI*pt[1]/p;

            //square torus in R4:
            let denom = Math.sqrt(2)-Math.sin(t);
            let x = Math.sin(s)/denom;
            let y = Math.cos(s)/denom;
            let z = -Math.cos(t)/denom;

            return new Vector3(x,-z,y);
        }


    }


    getVertex(pt, color=colors.red, radius=0.03, glass=false){

        //pt is some [i,j] array of integers
        let x = this.modp(pt[0]);
        let y = this.modp(pt[1]);
        let geom = new SphereGeometry(radius);
        let mesh = new Mesh(geom, makeMaterial(color,glass));
        let pos = this.toTorus([x,y]);
        mesh.position.set(pos.x,pos.y,pos.z);

        let s = 1+pos.lengthSq();
        mesh.scale.set(s,s,s);
        return mesh;
    }

    getVertexGrid(color= colors.glass,radius=0.02,glass=true) {

        let grid = new Group();

        for (let i = -this.range; i < this.range + 1; i++) {
            for (let j = -this.range; j < this.range + 1; j++) {
                let vertex = this.getVertex([i,j],color,radius,glass);
                grid.add(vertex);
            }
        }

        return grid;
    }



    getCurve(parametricEqn){

    }
}


export default FP2;
