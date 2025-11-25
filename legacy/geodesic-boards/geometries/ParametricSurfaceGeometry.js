import {
    BufferGeometry,
    Float32BufferAttribute,
    Vector3
} from 'three';

//creates a parametric surface from a function (u,v)->(x,y,z)
let defaultFn = function(u,v){
    let x = u;
    let y = v;
    let z = Math.sin(2*Math.PI*u*v);

    return new Vector3(x,y,z);
}


export default class ParametricSurfaceGeometry extends BufferGeometry {

    constructor( f=defaultFn, domain=[[0,1],[0,1]], slices = 64, stacks = 64 ) {

        super();

        this.type = 'ParametricGeometry';

        //normalize function so that it reads in elements of the domain [0,1]x[0,1]
        let uStart = domain[0][0];
        let uEnd = domain[0][1];
        let uRange = uEnd-uStart;

        let vStart = domain[1][0];
        let vEnd = domain[1][1];
        let vRange = vEnd-vStart;

        let func = function(u,v){
            let U = uStart + uRange*u;
            let V = vStart + vRange*v;
            return f(U,V);
        }

        this.parameters = {
            func: func,
            domain:domain,
            slices: slices,
            stacks: stacks
        };



        // buffers

        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];

        const EPS = 0.00001;

        const normal = new Vector3();

        let p0 = new Vector3(), p1 = new Vector3();
        let pu = new Vector3(), pv = new Vector3();

        // generate vertices, normals and uvs

        const sliceCount = slices + 1;

        for ( let i = 0; i <= stacks; i ++ ) {

            const v = i / stacks;

            for ( let j = 0; j <= slices; j ++ ) {

                const u = j / slices;

                // vertex

                p0 = func( u, v );
                vertices.push( p0.x, p0.y, p0.z );

                // normal

                // approximate tangent vectors via finite differences

                if ( u - EPS >= 0 ) {

                    p1 = func( u - EPS, v );
                    pu.subVectors( p0, p1 );

                } else {

                    p1= func( u + EPS, v );
                    pu.subVectors( p1, p0 );

                }

                if ( v - EPS >= 0 ) {

                    p1 = func( u, v - EPS );
                    pv.subVectors( p0, p1 );

                } else {

                    p1 = func( u, v + EPS);
                    pv.subVectors( p1, p0 );

                }

                // cross product of tangent vectors returns surface normal

                normal.crossVectors( pu, pv ).normalize();
                normals.push( normal.x, normal.y, normal.z );

                // uv

                uvs.push( u, v );

            }

        }

        // generate indices

        for ( let i = 0; i < stacks; i ++ ) {

            for ( let j = 0; j < slices; j ++ ) {

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

    }

    copy( source ) {

        super.copy( source );

        this.parameters = Object.assign( {}, source.parameters );

        return this;

    }

}
