import {Group, MeshPhysicalMaterial, SphereGeometry, Mesh} from "three";
import ParametricTubeGeometry from "../geometries/ParametricTubeGeometry.js";


let defaultMat = new MeshPhysicalMaterial({
    color:0xffffff,
    clearcoat:1,
    roughness:0,
    metalness:0,
});

//a curve with endpoints
export default class ParametricCurve extends Group{
    constructor(eqn, domain=[0,1], radius = 0.1, material = defaultMat ) {
        super();
        //add this to the group with this.add;
        this.radius = radius;
        this.domain = domain;
        this.eqn = eqn;

        let curveGeom =  new ParametricTubeGeometry(eqn, domain, radius);
        this.curve = new Mesh(curveGeom, material);

        //make the endpoints
        let sphGeom = new SphereGeometry(2*radius);
        this.start = new Mesh(sphGeom,material);
        this.end = new Mesh(sphGeom,material);

        let startPos = this.eqn(this.domain[0]);
        this.start.position.set(startPos.x,startPos.y,startPos.z);
        let endPos = this.eqn(this.domain[1]);
        this.end.position.set(endPos.x,endPos.y,endPos.z);

        this.add(this.curve);
        this.add(this.start);
        this.add(this.end);

    }

    redraw(eqn){

        this.curve.geometry.dispose();
        this.curve.geometry = new ParametricTubeGeometry(eqn,this.radius);

        let startPos = this.eqn(this.domain[0]);
        this.start.position.set(startPos.x,startPos.y,startPos.z);
        let endPos = this.eqn(this.domain[1]);
        this.end.position.set(endPos.x,endPos.y,endPos.z);

    }

}

