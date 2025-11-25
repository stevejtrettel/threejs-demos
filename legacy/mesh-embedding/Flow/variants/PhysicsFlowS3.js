
import {buildFloatArray} from "../../utils/buildFloatArray";
import Flow from "../Flow.js";



export class PhysicsFlowS3 extends Flow {
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
        this.vel     = new Float32Array(4 * N);
        this.invMass = Float32Array.from(this.mass, m => 1 / m);

    }

    step(dt=0.1) {

        this.energy.gradient(this.emb, this.grad);   // ∇E

        const { pos }     = this.emb;
        const { grad, vel, drag, invMass } = this;


        for (let i = 0; i < this.emb.N; i++) {
            const a = 4 * i;

            /* force = −∇E − γ v */
            let fx = -grad[a]     - drag[i] * vel[a];
            let fy = -grad[a+1]   - drag[i] * vel[a+1];
            let fz = -grad[a+2]   - drag[i] * vel[a+2];
            let fw = -grad[a+3]   - drag[i] * vel[a+3];


            //project force onto the tangent space at pos!
            // const C = vel[a]*pos[a] + vel[a+1]*pos[a+1] + vel[a+2]*pos[a+2] + vel[a+3]*pos[a+3];
            // fx -= C*pos[a  ];
            // fy -= C*pos[a+1];
            // fz -= C*pos[a+2];
            // fw -= C*pos[a+3];

            const invm = invMass[i];

            /* semi-implicit Euler */
            vel[a]     += dt * invm * fx;
            vel[a + 1] += dt * invm * fy;
            vel[a + 2] += dt * invm * fz;
            vel[a + 3] += dt * invm * fw;


            pos[a]     += dt * vel[a];
            pos[a + 1] += dt * vel[a + 1];
            pos[a + 2] += dt * vel[a + 2];
            pos[a + 3] += dt * vel[a + 3];

            //project position onto the sphere!
            let norm = pos[a]**2 + pos[a+1]**2 + pos[a+2]**2 + pos[a+3]**2;
            norm = Math.sqrt(norm);

            pos[a] /= norm;
            pos[a+1] /= norm;
            pos[a+2] /= norm;
            pos[a+3] /= norm;

            //project velocity onto the tangent space at pos!
            const c = vel[a]*pos[a] + vel[a+1]*pos[a+1] + vel[a+2]*pos[a+2] + vel[a+3]*pos[a+3];
            vel[a  ] -= c*pos[a  ];
            vel[a+1] -= c*pos[a+1];
            vel[a+2] -= c*pos[a+2];
            vel[a+3] -= c*pos[a+3];



        }
    }
}
