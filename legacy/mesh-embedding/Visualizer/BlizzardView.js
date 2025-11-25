import {
    Mesh,
    InstancedMesh,
    Group,
    SphereGeometry,
    MeshStandardMaterial,
    Matrix4,
    BufferGeometry,
    BufferAttribute,
    Vector3, CylinderGeometry, Quaternion, DoubleSide
} from "three";

//This is just a class for testing things when we build the hyperbolic tiling
//Before assembling a proper topology (with indexed faces, etc), we can take a non-indexed list of triagnles
// and draw the corresponding geometry.
//A BLIZZARD is an array of triangles with no relations to one another.  Each triangle is an array of 3 points,
//each point is an array of 3 coordinates.  So, a triangle is
// T = [[x1,y1,z1], [x2,y2,z2], [x3,y3,z3]]
//A Blizzard is then [T0,T1,T2,....TN]

class BlizzardVertices extends InstancedMesh{
    constructor(blizzard) {
        //number of vertices = 3 times the number of triangles
        const vertexCount = blizzard.length * 3;
        const radius   = 0.05;
        const color = 0x000000;
        super(
            new SphereGeometry(radius, 8, 8),
            new MeshStandardMaterial({ color: color }),
            vertexCount
        );

        let M = new Matrix4();//one matrix to not be allocating all day long

        /* initialise all instance matrices using the vertex coordinates */
        for (let i = 0; i < blizzard.length; ++i){
            for(let j=0;j<3;j++) {
                let idx = 3*i+j;
                let p = blizzard[i][j];
                M.makeTranslation(p[0],p[1],p[2]);
                this.setMatrixAt(idx, M);
            }
        }
    }
}






class BlizzardEdges extends InstancedMesh{
    constructor(blizzard) {

        // Constants
        const RADIUS     = 0.025;
        const AXIS_Z     = new Vector3(0, 0, 1);      // shared constant
        const color = 0x456abc;

        //geometry & material
        const geom = new CylinderGeometry(RADIUS, RADIUS, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);                       // align length along Z
        const material  = new MeshStandardMaterial({ color: color });

        let edgeCount = 3*blizzard.length;
        super(geom, material, edgeCount );

        //------orient the edges correctly with the instance matrix

        let start = new Vector3();
        let end = new Vector3();
        let mid = new Vector3();
        let dir = new Vector3();       // b − a
        let quat = new Quaternion();
        let scale = new Vector3(1, 1, 1);
        let mat = new Matrix4();


        for(let i=0; i<blizzard.length; i++){
            for(let j=0;j<3;j++){
                const idx = 3*i+j;

                //fetch endpoints: blizzard[i][j] and blizzard[i][(j+1)%3]
                start.set(...blizzard[i][j]);
                end.set(...blizzard[i][(j+1)%3]);

                /* ---- midpoint & direction ---------------------------------- */
                dir.subVectors(end,start);                  // dir = end − start
                const len = dir.length();              // cylinder height
                mid.addVectors(start, end).multiplyScalar(0.5);

                /* ---- build transform --------------------------------------- */
                quat.setFromUnitVectors(AXIS_Z, dir.normalize());
                scale.z = len;                         // (1,1,len)
                mat.compose(mid, quat, scale);

                this.setMatrixAt(idx, mat);

            }
        }
    }
}


class BlizzardFaces extends Mesh{
    constructor(blizzard) {

        const color = 0xffe9ad;

        // Build the buffer geometry from the flat list of triangle vertices
        const geometry = new BufferGeometry();
        // Each triangle has 3 vertices, each vertex has 3 components
        const vertexCount = blizzard.length * 3;
        const positions = new Float32Array(vertexCount * 3);

        // Flatten the triangles into the position array
        for (let i = 0; i < blizzard.length; i++) {
            const tri = blizzard[i];
            for (let j = 0; j < 3; j++) {
                const [x, y, z] = tri[j];
                const offset = (i * 3 + j) * 3;
                positions[offset] = x;
                positions[offset + 1] = y;
                positions[offset + 2] = z;
            }
        }

        geometry.setAttribute('position', new BufferAttribute(positions, 3));
        // Compute normals for correct lighting
        geometry.computeVertexNormals();


        //make the  material:
        const material = new MeshStandardMaterial({color:color, side:DoubleSide});

        //create the mesh!
        super(geometry, material);
    }
}





//the general blizzard visualizer just combines the previous classes
export default class BlizzardView extends Group{
    constructor(blizzard) {
        super();

        this.vertices = new BlizzardVertices(blizzard);
        this.edges = new BlizzardEdges(blizzard);
        this.faces = new BlizzardFaces(blizzard);

        this.add(this.vertices);
        this.add(this.edges);
        this.add(this.faces);

    }
}
