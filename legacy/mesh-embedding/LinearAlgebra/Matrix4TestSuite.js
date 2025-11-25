import Matrix4 from './Matrix4.js';
import Vector4 from './Vector4.js';
import Rational from './Field/Rational.js';
import QuadraticField5 from './Field/QuadraticField5.js';

/**
 * Test suite for Matrix4 class
 */
function runTests() {
    console.log("=== Matrix4 Test Suite ===\n");

    // Test 1: Basic construction and access
    console.log("Test 1: Construction and Access");
    test("Matrix construction", () => {
        const v0 = new Vector4(new Rational(1), new Rational(2), new Rational(3), new Rational(4));
        const v1 = new Vector4(new Rational(5), new Rational(6), new Rational(7), new Rational(8));
        const v2 = new Vector4(new Rational(9), new Rational(10), new Rational(11), new Rational(12));
        const v3 = new Vector4(new Rational(13), new Rational(14), new Rational(15), new Rational(16));
        
        const M = new Matrix4(v0, v1, v2, v3);
        
        console.log("Matrix M:");
        console.log(M.prettyPrint());
        
        // Test entry access (remember: entry(row, col) but stored column-major)
        assert(M.entry(0, 0).equals(new Rational(1)), "Entry (0,0) should be 1");
        assert(M.entry(1, 0).equals(new Rational(2)), "Entry (1,0) should be 2");
        assert(M.entry(0, 1).equals(new Rational(5)), "Entry (0,1) should be 5");
        assert(M.entry(3, 3).equals(new Rational(16)), "Entry (3,3) should be 16");
    });

    test("Invalid construction", () => {
        try {
            const M = new Matrix4("not", "vector", "instances", "here");
            assert(false, "Should have thrown error");
        } catch (e) {
            console.log(`    Expected error: ${e.message}`);
            assert(e.message.includes("Vector4"));
        }
    });

    // Test 2: Identity and Zero matrices
    console.log("\nTest 2: Special Matrices");
    test("Identity matrix", () => {
        const I = Matrix4.identity(Rational);
        console.log("Identity matrix:");
        console.log(I.prettyPrint());
        
        assert(I.entry(0, 0).equals(Rational.one));
        assert(I.entry(1, 1).equals(Rational.one));
        assert(I.entry(0, 1).equals(Rational.zero));
        assert(I.trace().equals(new Rational(4)));
    });

    test("Zero matrix", () => {
        const Z = Matrix4.zero(Rational);
        console.log("Zero matrix:");
        console.log(Z.prettyPrint());
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                assert(Z.entry(i, j).equals(Rational.zero));
            }
        }
    });

    // Test 3: Basic operations
    console.log("\nTest 3: Basic Operations");
    test("Matrix addition and subtraction", () => {
        const A = Matrix4.identity(Rational);
        const B = Matrix4.identity(Rational).scale(new Rational(2));
        
        const C = A.add(B);
        console.log("I + 2I = 3I:");
        console.log(C.prettyPrint());
        
        assert(C.entry(0, 0).equals(new Rational(3)));
        assert(C.trace().equals(new Rational(12)));
        
        const D = C.sub(A);
        console.log("\n3I - I = 2I:");
        console.log(D.prettyPrint());
        assert(D.equals(B));
    });

    test("Scalar multiplication", () => {
        const A = Matrix4.identity(Rational);
        const s = new Rational(5);
        const B = A.scale(s);
        
        console.log("5 * I:");
        console.log(B.prettyPrint());
        
        assert(B.entry(0, 0).equals(new Rational(5)));
        assert(B.entry(1, 1).equals(new Rational(5)));
        assert(B.trace().equals(new Rational(20)));
    });

    // Test 4: Matrix multiplication
    console.log("\nTest 4: Matrix Multiplication");
    test("Matrix multiplication", () => {
        // Create simple 2x2 rotation matrices embedded in 4x4 that don't commute
        // A rotates in the (0,1) plane
        const A = new Matrix4(
            new Vector4(new Rational(0), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(-1), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        // B rotates in the (1,2) plane  
        const B = new Matrix4(
            new Vector4(new Rational(1), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(-1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        const C = A.rightMul(B);
        console.log("A * B:");
        console.log(C.prettyPrint());
        
        const D = B.rightMul(A);
        console.log("\nB * A:");
        console.log(D.prettyPrint());
        
        // These rotations in different planes don't commute
        assert(!C.equals(D), "Matrix multiplication should not be commutative");
        
        // Verify the multiplication worked correctly by checking the identity
        const I = Matrix4.identity(Rational);
        const AtA = A.transpose().rightMul(A);
        const BtB = B.transpose().rightMul(B);
        assert(AtA.equals(I), "A should be orthogonal (A^T * A = I)");
        assert(BtB.equals(I), "B should be orthogonal (B^T * B = I)");
    });

    test("Matrix-vector multiplication", () => {
        const M = Matrix4.identity(QuadraticField5);
        const v = new Vector4(new QuadraticField5(1), new QuadraticField5(2), new QuadraticField5(3), new QuadraticField5(4));
        
        const result = M.vecMul(v);
        console.log("I * v = v:");
        console.log(`[${result[0]}, ${result[1]}, ${result[2]}, ${result[3]}]`);
        
        assert(result[0].equals(v[0]));
        assert(result[1].equals(v[1]));
        assert(result[2].equals(v[2]));
        assert(result[3].equals(v[3]));

        // Test multiplication with a non-identity matrix
        const N = new Matrix4(
            new Vector4(new QuadraticField5(2,1), new QuadraticField5(0), new QuadraticField5(5,1), new QuadraticField5(0)),
            new Vector4(new QuadraticField5(0), new QuadraticField5(3,1), new QuadraticField5(0), new QuadraticField5(0)),
            new Vector4(new QuadraticField5(0), new QuadraticField5(0), new QuadraticField5(4,1), new QuadraticField5(0)),
            new Vector4(new QuadraticField5(0), new QuadraticField5(0), new QuadraticField5(0), new QuadraticField5(5,1))
        );
        const result2 = N.vecMul(v);
        // print the whole matrix and the vector and then the result
        console.log("Matrix N:");
        console.log(N.prettyPrint());
        console.log("Vector v:");
        console.log(v.prettyPrint());
        console.log("Result of N * v:");
        console.log(result2.prettyPrint());
    });

    // Test 5: Transpose
    console.log("\nTest 5: Transpose");
    test("Matrix transpose", () => {
        const A = new Matrix4(
            new Vector4(new Rational(1), new Rational(2), new Rational(3), new Rational(4)),
            new Vector4(new Rational(5), new Rational(6), new Rational(7), new Rational(8)),
            new Vector4(new Rational(9), new Rational(10), new Rational(11), new Rational(12)),
            new Vector4(new Rational(13), new Rational(14), new Rational(15), new Rational(16))
        );
        
        const AT = A.transpose();
        console.log("Original A:");
        console.log(A.prettyPrint());
        console.log("\nTranspose A^T:");
        console.log(AT.prettyPrint());
        
        // Check that (A^T)_ij = A_ji
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                assert(AT.entry(i, j).equals(A.entry(j, i)));
            }
        }
        
        // Check that (A^T)^T = A
        const ATT = AT.transpose();
        assert(ATT.equals(A), "(A^T)^T should equal A");
    });

    // Test 6: Determinant
    console.log("\nTest 6: Determinant");
    test("Determinant of special matrices", () => {
        const I = Matrix4.identity(Rational);
        const detI = I.det();
        console.log(`det(I) = ${detI}`);
        assert(detI.equals(Rational.one), "det(I) should be 1");
        
        const Z = Matrix4.zero(Rational);
        const detZ = Z.det();
        console.log(`det(0) = ${detZ}`);
        assert(detZ.equals(Rational.zero), "det(0) should be 0");
    });

    test("Determinant of general matrix", () => {
        // Create a matrix with known determinant
        const M = new Matrix4(
            new Vector4(new Rational(2), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(3), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(4), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(5))
        );
        
        const det = M.det();
        console.log("Diagonal matrix determinant:");
        console.log(`det(M) = ${det}`);
        assert(det.equals(new Rational(120)), "det should be 2*3*4*5 = 120");
    });

    // Test 7: Inverse
    console.log("\nTest 7: Matrix Inverse");
    test("Inverse of identity", () => {
        const I = Matrix4.identity(Rational);
        const Iinv = I.inverse();
        console.log("I^(-1) = I:");
        console.log(Iinv.prettyPrint());
        assert(Iinv.equals(I), "Inverse of identity should be identity");
    });

    test("Inverse of general matrix", () => {
        // Create an invertible matrix
        const M = new Matrix4(
            new Vector4(new Rational(2), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(1), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        const Minv = M.inverse();
        console.log("M^(-1):");
        console.log(Minv.prettyPrint());
        
        // Check M * M^(-1) = I
        const product = M.rightMul(Minv);
        const I = Matrix4.identity(Rational);
        assert(product.equals(I), "M * M^(-1) should equal I");
        
        // Check M^(-1) * M = I
        const product2 = Minv.rightMul(M);
        assert(product2.equals(I), "M^(-1) * M should equal I");
    });

    test("Singular matrix inverse", () => {
        const M = Matrix4.zero(Rational);
        try {
            M.inverse();
            assert(false, "Should have thrown error for singular matrix");
        } catch (e) {
            console.log(`    Expected error: ${e.message}`);
            assert(e.message.includes("singular"));
        }
    });

    // Test 8: Basis operations
    console.log("\nTest 8: Change of Basis");
    test("Basis validation", () => {
        const I = Matrix4.identity(Rational);
        assert(I.isValidBasis(), "Identity should be a valid basis");
        
        const Z = Matrix4.zero(Rational);
        assert(!Z.isValidBasis(), "Zero matrix should not be a valid basis");
    });

    test("Change of basis matrix", () => {
        const I = Matrix4.identity(Rational);
        
        // Create a simple basis change (permutation)
        const newBasis = new Matrix4(
            new Vector4(new Rational(0), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(1), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        const T = Matrix4.changeOfBasisMatrix(I, newBasis);
        console.log("Change of basis matrix:");
        console.log(T.prettyPrint());
        
        // Test the transformation
        const v = new Vector4(new Rational(1), new Rational(2), new Rational(3), new Rational(4));
        const vNew = T.vecMul(v);
        console.log(`Transform [1,2,3,4] → [${vNew[0]}, ${vNew[1]}, ${vNew[2]}, ${vNew[3]}]`);
        
        // Should swap first two components
        assert(vNew[0].equals(new Rational(2)));
        assert(vNew[1].equals(new Rational(1)));
    });

    test("Basis transform function", () => {
        const newBasis = new Matrix4(
            new Vector4(new Rational(1), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(1), new Rational(-1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        const transform = Matrix4.createBasisTransform(newBasis);
        const v = new Vector4(new Rational(2), new Rational(0), new Rational(3), new Rational(4));
        const result = transform(v);
        
        console.log(`Transform function: [2,0,3,4] → [${result[0]}, ${result[1]}, ${result[2]}, ${result[3]}]`);
    });

    // Test 9: Advanced operations
    console.log("\nTest 9: Advanced Operations");
    test("Conjugation", () => {
        const A = new Matrix4(
            new Vector4(new Rational(1), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(1), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(1), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(1))
        );
        
        const C = Matrix4.identity(Rational).scale(new Rational(2));
        const conj = A.conj(C);
        
        console.log("A conjugated by 2I:");
        console.log(conj.prettyPrint());
        
        // Since C is a scalar multiple of I, conjugation should not change A
        assert(conj.equals(A), "Conjugation by scalar matrix should not change matrix");
    });

    test("Trace", () => {
        const M = new Matrix4(
            new Vector4(new Rational(1), new Rational(0), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(2), new Rational(0), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(3), new Rational(0)),
            new Vector4(new Rational(0), new Rational(0), new Rational(0), new Rational(4))
        );
        
        const tr = M.trace();
        console.log(`Trace of diagonal matrix: ${tr}`);
        assert(tr.equals(new Rational(10)), "Trace should be 1+2+3+4 = 10");
    });

    // Test 10: Clone and equals
    console.log("\nTest 10: Clone and Equals");
    test("Matrix cloning", () => {
        const M = Matrix4.identity(Rational).scale(new Rational(3));
        const Mclone = M.clone();
        
        assert(M.equals(Mclone), "Clone should be equal to original");
        assert(M !== Mclone, "Clone should be a different object");
        
        // Modify clone and check original is unchanged
        Mclone[0][0] = new Rational(99);
        assert(!M.equals(Mclone), "Modifying clone should not affect original");
    });

    console.log("\n=== All Tests Passed! ===");
}

// Helper functions
function test(name, fn) {
    console.log(`  ${name}:`);
    try {
        fn();
        console.log(`    ✓ Passed`);
    } catch (error) {
        console.log(`    ✗ Failed: ${error.message}`);
        console.error(error);
        throw error;
    }
}

function assert(condition, message = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

// Run the tests
runTests();