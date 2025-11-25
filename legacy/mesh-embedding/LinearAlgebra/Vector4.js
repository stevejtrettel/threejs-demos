// A 4D vector over an arbitrary Field.
// Immutable operations return new Vector4 instances, but mutation helpers are provided via set() and property setters.

export default class Vector4 extends Array {

    constructor(x, y, z, w) {
        super(4);
        this[0] = x;
        this[1] = y;
        this[2] = z;
        this[3] = w;
    }

    //reset the vectors components in place
    set(x, y, z, w) {
        this[0] = x;
        this[1] = y;
        this[2] = z;
        this[3] = w;
        return this;
    }

    // Component accessors: read or set the value of each component
    get x() { return this[0]; }
    set x(val) { this[0] = val; }
    get y() { return this[1]; }
    set y(val) { this[1] = val; }
    get z() { return this[2]; }
    set z(val) { this[2] = val; }
    get w() { return this[3]; }
    set w(val) { this[3] = val; }


    clone() {
        return new Vector4(this[0], this[1], this[2], this[3]);
    }

    equals(v) {
        return this[0].equals(v[0]) &&
            this[1].equals(v[1]) &&
            this[2].equals(v[2]) &&
            this[3].equals(v[3]);
    }


    add(v) {
        return new Vector4(
            this[0].add(v[0]),
            this[1].add(v[1]),
            this[2].add(v[2]),
            this[3].add(v[3])
        );
    }


    sub(v) {
        return new Vector4(
            this[0].sub(v[0]),
            this[1].sub(v[1]),
            this[2].sub(v[2]),
            this[3].sub(v[3])
        );
    }


    scale(scalar) {
        return new Vector4(
            this[0].mul(scalar),
            this[1].mul(scalar),
            this[2].mul(scalar),
            this[3].mul(scalar)
        );
    }


    /// Apply a matrix4: returns M[0]*x + M[1]*y + M[2]*z + M[3]*w
    //Matrix4 is an array of four Vector4
    applyMatrix4(M) {
        return M[0].scale(this[0])
            .add(M[1].scale(this[1]))
            .add(M[2].scale(this[2]))
            .add(M[3].scale(this[3]));
    }



    realEmbedding(){
        //embed in R as array [x,y,z,w]
        const x = this[0].realEmbedding();
        const y = this[1].realEmbedding();
        const z = this[2].realEmbedding();
        const w = this[3].realEmbedding();

        return new Vector4(x,y,z,w);
    }



    //standard basis
    static basis(i, FieldType) {
        const z = FieldType.zero;
        const o = FieldType.one;
        switch (i) {
            case 0: return new Vector4(o, z, z, z);
            case 1: return new Vector4(z, o, z, z);
            case 2: return new Vector4(z, z, o, z);
            case 3: return new Vector4(z, z, z, o);
            default:
                throw new Error(`basis index must be 0,1,2,3 (got ${i})`);
        }
    }





    /**
     * CHATGPT
     * Return a string "(x, y, z, w)", calling each component's
     * prettyPrint() if available, otherwise toString().
     */
    prettyPrint() {
        const fmt = c =>
            (c != null && typeof c.prettyPrint === "function")
                ? c.prettyPrint()
                : String(c);
        return `(${fmt(this[0])}, ${fmt(this[1])}, ${fmt(this[2])}, ${fmt(this[3])})`;
    }


}