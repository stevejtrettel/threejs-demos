
import Vector3 from "./Vector3";


 //3×3 matrix over an arbitrary Field, stored in column-major order.
 // Immutable operations return new Matrix3 instances;
// resetting values of a fixed instance can be done with set

export default class Matrix3 extends Array {

    //ci are all column vectors (instances of Vector3)
    constructor(c0, c1, c2) {
        super(3);
        this[0] = c0;
        this[1] = c1;
        this[2] = c2;

    }

    //set the columns and return this for chaining
    set(c0, c1, c2) {
        this[0] = c0;
        this[1] = c1;
        this[2] = c2;
        return this;
    }


     //Entry at (row i, column j), with 0 <= i,j < 3.
     //NOTE THE INTERNAL TRANSPOSE BEING DONE SINCE WE STORE COLUMN MAJOR
    entry(i, j) {
        return this[j][i];
    }

    clone(){
        return new Matrix3(
            this[0].clone(),
            this[1].clone(),
            this[2].clone()
        );
    }


    //immutable: returns this+M
    add(M) {
        return new Matrix3(
            this[0].add(M[0]),
            this[1].add(M[1]),
            this[2].add(M[2])
        );
    }

  //immutable: returns this-M
    sub(M) {
        return new Matrix3(
            this[0].sub(M[0]),
            this[1].sub(M[1]),
            this[2].sub(M[2])
        );
    }

    //immutable
    scale(s) {
        return new Matrix3(
            this[0].scale(s),
            this[1].scale(s),
            this[2].scale(s)
        );
    }

    //immutable
    //matrix multiplication is just column-by-column the application to each vector!
    //we know how to do this from our Vector3 class
    rightMul(B) {
        return new Matrix3(
            B[0].applyMatrix3(this),
            B[1].applyMatrix3(this),
            B[2].applyMatrix3(this)
        );
    }

    //easy to left multiply now that things are immutable!
    leftMul(B) {
        return B.mul(this);
    }

    //multiply by a vector

    vecMul(v) {
        return this[0].scale(v[0]).add(this[1].scale(v[1]).add(this[2].scale(v[2])));
    }



    // Static identity matrix for the given FieldType
    static identity(FieldType) {
        const o = FieldType.one;
        const z = FieldType.zero;
        return new Matrix3(
            new Vector3(o, z, z),
            new Vector3(z, o, z),
            new Vector3(z, z, o)
        );
    }




    //immutable inverse
    //CHATGPT WROTE THIS (I DIDN'T WANT TO TYPE OUT THINGS USING OUR FIELD CLASSES....SO WE NEED TO CHECK IT)
    inverse() {
        const a = this.entry(0,0), b = this.entry(0,1), c = this.entry(0,2);
        const d = this.entry(1,0), e = this.entry(1,1), f = this.entry(1,2);
        const g = this.entry(2,0), h = this.entry(2,1), i = this.entry(2,2);

        const A =   e.mul(i).sub(f.mul(h));
        const D =   b.mul(i).sub(c.mul(h));
        const G =   b.mul(f).sub(c.mul(e));

        const B =   d.mul(i).sub(f.mul(g));
        const E =   a.mul(i).sub(c.mul(g));
        const H =   a.mul(f).sub(c.mul(d));

        const C =   d.mul(h).sub(e.mul(g));
        const F =   a.mul(h).sub(b.mul(g));
        const I =   a.mul(e).sub(b.mul(d));

        const detInv = this.det().inv();

        return new Matrix3(
            new Vector3(  A, D.neg(),  G).scale(detInv),
            new Vector3( -B,  E,     -H).scale(detInv),
            new Vector3(  C, -F,      I).scale(detInv)
        );
    }


     // Conjugation: returns C * this * C^{-1}
    conj(C) {
        return C.mul(this).mul(C.getInverse());
    }





    //determinant using our field operations
    det() {

        //set the standard names
        const a = this.entry(0,0), b = this.entry(0,1), c = this.entry(0,2);
        const d = this.entry(1,0), e = this.entry(1,1), f = this.entry(1,2);
        const g = this.entry(2,0), h = this.entry(2,1), i = this.entry(2,2);

        //give the determinant formula expanding along the top row
        // a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g)
        return a.mul(e.mul(i).sub(f.mul(h)))
            .sub(b.mul(d.mul(i).sub(f.mul(g))))
            .add(c.mul(d.mul(h).sub(e.mul(g))));
    }

    //immutable transpose
    transpose() {
        return new Matrix3(
            new Vector3(this.entry(0,0), this.entry(0,1), this.entry(0,2)),
            new Vector3(this.entry(1,0), this.entry(1,1), this.entry(1,2)),
            new Vector3(this.entry(2,0), this.entry(2,1), this.entry(2,2))
        );
    }



    /**
     * CHATGPT
     * Return a multi-line string showing the 3×3 matrix in row-major form,
     * using each entry’s prettyPrint() if available.
     */
    prettyPrint() {
        const fmt = c =>
            (c != null && typeof c.prettyPrint === "function")
                ? c.prettyPrint()
                : String(c);

        const rows = [];
        for (let i = 0; i < 3; i++) {
            // grab the row i entries in columns 0,1,2
            const e0 = fmt(this.entry(i, 0));
            const e1 = fmt(this.entry(i, 1));
            const e2 = fmt(this.entry(i, 2));

            rows.push(`[ ${e0} , ${e1} , ${e2} ]`);
        }

        // Join with newlines so console.log shows as a block
        return rows.join("\n");
    }


    realEmbedding(){
        return new Matrix3(
            this[0].realEmbedding(),
            this[1].realEmbedding(),
            this[2].realEmbedding()
        );
    }
}


