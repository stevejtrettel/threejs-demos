
import {
    BufferGeometry,
    Float32BufferAttribute,
} from 'three';


//takes in a point array, which is an array of arrays pts[i][j] of vec3s
export default class NumericalSurfaceGeometry extends BufferGeometry {

    constructor( pointArray ) {

        super();

        this.type = 'ParametricGeometry';

        this.parameters = {
            stacks: pointArray.length-1,
            slices: pointArray[0].length-1,
        };
        const sliceCount = this.parameters.slices+1;

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];


        // generate vertices, normals and uvs
        for ( let i = 0; i <= this.parameters.stacks; i ++ ) {

            const v = i / this.parameters.stacks;

            for ( let j = 0; j <= this.parameters.slices; j ++ ) {

                const u = j / this.parameters.slices;

                let pt = pointArray[i][j];
                vertices.push( pt.x,pt.y,pt.z );
                //push nonsense to the normals: we'll fix in a sec
                normals.push(0,1,0);
                //save the uv coords
                uvs.push( u, v );

            }

        }

        // generate indices

        for ( let i = 0; i < this.parameters.stacks; i ++ ) {

            for ( let j = 0; j < this.parameters.slices; j ++ ) {

                const a = i * sliceCount + j;
                const b = i * sliceCount + j + 1;
                const c = ( i + 1 ) * sliceCount + j + 1;
                const d = ( i + 1 ) * sliceCount + j;

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
