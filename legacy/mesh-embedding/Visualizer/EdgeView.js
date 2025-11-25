import {
    CylinderGeometry,
    MeshStandardMaterial,
    InstancedMesh,
    Vector3,
    Quaternion,
    Matrix4, MeshPhysicalMaterial
} from "three";

// Constants
const RADIUS     = 0.025;
const AXIS_Z     = new Vector3(0, 0, 1);      // shared constant


//this has to be FAST: we call it every frame
//use an instanced mesh on the GPU
export default class EdgeView extends InstancedMesh {

    /**
     *  @param {Edges} list of edges
     *  @param {pos} position buffer of vertex positions
     *  @param {number}    color
     */
    constructor( edges, pos, color = 0xffffff) {

        //geometry & material
        const geom = new CylinderGeometry(RADIUS, RADIUS, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);                       // align length along Z
        const mat  = new MeshPhysicalMaterial({ color: color, clearcoat:1 });

        let numEdges = edges.length;
        super(geom, mat, numEdges );

        /* cache integer vertex indices ↓ so we never touch half-edge objects again */
        this.pairs = edges.map(e => [
            e.origin.idx,
            e.next.origin.idx   // always the other vertex of this edge
        ]);

        this.pos = pos;

        /* scratch objects reused every frame */
        this.tmp = {
            start   : new Vector3(),
            end   : new Vector3(),
            mid : new Vector3(),
            dir : new Vector3(),        // b − a
            quat: new Quaternion(),
            scale: new Vector3(1, 1, 1),
            mat : new Matrix4()
        };

        /* one identity upload per instance (done once) */
        const I = new Matrix4();
        for (let i = 0; i < numEdges; ++i) {
            this.setMatrixAt(i, I);
        }

        this.sync();                 // first upload
    }

    /* ---------------------------------------------------------------- */
    /*  Update instance matrices from current embedding                  */
    /* ---------------------------------------------------------------- */
    sync() {

        const pos   = this.pos;
        const { start, end, mid, dir, quat, scale, mat } = this.tmp;

        for (let k = 0; k < this.pairs.length; k++) {

            /* ---- fetch endpoints --------------------------------------- */
            const [i,j] = this.pairs[k];        // cached ints
            const a = 3 * i,   b = 3 * j;

            start.set(pos[a], pos[a + 1], pos[a + 2]);
            end.set(pos[b], pos[b + 1], pos[b + 2]);

            /* ---- midpoint & direction ---------------------------------- */
            dir.subVectors(end,start);                  // dir = end − start
            const len = dir.length();              // cylinder height
            mid.addVectors(start, end).multiplyScalar(0.5);

            /* ---- build transform --------------------------------------- */
            quat.setFromUnitVectors(AXIS_Z, dir.normalize());
            scale.z = len;                         // (1,1,len)
            mat.compose(mid, quat, scale);

            this.setMatrixAt(k, mat);
        }

        this.instanceMatrix.needsUpdate = true;
    }
}



