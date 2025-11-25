import Free2 from './Free2.js';

/**
 * Test suite for Free2 class
 */
function runTests() {
    console.log("=== Free2 Test Suite ===\n");
    
    // Test 1: Basic parsing
    console.log("Test 1: Basic Parsing");
    test("Simple generators", () => {
        const a = new Free2("a");
        const b = new Free2("b");
        console.log(`"a" → ${JSON.stringify(a.word)} → "${a.toString()}"`);
        console.log(`"b" → ${JSON.stringify(b.word)} → "${b.toString()}"`);
        assert(a.word.length === 1 && a.word[0][0] === 'a' && a.word[0][1] === 1);
        assert(b.word.length === 1 && b.word[0][0] === 'b' && b.word[0][1] === 1);
    });
    
    // Test 2: Exponent parsing
    console.log("\nTest 2: Exponent Parsing");
    test("Various exponent formats", () => {
        const cases = [
            ["a^2", [['a', 2]]],
            ["a^(-1)", [['a', -1]]],
            ["a^-1", [['a', -1]]],
            ["b^3", [['b', 3]]],
            ["b^(-2)", [['b', -2]]],
            ["a^0", []] // Should reduce to empty
        ];
        
        cases.forEach(([input, expected]) => {
            const result = Free2.fromString(input);
            console.log(`"${input}" → ${JSON.stringify(result.word)} → "${result.toString()}"`);
            assert(JSON.stringify(result.word) === JSON.stringify(expected), 
                   `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result.word)}`);
        });
    });
    
    // Test 3: Complex parsing
    console.log("\nTest 3: Complex Parsing");
    test("Multi-generator strings", () => {
        const cases = [
            ["ab", [['a', 1], ['b', 1]]],
            ["aba", [['a', 1], ['b', 1], ['a', 1]]],
            ["a^2b^3", [['a', 2], ['b', 3]]],
            ["a^(-1)b^2", [['a', -1], ['b', 2]]],
            ["aba^(-1)bb", [['a', 1], ['b', 1], ['a', -1], ['b', 2]]], // a and a^(-1) don't cancel (not adjacent)
            ["aa^(-1)bb", [['b', 2]]], // This should cancel because a and a^(-1) are adjacent
        ];
        
        cases.forEach(([input, expected]) => {
            const result = Free2.fromString(input);
            console.log(`"${input}" → ${JSON.stringify(result.word)} → "${result.toString()}"`);
            assert(JSON.stringify(result.word) === JSON.stringify(expected), 
                   `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result.word)}`);
        });
    });
    
    // Test 4: Reduction
    console.log("\nTest 4: Word Reduction");
    test("Automatic reduction", () => {
        const cases = [
            ["aa", [['a', 2]]],
            ["aaa", [['a', 3]]],
            ["abb", [['a', 1], ['b', 2]]],
            ["aa^(-1)", []], // Should cancel completely
            ["aba^(-1)", [['a', 1], ['b', 1], ['a', -1]]], // Does NOT reduce - a and a^(-1) not adjacent
            ["a^2a^3", [['a', 5]]],
            ["a^6a^(-6)", []], // Should cancel
            ["abba^(-1)", [['a', 1], ['b', 2], ['a', -1]]], // Does NOT reduce
            ["aba^(-1)a^(-1)", [['a', 1], ['b', 1], ['a', -2]]], // Adjacent a^(-1) terms combine
        ];
        
        cases.forEach(([input, expected]) => {
            const result = Free2.fromString(input);
            console.log(`"${input}" → ${JSON.stringify(result.word)} → "${result.toString()}"`);
            assert(JSON.stringify(result.word) === JSON.stringify(expected), 
                   `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result.word)}`);
        });
    });
    
    // Test 5: Group operations
    console.log("\nTest 5: Group Operations");
    test("Multiplication", () => {
        const a = Free2.a();
        const b = Free2.b();
        const ab = a.multiply(b);
        const ba = b.multiply(a);
        
        console.log(`a * b = ${ab.toString()}`);
        console.log(`b * a = ${ba.toString()}`);
        
        assert(ab.toString() === "ab");
        assert(ba.toString() === "ba");
        assert(!ab.equals(ba)); // Free group is non-commutative
    });
    
    test("Inverse", () => {
        const cases = [
            ["a", "a^(-1)"],
            ["b", "b^(-1)"],
            ["ab", "b^(-1)a^(-1)"],
            ["a^2b^3", "b^(-3)a^(-2)"],
            ["aba^(-1)", "ab^(-1)a^(-1)"]
        ];
        
        cases.forEach(([input, expected]) => {
            const w = Free2.fromString(input);
            const inv = w.inverse();
            console.log(`(${input})^(-1) = ${inv.toString()}`);
            
            // Check that w * w^(-1) = identity
            const product = w.multiply(inv);
            assert(product.isIdentity(), `${input} * ${inv.toString()} should be identity, got ${product.toString()}`);
        });
    });
    
    // Test 6: Identity and special cases
    console.log("\nTest 6: Identity and Special Cases");
    test("Identity element", () => {
        const e = Free2.identity();
        const a = Free2.a();
        
        console.log(`Identity: ${e.toString()}`);
        console.log(`a * e = ${a.multiply(e).toString()}`);
        console.log(`e * a = ${e.multiply(a).toString()}`);
        
        assert(e.isIdentity());
        assert(a.multiply(e).equals(a));
        assert(e.multiply(a).equals(a));
    });
    
    test("Cancellation", () => {
        const a = Free2.a();
        const aInv = Free2.a(-1);
        const product = a.multiply(aInv);
        
        console.log(`a * a^(-1) = ${product.toString()}`);
        assert(product.isIdentity());
    });
    
    // Test 7: Advanced group theory
    console.log("\nTest 7: Advanced Operations");
    test("Conjugation", () => {
        const a = Free2.a();
        const b = Free2.b();
        const conj = a.conjugateBy(b); // bab^(-1)
        
        console.log(`b * a * b^(-1) = ${conj.toString()}`);
        assert(conj.toString() === "bab^(-1)");
    });
    
    test("Commutator", () => {
        const a = Free2.a();
        const b = Free2.b();
        const comm = a.commutator(b); // [a,b] = aba^(-1)b^(-1)
        
        console.log(`[a,b] = ${comm.toString()}`);
        assert(comm.toString() === "aba^(-1)b^(-1)");
    });
    
    // Test 8: Edge cases and error handling
    console.log("\nTest 8: Edge Cases");
    test("Empty and malformed strings", () => {
        const empty = Free2.fromString("");
        console.log(`Empty string: ${empty.toString()}`);
        assert(empty.isIdentity());
        
        const spaces = Free2.fromString("a b");
        console.log(`"a b" (with space): ${spaces.toString()}`);
        assert(spaces.toString() === "ab");
    });
    
    test("Word length", () => {
        const cases = [
            ["e", 0],
            ["a", 1],
            ["a^2", 2],
            ["ab", 2],
            ["a^(-1)b^2", 3],
            ["aba^(-1)", 3], // Does NOT reduce, so length is 1+1+1=3
            ["aa^(-1)b", 1], // Reduces to "b", so length is 1
        ];
        
        cases.forEach(([input, expectedLength]) => {
            const w = input === "e" ? Free2.identity() : Free2.fromString(input);
            console.log(`Length of "${input}": ${w.length()} (word: ${w.toString()})`);
            assert(w.length() === expectedLength, `Expected length ${expectedLength}, got ${w.length()}`);
        });
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
