import {Vector2} from "three";
import GeodesicArray from "./GeodesicArray.js";
import Curve from "../interpolators/Curve.js";
import TangentVector from "../diffgeo/TangentVector.js";

let defaultProps = {
    pos: 0.5,
    angle: 0,
    spread:0.2,
    radius:0.02,
};

export default class GeodesicStripes extends GeodesicArray{
    constructor(surface, N =10, properties=defaultProps, material) {

        super(surface, N, properties,material);

    }

    _initialize(){
        const [[x0, x1], [y0, y1]] = this.surface.domain;
        this.coordCurve =new Curve(t => new Vector2(x0 + t * (x1 - x0), y0));
        this.integrator = this.surface.getParallelTransport(this.coordCurve);
        this.parallel = this.integrator.getTransportedBasis();

        this.bdyCurve = new Curve(t => this.surface.parameterization(x0 + t * (x1 - x0), y0));
    }

    //the only method that needs to be build is initial tangents
    setIni(){

        let V = new Vector2(Math.sin(this.properties.angle),Math.cos(this.properties.angle));

        //we should not be sampling uniformly in COORDINATES, but rather along the surface
        //that is, we should get initial conditions from the boundary curve somehow
        //RIGHT NOW WE ARE JUST GETTING COORDINATE TIME

        for(let i=0; i<this.N; i++){

            let offset = (i+0.5)/this.N-0.5;
            let t = this.properties.pos + this.properties.spread*offset;

            let basis = this.parallel(t);

            let newPos = this.coordCurve.getPoint(t);
            let newV = basis[0].multiplyScalar(V.x).add(basis[1].multiplyScalar(V.y));
            this.ini[i] = new TangentVector(newPos, newV);
        }
    }

    recomputeTransport(){
        const [[x0, x1], [y0, y1]] = this.surface.domain;
        this.bdyCurve = new Curve(t => this.surface.parameterization(x0 + t * (x1 - x0), y0));

        this.parallel = this.integrator.getTransportedBasis();
    }

}
