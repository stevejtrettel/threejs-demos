import {Vector2} from "three";
import TangentVector from "../diffgeo/TangentVector.js";
import GeodesicArray from "./GeodesicArray.js";

let defaultProps = {
    pos: new Vector2(1.,-0.5),
    angle: 0,
    radius:0.02,
    spread:2,
};

export default class GeodesicSpray extends GeodesicArray{
    constructor(surface, N =10, properties=defaultProps, material) {

        super(surface,N,properties,material);

    }

    //the only update is changing the initial conditions
    setIni(){
        for(let i=0; i<this.N; i++){
            let offset = i/this.N-0.5;
            let newAngle = this.properties.angle+this.properties.spread*offset;
            let newVel = new Vector2(Math.cos(newAngle), Math.sin(newAngle));

            this.ini[i] = new TangentVector(this.properties.pos,newVel);
        }
    }

}
