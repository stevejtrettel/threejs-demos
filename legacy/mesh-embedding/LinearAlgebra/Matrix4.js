import Vector4 from "./Vector4";


//4×4 matrix over an arbitrary Field, stored in column-major order.
// Immutable operations return new Matrix4 instances;
// resetting values of a fixed instance can be done with set

export default class Matrix4 extends Array {

    //ci are all column vectors (instances of Vector4)
    constructor(c0, c1, c2, c3) {
        super(4);
        // Validate that all columns are Vector4 instances
        if (!(c0 instanceof Vector4) || !(c1 instanceof Vector4) || 
            !(c2 instanceof Vector4) || !(c3 instanceof Vector4)) {
            throw new Error("All columns must be Vector4 instances");
        }
        this[0] = c0;
        this[1] = c1;
        this[2] = c2;
        this[3] = c3;
    }

    //set the columns and return this for chaining
    set(c0, c1, c2, c3) {
        this[0] = c0;
        this[1] = c1;
        this[2] = c2;
        this[3] = c3;
        return this;
    }


    //Entry at (row i, column j), with 0 <= i,j < 4.
    //NOTE THE INTERNAL TRANSPOSE BEING DONE SINCE WE STORE COLUMN MAJOR
    entry(i, j) {
        return this[j][i];
    }

    clone(){
        return new Matrix4(
            this[0].clone(),
            this[1].clone(),
            this[2].clone(),
            this[3].clone()
        );
    }

    // Check equality with another matrix
    equals(M) {
        return this[0].equals(M[0]) && 
               this[1].equals(M[1]) && 
               this[2].equals(M[2]) && 
               this[3].equals(M[3]);
    }

    //immutable: returns this+M
    add(M) {
        return new Matrix4(
            this[0].add(M[0]),
            this[1].add(M[1]),
            this[2].add(M[2]),
            this[3].add(M[3])
        );
    }

    //immutable: returns this-M
    sub(M) {
        return new Matrix4(
            this[0].sub(M[0]),
            this[1].sub(M[1]),
            this[2].sub(M[2]),
            this[3].sub(M[3])
        );
    }

    //immutable
    scale(s) {
        return new Matrix4(
            this[0].scale(s),
            this[1].scale(s),
            this[2].scale(s),
            this[3].scale(s)
        );
    }

    //immutable
    //matrix multiplication is just column-by-column the application to each vector!
    //we know how to do this from our Vector4 class
    rightMul(B) {
        return new Matrix4(
            B[0].applyMatrix4(this),
            B[1].applyMatrix4(this),
            B[2].applyMatrix4(this),
            B[3].applyMatrix4(this)
        );
    }

    //easy to left multiply now that things are immutable!
    leftMul(B) {
        return B.rightMul(this);
    }

    //multiply by a vector
    vecMul(v) {
        return this[0].scale(v[0])
            .add(this[1].scale(v[1]))
            .add(this[2].scale(v[2]))
            .add(this[3].scale(v[3]));
    }

    // Calculate the trace (sum of diagonal elements)
    trace() {
        return this.entry(0,0).add(this.entry(1,1))
               .add(this.entry(2,2)).add(this.entry(3,3));
    }

    // Static identity matrix for the given FieldType
    static identity(FieldType) {
        const o = FieldType.one;
        const z = FieldType.zero;
        return new Matrix4(
            new Vector4(o, z, z, z),
            new Vector4(z, o, z, z),
            new Vector4(z, z, o, z),
            new Vector4(z, z, z, o)
        );
    }

    // Static zero matrix for the given FieldType
    static zero(FieldType) {
        const z = FieldType.zero;
        const zeroVec = new Vector4(z, z, z, z);
        return new Matrix4(
            zeroVec.clone(),
            zeroVec.clone(),
            zeroVec.clone(),
            zeroVec.clone()
        );
    }

    //immutable inverse using Gauss-Jordan elimination
    inverse() {
        // First check if matrix is singular by computing determinant
        const det = this.det();
        const zero = this.entry(0, 0).constructor.zero;
        if (det.equals(zero)) {
            throw new Error("Matrix is singular (determinant is zero) and cannot be inverted");
        }

        // Create augmented matrix [A|I]
        const n = 4;
        const aug = [];
        const FieldType = this.entry(0, 0).constructor;
        
        // Initialize augmented matrix
        for (let i = 0; i < n; i++) {
            aug[i] = [];
            for (let j = 0; j < n; j++) {
                aug[i][j] = this.entry(i, j);
            }
            // Add identity matrix on the right
            for (let j = 0; j < n; j++) {
                aug[i][j + n] = (i === j) ? FieldType.one : FieldType.zero;
            }
        }

        // Gauss-Jordan elimination with partial pivoting
        for (let i = 0; i < n; i++) {
            // Find pivot with largest magnitude (if field supports comparison)
            let pivot = i;
            let maxFound = false;
            
            // Simple pivot selection - find first non-zero element
            for (let k = i; k < n; k++) {
                if (!aug[k][i].equals(zero)) {
                    pivot = k;
                    maxFound = true;
                    break;
                }
            }
            
            if (!maxFound) {
                throw new Error("Matrix is singular - no non-zero pivot found");
            }
            
            // Swap rows if needed
            if (pivot !== i) {
                [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
            }
            
            // Scale pivot row
            const pivotVal = aug[i][i];
            const pivotInv = pivotVal.inverse ? pivotVal.inverse() : FieldType.one.div(pivotVal);
            for (let j = 0; j < 2 * n; j++) {
                aug[i][j] = aug[i][j].mul(pivotInv);
            }
            
            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = 0; j < 2 * n; j++) {
                        aug[k][j] = aug[k][j].sub(factor.mul(aug[i][j]));
                    }
                }
            }
        }

        // Extract inverse matrix from right side
        const invCols = [];
        for (let j = 0; j < n; j++) {
            const col = [];
            for (let i = 0; i < n; i++) {
                col.push(aug[i][j + n]);
            }
            invCols.push(new Vector4(col[0], col[1], col[2], col[3]));
        }

        return new Matrix4(invCols[0], invCols[1], invCols[2], invCols[3]);
    }

    // Power of a matrix - For negative powers, computes (M^(-1))^|n|
    pow(n) {
        if (!Number.isInteger(n)) {
            throw new Error("Power must be an integer");
        }
        
        // Get the field type from the matrix entries
        const FieldType = this.entry(0, 0).constructor;
        
        // Handle special cases
        if (n === 0) {
            return Matrix4.identity(FieldType);
        }
        
        if (n === 1) {
            return this.clone();
        }
        
        if (n === -1) {
            return this.inverse();
        }
        
        // For negative powers, compute inverse first then raise to positive power
        if (n < 0) {
            return this.inverse().pow(-n);
        }
        
        // Exponentiation by squaring for positive powers
        // This reduces O(n) multiplications to O(log n)
        let result = Matrix4.identity(FieldType);
        let base = this.clone();
        let exponent = n;
        
        while (exponent > 0) {
            // If exponent is odd, multiply result by current base
            if (exponent % 2 === 1) {
                result = result.rightMul(base);
            }
            
            // Square the base and halve the exponent
            base = base.rightMul(base);
            exponent = Math.floor(exponent / 2);
        }
        
        return result;
    }
    

    // Conjugation: returns C * this * C^{-1}
    conj(C) {
        return C.rightMul(this).rightMul(C.inverse());
    }

    //determinant using cofactor expansion along first row
    det() {
        const a00 = this.entry(0,0), a01 = this.entry(0,1), a02 = this.entry(0,2), a03 = this.entry(0,3);
        
        // Calculate 3x3 minors for first row
        // Minor M00: remove row 0, col 0
        const m00 = this._det3x3(
            this.entry(1,1), this.entry(1,2), this.entry(1,3),
            this.entry(2,1), this.entry(2,2), this.entry(2,3),
            this.entry(3,1), this.entry(3,2), this.entry(3,3)
        );
        
        // Minor M01: remove row 0, col 1
        const m01 = this._det3x3(
            this.entry(1,0), this.entry(1,2), this.entry(1,3),
            this.entry(2,0), this.entry(2,2), this.entry(2,3),
            this.entry(3,0), this.entry(3,2), this.entry(3,3)
        );
        
        // Minor M02: remove row 0, col 2
        const m02 = this._det3x3(
            this.entry(1,0), this.entry(1,1), this.entry(1,3),
            this.entry(2,0), this.entry(2,1), this.entry(2,3),
            this.entry(3,0), this.entry(3,1), this.entry(3,3)
        );
        
        // Minor M03: remove row 0, col 3
        const m03 = this._det3x3(
            this.entry(1,0), this.entry(1,1), this.entry(1,2),
            this.entry(2,0), this.entry(2,1), this.entry(2,2),
            this.entry(3,0), this.entry(3,1), this.entry(3,2)
        );
        
        // Apply cofactor expansion with alternating signs
        return a00.mul(m00).sub(a01.mul(m01)).add(a02.mul(m02)).sub(a03.mul(m03));
    }

    // Helper method to calculate 3x3 determinant
    // Matrix elements in row-major order:
    // | a b c |
    // | d e f |
    // | g h i |
    _det3x3(a, b, c, d, e, f, g, h, i) {
        return a.mul(e.mul(i).sub(f.mul(h)))
            .sub(b.mul(d.mul(i).sub(f.mul(g))))
            .add(c.mul(d.mul(h).sub(e.mul(g))));
    }

    //immutable transpose
    transpose() {
        return new Matrix4(
            new Vector4(this.entry(0,0), this.entry(0,1), this.entry(0,2), this.entry(0,3)),
            new Vector4(this.entry(1,0), this.entry(1,1), this.entry(1,2), this.entry(1,3)),
            new Vector4(this.entry(2,0), this.entry(2,1), this.entry(2,2), this.entry(2,3)),
            new Vector4(this.entry(3,0), this.entry(3,1), this.entry(3,2), this.entry(3,3))
        );
    }

    /**
     * Return a multi-line string showing the 4×4 matrix in row-major form,
     * using each entry's prettyPrint() if available.
     */
    prettyPrint() {
        const fmt = c =>
            (c != null && typeof c.prettyPrint === "function")
                ? c.prettyPrint()
                : String(c);

        const rows = [];
        for (let i = 0; i < 4; i++) {
            // grab the row i entries in columns 0,1,2,3
            const e0 = fmt(this.entry(i, 0));
            const e1 = fmt(this.entry(i, 1));
            const e2 = fmt(this.entry(i, 2));
            const e3 = fmt(this.entry(i, 3));

            rows.push(`[ ${e0} , ${e1} , ${e2} , ${e3} ]`);
        }

        // Join with newlines so console.log shows as a block
        return rows.join("\n");
    }

    // Create a real embedding of this matrix (requires field elements to support realEmbedding())
    realEmbedding(){
        return new Matrix4(
            this[0].realEmbedding(),
            this[1].realEmbedding(),
            this[2].realEmbedding(),
            this[3].realEmbedding()
        );
    }

    // Static method to create change of basis matrix
    // Single argument: returns matrix that transforms from standard basis to newBasis
    // Two arguments: returns matrix that transforms from fromBasis to toBasis
    static changeOfBasisMatrix(fromBasisOrNewBasis, toBasis = null) {
        if (toBasis === null) {
            // Single argument case: standard basis to new basis
            const newBasis = fromBasisOrNewBasis;
            const det = newBasis.det();
            const zero = newBasis.entry(0, 0).constructor.zero;
            if (det.equals(zero)) {
                throw new Error("Basis vectors are not linearly independent (determinant is zero)");
            }
            // To convert from standard to new basis, we need P^(-1)
            return newBasis.inverse();
        } else {
            // Two argument case: fromBasis to toBasis
            const fromBasis = fromBasisOrNewBasis;
            
            // Check both bases are valid
            const detFrom = fromBasis.det();
            const detTo = toBasis.det();
            const zero = fromBasis.entry(0, 0).constructor.zero;
            
            if (detFrom.equals(zero)) {
                throw new Error("'fromBasis' vectors are not linearly independent");
            }
            if (detTo.equals(zero)) {
                throw new Error("'toBasis' vectors are not linearly independent");
            }
            
            // To convert from one basis to another: toBasis^(-1) * fromBasis
            return toBasis.inverse().rightMul(fromBasis);
        }
    }

    // Create a function that transforms vectors between bases
    // Single argument: returns function that transforms from standard basis to newBasis
    // Two arguments: returns function that transforms from fromBasis to toBasis
    static createBasisTransform(fromBasisOrNewBasis, toBasis = null) {
        let transformMatrix;
        
        if (toBasis === null) {
            // Single argument: transform from standard basis to the given basis
            const newBasis = fromBasisOrNewBasis;
            const FieldType = newBasis.entry(0, 0).constructor;
            const identity = Matrix4.identity(FieldType);
            transformMatrix = Matrix4.changeOfBasisMatrix(identity, newBasis);
        } else {
            // Two arguments: transform from fromBasis to toBasis
            transformMatrix = Matrix4.changeOfBasisMatrix(fromBasisOrNewBasis, toBasis);
        }
        
        // Return a function that applies the transformation
        return (vector) => {
            if (!vector || typeof vector.length === 'undefined' || vector.length !== 4) {
                throw new Error("Input must be a 4-dimensional vector");
            }
            return transformMatrix.vecMul(vector);
        };
    }

    // Check if this matrix represents a valid basis (linearly independent columns)
    isValidBasis() {
        const det = this.det();
        const zero = this.entry(0, 0).constructor.zero;
        return !det.equals(zero);
    }
}