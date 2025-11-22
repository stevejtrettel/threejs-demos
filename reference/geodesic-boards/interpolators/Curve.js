import {Vector3} from "three";

import BaseCurve from "./BaseCurve.js";
import TangentVector from "../diffgeo/TangentVector.js";


//extends the abstract curve class in ThreeJS
//lets us specify a curve by giving a parameterization and a start point, end point
// (in terms of the parameterization variable)
//now we can call all the curve classes like getTangent, Frenet Frames, etc

export default class Curve extends BaseCurve{
    constructor(fn, start=0, end=1) {
        super();

        this.fn = fn;
        this.start = start;
        this.end = end;
        this.range = this.end-this.start;

    }

    getPoint(u,optionalTarget = new Vector3()) {
        let t = this.start + this.range *u;
        let p = this.fn(t);
        return optionalTarget.set(p.x,p.y,p.z);
    }

    getTV(u){
        let h = 0.0001;
        let t = this.start + this.range *u;
        let p = this.fn(t);
        let v = this.fn(t+h).sub(this.fn(t-h));
        v.divideScalar(2*h);
        return new TangentVector(p,v);
    }

}
