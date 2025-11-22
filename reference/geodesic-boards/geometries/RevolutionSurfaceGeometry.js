import {BufferGeometry, CatmullRomCurve3, Float32BufferAttribute,Vector3} from "three";


//the point array are points along a curve
//we build a CatmullRom curve from these, then sample it
export default class RevolutionSurfaceGeometry extends BufferGeometry{

    constructor( curve, res=128 ) {

        super();

        this.type = 'RevolutionGeometry';

        this.N = res;

        //stacks = rsteps
        //slices = thetasteps
        this.parameters = {
            rsteps: this.N-1,
            tsteps: this.N-1,
        };

        const tStepCount = this.parameters.tsteps+1;

        //curve from points:
        // let vec3Pts = [];
        // for(let i=0;i<this.N; i++){
        //     let p = pointArray[i];
        //     vec3Pts.push(new Vector3(p[1],p[2],0))
        // }
        // let curve = new CatmullRomCurve3(vec3Pts);

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];

        // generate vertices, normals and uvs
        for ( let i = 0; i <= this.parameters.rsteps; i ++ ) {

            const ri = i / this.parameters.rsteps;

            let coords = curve.getPointAt(ri);

            for ( let j = 0; j <= this.parameters.tsteps; j ++ ) {

                const tj = j / this.parameters.tsteps;
                let angle = 2*Math.PI*tj;

                let R = coords.x;
                let z = coords.y;
                let pt = new Vector3(R*Math.cos(angle),R*Math.sin(angle),z);
                vertices.push( pt.x,pt.y,pt.z );
                //push nonsense to the normals: we'll fix in a sec
                normals.push(0,1,0);
                //save the uv coords
                uvs.push( tj, ri );
            }
        }

        // generate indices

        for ( let i = 0; i < this.parameters.rsteps; i ++ ) {

            for ( let j = 0; j < this.parameters.tsteps; j ++ ) {

                const a = i * tStepCount + j;
                const b = i * tStepCount + j + 1;
                const c = ( i + 1 ) * tStepCount + j + 1;
                const d = ( i + 1 ) * tStepCount + j;

                // faces one and two

                indices.push( a, b, d );
                indices.push( b, c, d );

            }

        }

        // build geometry

        this.setIndex( indices );
        this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
        this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
        this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

        //normals
        this.computeVertexNormals();
    }

    copy( source ) {

        super.copy( source );

        this.parameters = Object.assign( {}, source.parameters );

        return this;

    }

}
