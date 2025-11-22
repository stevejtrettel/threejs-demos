/* SymplecticIntegrator4.js  -------------------------------------- */
import { Vector2 }   from 'three';
import TangentVector from "../diffgeo/TangentVector.js";


/* ---------- helper: one velocity-Verlet step of length h -------- */
function verletStep(state, h, acc) {

    const h2 = 0.5 * h;

    // half-kick
    const a0 = acc(state).clone();
    const vHalf = state.vel.clone().addScaledVector(a0, h2);

    // drift
    const posNew = state.pos.clone().addScaledVector(vHalf, h);

    // second half-kick
    const tmp = new TangentVector(posNew, vHalf);
    const a1  = acc(tmp).clone();
    const vNew = vHalf.addScaledVector(a1, h2);

    return new TangentVector(posNew, vNew);
}

/* ---------- 4-th order integrator ------------------------------- */
export default class Symplectic4 {

    /**
     * @param {Function} acc  TangentVector → Vector2   (geodesic acceleration)
     * @param {number}   h    base time step Δt
     */
    constructor(acc, h = 0.01) {
        this.acc = acc;
        this.h   = h;

        // Suzuki–Yoshida coefficients
        const c = 1 / ( 2 - Math.cbrt(2) );
        this.l1 =  c;                  // ≈ 0.6756035959798289
        this.l2 = -Math.cbrt(2) * c;   // ≈ −0.1756035959798288
    }

    /** one 4-th-order step */
    step(state) {
        state = verletStep(state, this.l1 * this.h, this.acc);
        state = verletStep(state, this.l2 * this.h, this.acc);
        state = verletStep(state, this.l1 * this.h, this.acc);
        return state;
    }

    /** integrate *n* steps */
    integrate(state, n = 1) {
        for (let i = 0; i < n; ++i) state = this.step(state);
        return state;
    }
}
