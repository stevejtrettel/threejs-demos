

 // A 3D vector over an arbitrary Field.
 // Immutable operations return new Vector3 instances, but mutation helpers are provided via set() and property setters.

export default class Vector3 extends Array {

    constructor(x, y, z) {
        super(3);
        this[0] = x;
        this[1] = y;
        this[2] = z;
    }

    //reset the vectors components in place
    set(x, y, z) {
        this[0] = x;
        this[1] = y;
        this[2] = z;
        return this;
    }

    // Component accessors: read or set the value of each component
    get x() { return this[0]; }
    set x(val) { this[0] = val; }
    get y() { return this[1]; }
    set y(val) { this[1] = val; }
    get z() { return this[2]; }
    set z(val) { this[2] = val; }


    clone() {
        return new Vector3(this[0], this[1], this[2]);
    }


    add(v) {
        return new Vector3(
            this[0].add(v[0]),
            this[1].add(v[1]),
            this[2].add(v[2])
        );
    }


    sub(v) {
        return new Vector3(
            this[0].sub(v[0]),
            this[1].sub(v[1]),
            this[2].sub(v[2])
        );
    }


    scale(scalar) {
        return new Vector3(
            this[0].mul(scalar),
            this[1].mul(scalar),
            this[2].mul(scalar)
        );
    }


     /// Apply a matrix3: returns M[0]*x + M[1]*y + M[2]*z
     //Matrix3 is an array of three Vector3
    applyMatrix3(M) {
        return M[0].scale(this[0])
            .add(M[1].scale(this[1]))
            .add(M[2].scale(this[2]));
    }



    realEmbedding(){
        //embed in R as array [x,y,z]
        const x = this[0].realEmbedding();
        const y = this[1].realEmbedding();
        const z = this[2].realEmbedding();

        return new Vector3(x,y,z);
    }



    //standard basis
    static basis(i, FieldType) {
        const z = FieldType.zero;
        const o = FieldType.one;
        switch (i) {
            case 0: return new Vector3(o, z, z);
            case 1: return new Vector3(z, o, z);
            case 2: return new Vector3(z, z, o);
            default:
                throw new Error(`basis index must be 0,1,2 (got ${i})`);
        }
    }





    /**
     * CHATGPT
     * Return a string "(x, y, z)", calling each component’s
     * prettyPrint() if available, otherwise toString().
     */
    prettyPrint() {
        const fmt = c =>
            (c != null && typeof c.prettyPrint === "function")
                ? c.prettyPrint()
                : String(c);
        return `(${fmt(this[0])}, ${fmt(this[1])}, ${fmt(this[2])})`;
    }


}
