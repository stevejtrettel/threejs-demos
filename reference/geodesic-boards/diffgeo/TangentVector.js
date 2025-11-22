/* TangentVector.js  ------------------------------------------------ */
import { Vector2 } from 'three';

export default class TangentVector {
    constructor( pos, vel ) {
        this.pos = pos.clone();
        this.vel = vel.clone();
    }

    clone() {                     // handy for integrator intermediates
        return new TangentVector( this.pos, this.vel );
    }
}
