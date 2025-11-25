import {
    BufferGeometry,
    BufferAttribute,
    DynamicDrawUsage,
    Mesh,
    MeshStandardMaterial,
    DoubleSide,
    MeshPhysicalMaterial
} from "three";

//face triangulation helper
function buildTriangleIndices(faces) {

    // 1. count triangles
    let triCount = 0;
    for (const f of faces){
        triCount += f.vertices.length - 2;
    }

    // 2. allocate one Uint32 per vertex index
    const indices = new Uint32Array(3 * triCount);

    // 3. fill buffer (fan around v[0])
    let k = 0;
    for (const face of faces) {
        const v = face.vertices;
        for (let i = 1; i < v.length - 1; ++i) {
            indices[k++] = v[0].idx;   // root
            indices[k++] = v[i].idx;
            indices[k++] = v[i + 1].idx;
        }
    }
    return indices;
}


//this has to be FAST: we call it every frame
//build our own BufferGeometry directly from emb.position
export default class FaceView extends Mesh {
    constructor(faces, pos, color = 0xffffff) {

        super();


        this.pos = pos;

        // index buffer built once
        this.indices = new BufferAttribute(buildTriangleIndices(faces),1);


        /* material */
        this.material = new MeshPhysicalMaterial({
            color: color,
            //clearcoat:1,
            side: DoubleSide,
            opacity:1,
            transparent:true,
            ior:1,
            transmission:0.3,
        });

        /* geometry */
        this.geometry = new BufferGeometry();

        // vertex positions point directly to pos (Float32Array)
        this.geometry.setAttribute(
            "position",
            new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage)
        );

        //set the indices
        this.geometry.setIndex(this.indices);

        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();   // once upfront
    }

    /* call every frame (or when the embedding changes) */
    sync() {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();

        //   If the surface bends a lot, keep these; if not, call less often.
        this.geometry.computeBoundingSphere();
    }
}
