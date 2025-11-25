
import {buildFloatArray} from "../../utils/buildFloatArray";
import Flow from "../Flow.js";



export class PhysicsFlow extends Flow {
    constructor(
        energy,
        emb,
        {
            mass = 1,   // scalar or array
            drag = 0    // scalar or array
        } = {}
    ) {
        super(energy, emb);

        const N = emb.N;

        /* convert inputs → Float32Array */
        this.mass = buildFloatArray(mass, N);
        this.drag = buildFloatArray(drag, N);

        /* velocities and 1/m, to prevent millions of divisions */
        this.vel     = new Float32Array(3 * N);
        this.invMass = Float32Array.from(this.mass, m => 1 / m);
    }

    step(dt=0.1) {
        this.energy.gradient(this.emb, this.grad);   // ∇E

        const { pos }     = this.emb;
        const { grad, vel, drag, invMass } = this;

        for (let i = 0; i < this.emb.N; i++) {
            const a = 3 * i;

            /* force = −∇E − γ v */
            const fx = -grad[a]     - drag[i] * vel[a];
            const fy = -grad[a+1]   - drag[i] * vel[a+1];
            const fz = -grad[a+2]   - drag[i] * vel[a+2];


            const invm = invMass[i];


            /* semi-implicit Euler */
            vel[a]     += dt * invm * fx;
            vel[a + 1] += dt * invm * fy;
            vel[a + 2] += dt * invm * fz;

            pos[a]     += dt * vel[a];
            pos[a + 1] += dt * vel[a + 1];
            pos[a + 2] += dt * vel[a + 2];

        }
    }
}
