/* SymplecticIntegrator.js  --------------------------------------- */
import { Vector2 }      from 'three';
import TangentVector from "../diffgeo/TangentVector.js";

export default class Symplectic2 {

    constructor(acc, h = 0.01) {
        this.acc = acc;
        this.h   = h;
    }

    /** one velocity-Verlet step */
    step(s) {

        const h = this.h, h2 = 0.5 * h;

        // --- half-kick (uses current a) ------------------------------
        const a0 = this.acc(s).clone();
        const vHalf = s.vel.clone().addScaledVector(a0, h2);

        // --- drift ----------------------------------------------------
        const posNew = s.pos.clone().addScaledVector(vHalf, h);

        // --- second half-kick: need a at (q_{n+1}, vHalf) ------------
        const tmpState = new TangentVector(posNew, vHalf);
        const a1 = this.acc(tmpState).clone();
        const vNew = vHalf.addScaledVector(a1, h2);

        return new TangentVector(posNew, vNew);
    }

    /** integrate *n* steps */
    integrate(state, n = 1) {
        let s = state;
        for (let i = 0; i < n; ++i) s = this.step(s);
        return s;
    }
}
