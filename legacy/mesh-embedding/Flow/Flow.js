
//an abstract class defining dynamics on the space of embeddings
//often this is literally the flow induced by a vector field on embeddings (like gradient descent)
//but it can also be dynamics induced by a VF on the tangent bundle to embeddings (like a physics simulation)
//each subclass of Flow can have different internals, but all expose a step() method modifying an embedding

//this has to be FAST! The main thing we do in the simulation loop is flow.step();
export default class Flow {
    /**
     * @param {Energy}    energy
     * @param {Embedding} emb
     */
    constructor(energy, emb) {
        this.energy = energy;
        this.emb    = emb;

        /* one reusable gradient buffer the same size as emb.pos */
        this.grad   = new Float32Array(emb.pos.length);
        //other subclasses might need auxillary buffers

    }

    //Subclasses must implement a single step of their integrator.
    step(dt) {
        throw new Error("Flow.step() not implemented");
    }


}
