/**
 * Free2 - Free group on two generators {a, b}
 * Represents elements as reduced words and provides group operations
 */
export default class Free2 {
    constructor(wordData = []) {
        this.word = [];
        
        if (typeof wordData === 'string') {
            this.word = Free2.parseString(wordData);
        } else if (Array.isArray(wordData)) {
            // Deep copy - no shared references
            this.word = wordData.map(entry => [...entry]);
        }
        
        this.reduce();
    }
    
    // Static method to parse string notation
    static parseString(str) {
        const word = [];
        let i = 0;
        
        while (i < str.length) {
            const char = str[i];
            
            if (char === 'a' || char === 'b') {
                let exponent = 1;
                
                // Check for exponent notation
                if (i + 1 < str.length && str[i + 1] === '^') {
                    i += 2; // skip '^'
                    
                    // Handle parentheses for negative exponents like ^(-1)
                    if (i < str.length && str[i] === '(') {
                        i++; // skip '('
                        
                        // Handle negative sign
                        let sign = 1;
                        if (i < str.length && str[i] === '-') {
                            sign = -1;
                            i++;
                        }
                        
                        // Parse the exponent number
                        let expStr = '';
                        while (i < str.length && /\d/.test(str[i])) {
                            expStr += str[i];
                            i++;
                        }
                        
                        exponent = sign * (expStr ? parseInt(expStr) : 1);
                        
                        // Skip closing parenthesis
                        if (i < str.length && str[i] === ')') {
                            i++;
                        }
                        
                        i--; // adjust for loop increment
                    } else {
                        // Handle exponents without parentheses like ^2 or ^-1
                        let sign = 1;
                        if (i < str.length && str[i] === '-') {
                            sign = -1;
                            i++;
                        }
                        
                        // Parse the exponent number
                        let expStr = '';
                        while (i < str.length && /\d/.test(str[i])) {
                            expStr += str[i];
                            i++;
                        }
                        
                        exponent = sign * (expStr ? parseInt(expStr) : 1);
                        i--; // adjust for loop increment
                    }
                }
                
                word.push([char, exponent]);
            }
            i++;
        }
        
        return word;
    }
    
    // Reduce the word by canceling adjacent inverse pairs
    reduce() {
        let changed = true;
        
        while (changed) {
            changed = false;
            
            // First, combine adjacent same generators
            for (let i = 0; i < this.word.length - 1; i++) {
                if (this.word[i][0] === this.word[i + 1][0]) {
                    this.word[i][1] += this.word[i + 1][1];
                    this.word.splice(i + 1, 1);
                    changed = true;
                    break;
                }
            }
            
            // Then, remove generators with exponent 0
            for (let i = 0; i < this.word.length; i++) {
                if (this.word[i][1] === 0) {
                    this.word.splice(i, 1);
                    changed = true;
                    break;
                }
            }
            
            // Finally, look for adjacent inverse pairs (like a^2 followed by a^(-1))
            for (let i = 0; i < this.word.length - 1; i++) {
                const [gen1, exp1] = this.word[i];
                const [gen2, exp2] = this.word[i + 1];
                
                if (gen1 === gen2 && exp1 * exp2 < 0) {
                    // They are inverses of each other
                    const minAbs = Math.min(Math.abs(exp1), Math.abs(exp2));
                    
                    // Reduce the exponents
                    this.word[i][1] = exp1 > 0 ? exp1 - minAbs : exp1 + minAbs;
                    this.word[i + 1][1] = exp2 > 0 ? exp2 - minAbs : exp2 + minAbs;
                    
                    changed = true;
                    break;
                }
            }
        }
    }
    
    // Group multiplication: this * other
    multiply(other) {
        const result = new Free2();
        result.word = [...this.word, ...other.word];
        result.reduce();
        return result;
    }
    
    // Group inverse
    inverse() {
        const result = new Free2();
        // Reverse the word and negate all exponents
        result.word = this.word.slice().reverse().map(([gen, exp]) => [gen, -exp]);
        return result;
    }
    
    // Identity element
    static identity() {
        return new Free2([]);
    }
    
    // Generator elements
    static a(exponent = 1) {
        return new Free2([['a', exponent]]);
    }
    
    static b(exponent = 1) {
        return new Free2([['b', exponent]]);
    }

    static fromString(str) {
        return new Free2(str);
    }
    
    // Check if this is the identity
    isIdentity() {
        return this.word.length === 0;
    }
    
    // Equality check
    equals(other) {
        if (this.word.length !== other.word.length) return false;
        
        for (let i = 0; i < this.word.length; i++) {
            if (this.word[i][0] !== other.word[i][0] || 
                this.word[i][1] !== other.word[i][1]) {
                return false;
            }
        }
        return true;
    }
    
    // Convert to matrix representation
    toMatrix(matrixA, matrixB) {
        if (this.isIdentity()) {
            return matrixA.constructor.identity(matrixA.entry(0,0).constructor);
        }
        
        let result = null;
        
        for (const [generator, exponent] of this.word) {
            let matrix = (generator === 'a') ? matrixA : matrixB;
            
            // Handle negative exponents
            if (exponent < 0) {
                matrix = matrix.inverse();
            }
            
            // Handle exponents with absolute value > 1
            let power = Math.abs(exponent);
            let currentPower = matrix;
            
            if (power > 1) {
                // Compute matrix^power by repeated multiplication
                for (let i = 1; i < power; i++) {
                    currentPower = currentPower.rightMul(matrix);
                }
            }
            
            // Multiply into result
            if (result === null) {
                result = currentPower;
            } else {
                result = result.rightMul(currentPower);
            }
        }
        
        return result;
    }
    
    // Pretty print the word
    toString() {
        if (this.isIdentity()) {
            return 'e'; // identity element
        }
        
        return this.word.map(([gen, exp]) => {
            if (exp === 1) return gen;
            if (exp === -1) return gen + '^(-1)';
            return `${gen}^${exp}`;
        }).join('');
    }
    
    // Get word length (number of generators)
    length() {
        return this.word.reduce((sum, [, exp]) => sum + Math.abs(exp), 0);
    }
    
    // Clone
    clone() {
        return new Free2(this.word.map(([gen, exp]) => [gen, exp]));
    }

    // Conjugate: return xyx^(-1)
    conjugateBy(x) {
        return x.multiply(this).multiply(x.inverse());
    }
    
    // Commutator: return [this, other] = this * other * this^(-1) * other^(-1)
    commutator(other) {
        return this.multiply(other).multiply(this.inverse()).multiply(other.inverse());
    }

    static allWordsUpToLength(maxLength) {
        if (maxLength < 0) {
            throw new Error("maxLength must be non-negative");
        }
        
        const layers = {};
        layers[0] = [Free2.identity()];
        
        // Build each layer from the previous one
        for (let length = 1; length <= maxLength; length++) {
            layers[length] = [];
            
            // For each word in the previous layer
            for (const word of layers[length - 1]) {
                // Get the last generator and its sign (if any)
                let lastGen = null;
                let lastExpSign = null;
                
                if (word.word.length > 0) {
                    const lastEntry = word.word[word.word.length - 1]; // this is not the word length but the last entry of the underlying array
                    // lastEntry is an array like ['a', 1] or ['b', -4
                    lastGen = lastEntry[0];  // 'a' or 'b'
                    lastExpSign = Math.sign(lastEntry[1]); // 1 or -1
                }
                
                // Add all generators except the inverse of the last one
                const generators = [
                    ['a', 1], ['a', -1], ['b', 1], ['b', -1]
                ];
                
                for (const [gen, exp] of generators) {
                    // Skip if this would be the inverse of the last letter
                    // (same generator but opposite sign)
                    if (lastGen === gen && lastExpSign === -exp) {
                        continue;
                    }
                    
                    // Create the new word by appending this generator
                    const newWordData = [...word.word, [gen, exp]];
                    const newWord = new Free2(newWordData);
                    
                    layers[length].push(newWord);
                }
            }
        }
        
        return layers;
    }

    /**
     * Generate JSON files containing all words up to a given length
     * Creates files named: words_length_N.json for each length N from 0 to maxLength
     * @param {number} maxLength - Maximum word length to generate
     * @param {string} outputPath - Directory path where files should be created (default: current directory)
     * @returns {Promise<void>}
     */
    static async generateWordFilesToLength(maxLength, outputPath = './') {
        console.log(`Generating word files for lengths 0 to ${maxLength}...`);
        
        // Ensure outputPath ends with /
        if (!outputPath.endsWith('/')) {
            outputPath += '/';
        }
        
        // Generate all words at once
        const allWordsDict = Free2.allWordsUpToLength(maxLength);
        
        // Save each length to a separate file
        for (let length = 0; length <= maxLength; length++) {
            const words = allWordsDict[length] || [];
            
            // Convert words to serializable format
            const serializedWords = words.map(word => ({
                word_data: word.word,  // Array of [generator, exponent] pairs
                string_repr: word.toString(),
                word_length: word.length()
            }));
            
            // Create file data structure
            const fileData = {
                metadata: {
                    length: length,
                    count: words.length,
                    generated_at: new Date().toISOString(),
                    generator_count: 2,
                    generators: ['a', 'b'],
                    max_length_generated: maxLength
                },
                words: serializedWords
            };
            
            // Generate filename
            const filename = `${outputPath}words_length_${length}.json`;
            
            try {
                // Write file (this will need to be adapted based on your environment)
                // In Node.js, you'd use fs.writeFileSync or fs.promises.writeFile
                // In browser environment, you'd need a different approach
                
                if (typeof window !== 'undefined') {
                    // Browser environment - create download
                    Free2._downloadJSON(fileData, `words_length_${length}.json`);
                } else {
                    // Node.js environment
                    const fs = await import('fs');
                    await fs.promises.writeFile(filename, JSON.stringify(fileData, null, 2));
                    console.log(`Generated: ${filename} (${words.length} words)`);
                }
            } catch (error) {
                console.error(`Error writing file ${filename}:`, error);
                throw error;
            }
        }
        
        console.log(`Word file generation complete! Generated ${maxLength + 1} files.`);
    }

    /**
     * Helper method to trigger file download in browser environment
     * @private
     */
    static _downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Downloaded: ${filename}`);
    }

    /**
     * Load words from a generated JSON file
     * @param {string} filename - Path to the JSON file
     * @returns {Promise<Array<Free2>>} Array of Free2 word objects
     */
    static async loadWordsFromFile(filename) {
        try {
            let data;
            
            if (typeof window !== 'undefined') {
                // Browser environment - you'd need to handle file loading differently
                throw new Error('File loading in browser environment requires fetch() or file input');
            } else {
                // Node.js environment
                const fs = await import('fs');
                const fileContent = await fs.promises.readFile(filename, 'utf8');
                data = JSON.parse(fileContent);
            }
            
            // Convert serialized words back to Free2 objects
            const words = data.words.map(wordData => new Free2(wordData.word_data));
            
            console.log(`Loaded ${words.length} words of length ${data.metadata.length} from ${filename}`);
            return words;
            
        } catch (error) {
            console.error(`Error loading words from ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Generate a summary file with statistics about all generated word files
     * @param {number} maxLength - Maximum length that was generated
     * @param {string} outputPath - Directory path where files should be created
     */
    static async generateWordsSummary(maxLength, outputPath = './') {
        if (!outputPath.endsWith('/')) {
            outputPath += '/';
        }
        
        const summary = {
            metadata: {
                max_length: maxLength,
                generated_at: new Date().toISOString(),
                generator_count: 2,
                generators: ['a', 'b']
            },
            statistics: {},
            files: []
        };
        
        let totalWords = 0;
        
        for (let length = 0; length <= maxLength; length++) {
            // Calculate expected word count (this follows the formula for reduced words in free group)
            let expectedCount;
            if (length === 0) {
                expectedCount = 1; // identity
            } else if (length === 1) {
                expectedCount = 4; // a, a^-1, b, b^-1
            } else {
                expectedCount = 4 * Math.pow(3, length - 1); // 4 choices for first letter, 3 for each subsequent
            }
            
            summary.statistics[length] = {
                expected_count: expectedCount,
                filename: `words_length_${length}.json`
            };
            
            summary.files.push(`words_length_${length}.json`);
            totalWords += expectedCount;
        }
        
        summary.metadata.total_words = totalWords;
        
        const filename = `${outputPath}words_summary.json`;
        
        try {
            if (typeof window !== 'undefined') {
                Free2._downloadJSON(summary, 'words_summary.json');
            } else {
                const fs = await import('fs');
                await fs.promises.writeFile(filename, JSON.stringify(summary, null, 2));
                console.log(`Generated summary: ${filename}`);
            }
        } catch (error) {
            console.error(`Error writing summary file:`, error);
            throw error;
        }
    }
}