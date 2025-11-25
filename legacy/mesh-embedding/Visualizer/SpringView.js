

import {
    CylinderGeometry,
    MeshStandardMaterial,
    InstancedMesh,
    Vector3,
    Quaternion,
    Matrix4,
    Color
} from "three";

// Constants
const RADIUS     = 0.04;
const AXIS_Z     = new Vector3(0, 0, 1);      // shared constant



// Green at 0, smoothly to red as |x| increases.
// 'sigma' controls how quickly you leave green (≈ typical scale of your values).
// 'gamma' shapes the curve (bigger = keep green broader around 0).
function goodBadColor(x, sigma = 1.0, gamma = 1.3) {
    const a = Math.abs(x) / Math.max(1e-12, sigma);

    // Map [0,∞) → [0,1] with a soft-knee (no harsh clipping).
    let t = 1 - Math.exp(-Math.pow(a, gamma));
    t = Math.min(1, Math.max(0, t));

    // Interpolate hue Green(120°) → Red(0°) via Yellow/Orange.
    // Three.js setHSL uses H in [0,1], so 120° = 1/3.
    const hue = (1 / 3) * (1 - t); // 0.333..→0 as t goes 0→1
    const sat = 0.95;              // keep high to avoid muddy/brown tones
    const lig = 0.50;              // mid lightness keeps the ramp vivid

    const color = new Color();
    color.setHSL(hue, sat, lig);
    return color;
}




//this has to be FAST: we call it every frame
//use an instanced mesh on the GPU
export default class SpringView extends InstancedMesh {

    /**
     *  @param {Edges} list of edges
     *  @param {pos} position buffer of vertex positions
     *  @param {number}    color
     */
    constructor( springs, pos, color = 0xffffff) {


        //geometry & material
        const geom = new CylinderGeometry(RADIUS, RADIUS, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);                       // align length along Z
        const mat  = new MeshStandardMaterial({ color: color });

        let numSprings = springs.length;
        super(geom, mat, numSprings );

        /* cache integer vertex indices ↓ so we never touch half-edge objects again */
        this.pairs = springs.map(s => [
            s.i,
            s.j, // always the other vertex of this edge,
            s.rest,
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
        for (let i = 0; i < numSprings; ++i) {
            this.setMatrixAt(i, I);
        }


        this.sigma = 0.075;//how sensitive our coloring is

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
            const [i,j,rest] = this.pairs[k];        // cached ints
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


            //---------SET THE COLOR--------------------
            const diff = len - rest;
            this.setColorAt(k,goodBadColor(diff,this.sigma));

        }

        this.instanceMatrix.needsUpdate = true;
        this.instanceColor.needsUpdate=true;
    }

}



