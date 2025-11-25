import {
    SphereGeometry,
    MeshStandardMaterial,
    InstancedMesh,
    Matrix4
} from "three";


//this has to be FAST: we call it every frame
//use an instanced mesh on the GPU
export default class VertexView extends InstancedMesh {

    /**
     * @param {Vertices} list of vertices
     * @param {pos} position buffer of vertex positions
     * @param {number}    color
     */
    constructor( vertices, pos, color = 0xffffff) {
        const radius   = 0.05;

        super(
            new SphereGeometry(radius, 8, 8),
            new MeshStandardMaterial({ color: color }),
            vertices.length
        );

        /* cache everything we need each frame */
        this.ids = vertices.map(v => v.idx);  // integer indices
        this.pos = pos;


        this._M  = new Matrix4();              // reused transform

        /* initialise all instance matrices to identity once */
        for (let i = 0; i < vertices.length; ++i){
            this.setMatrixAt(i, this._M);
        }

        this.sync();                           // first upload
    }

    //Update the instanced matrices from the current embedding.
    sync() {
        const pos = this.pos;    // Float32Array (xyz xyz …)
        const M   = this._M;

        for (let i = 0; i < this.ids.length; ++i) {
            const base = 3 * this.ids[i];        // offset into pos[]
            const x = pos[base ],
                y = pos[base + 1],
                z = pos[base + 2];

            /* rewrite the same Matrix4 in place, then upload */
            M.makeTranslation(x, y, z);
            this.setMatrixAt(i, M);
        }

        this.instanceMatrix.needsUpdate = true;
    }
}
