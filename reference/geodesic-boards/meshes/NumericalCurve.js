import {Group, MeshPhysicalMaterial, SphereGeometry, Mesh} from "three";
import NumericalTubeGeometry from "../geometries/NumericalTubeGeometry.js";

let defaultMat = new MeshPhysicalMaterial({
    color:0xffffff,
    clearcoat:1,
    roughness:0,
    metalness:0,
});

//a curve with endpoints
export default class NumericalCurve extends Group{
    constructor(pts, radius = 0.1, material = defaultMat ) {
        super();

        //if empty point list
        if(pts.length==0){
            pts = [[0,0,0],[1,1,1]];
        }

        //add this to the group with this.add;
        this.radius = radius;

        let curveGeom =  new NumericalTubeGeometry(pts, radius);
        this.curve = new Mesh(curveGeom, material);

        //make the endpoints
        let sphGeom = new SphereGeometry(2*radius);
        this.start = new Mesh(sphGeom,material);
        this.end = new Mesh(sphGeom,material);

        let startPos = pts.at(0);
        this.start.position.set(startPos[0],startPos[1],startPos[2]);
        let endPos = pts.at(-1);
        this.end.position.set(endPos[0],endPos[1],endPos[2]);

        this.add(this.curve);
        this.add(this.start);
        this.add(this.end);

    }

    setVisibility(bool){
        this.curve.visible = bool;
        this.start.visible=bool;
        this.end.visible=bool;
    }

    redraw(pts){

        this.curve.geometry.dispose();
        this.curve.geometry = new NumericalTubeGeometry(pts,this.radius);

        let startPos = pts.at(0);
        this.start.position.set(startPos[0],startPos[1],startPos[2]);
        let endPos = pts.at(-1);
        this.end.position.set(endPos[0],endPos[1],endPos[2]);
    }


}
