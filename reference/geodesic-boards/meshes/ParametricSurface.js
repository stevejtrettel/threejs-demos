import {MeshPhysicalMaterial, Mesh, DoubleSide} from "three";
import ParametricSurfaceGeometry from "../geometries/ParametricSurfaceGeometry.js";

let defaultMat = new MeshPhysicalMaterial({
    color:0xffffff,
    clearcoat:1,
    roughness:0,
    metalness:0,
    side: DoubleSide,
});

export default class ParametricSurface extends Mesh {
    constructor(eqn,domain = [[0,1],[0,1]], material = defaultMat,res=128 ) {

        let geometry = new ParametricSurfaceGeometry(eqn,domain,res,res);
        super(geometry,material);

        this.eqn = eqn;
        this.domain=domain;
    }

    redraw(eqn=null,dom=null){
        if(eqn){
            this.eqn = eqn;
        }
        if(dom){
            this.domain = dom;
        }
        this.geometry.dispose();
        this.geometry = new ParametricSurfaceGeometry(this.eqn,this.domain);
    }
}

