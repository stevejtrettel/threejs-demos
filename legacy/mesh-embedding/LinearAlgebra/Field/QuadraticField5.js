import Rational from "./Rational";
import Real from "./Real";

//Degree-2 extension of Q by sqrt(5)
//Elements are x0 + x1*sqrt(5) in Q(sqrt(5)).
//The coefficients are accessed by this.c0, this.c1

export default class QuadraticField5 {
    constructor(x0 = Rational.zero, x1 = Rational.zero) {
        // Ensure each coefficient is a Rational
        this.c0 = Rational.from(x0);
        this.c1 = Rational.from(x1);
    }

    // Field identities
    static zero = new QuadraticField5(Rational.zero, Rational.zero);
    static one  = new QuadraticField5(Rational.one,  Rational.zero);
    static sqrt5 = new QuadraticField5(Rational.zero, Rational.one);

    // Clone this element
    clone() {
        return new QuadraticField5(this.c0.clone(), this.c1.clone());
    }

    // Addition: (c0,c1) + (d0,d1) = (c0+d0, c1+d1)
    add(other) {
        return new QuadraticField5(
            this.c0.add(other.c0),
            this.c1.add(other.c1)
        );
    }

    // Subtraction
    sub(other) {
        return new QuadraticField5(
            this.c0.sub(other.c0),
            this.c1.sub(other.c1)
        );
    }

    // Negation
    neg() {
        return new QuadraticField5(
            this.c0.neg(),
            this.c1.neg()
        );
    }

    // Scale by a rational scalar
    scale(r) {
        return new QuadraticField5(
            this.c0.mul(r),
            this.c1.mul(r)
        );
    }

    // Field multiplication: (a + b√5)(c + d√5) = (ac + 5bd) + (ad + bc)√5
    // Maybe here extending by the golden ratio would be better for the growth behavior?
    mul(other) {
        const a = this.c0, b = this.c1;
        const c = other.c0, d = other.c1;
        
        // Real part: ac + 5bd
        const realPart = a.mul(c).add(b.mul(d).mul(new Rational(5)));
        
        // Imaginary part: ad + bc
        const imagPart = a.mul(d).add(b.mul(c));

        return new QuadraticField5(realPart, imagPart);
    }

    // Multiplicative inverse using the norm
    inv() {
        const x0 = this.c0, x1 = this.c1;
        
        // Norm = (x0 + x1√5)(x0 - x1√5) = x0² - 5x1²
        const norm = x0.mul(x0).sub(x1.mul(x1).mul(new Rational(5)));
        
        if (norm.equals(Rational.zero)) {
            throw new Error("Cannot invert zero element");
        }
        
        // Inverse = (x0 - x1√5) / norm
        return new QuadraticField5(
            x0.div(norm),
            x1.neg().div(norm)
        );
    }

    // Division: this / other
    div(other) {
        return this.mul(other.inv());
    }

    // Equality check
    equals(other) {
        return this.c0.equals(other.c0) && this.c1.equals(other.c1);
    }

    // Real embedding: x0 + x1*sqrt(5)
    realEmbedding() {
        return new Real(Number(this.c0.realEmbedding()) + Number(this.c1.realEmbedding()) * Math.sqrt(5));
    }

    // High-precision real embedding using BigInt for sqrt(5)
    realEmbeddingHighPrecision() {
        // High-precision sqrt(5) as a scaled BigInt
        // NASA computed this: https://apod.nasa.gov/htmltest/gifcity/sqrt5.1mil
        // sqrt(5) ≈ 2.236067977499789696409173668731276235440618359611525724270897245410520925637804899414414408378782274969508176150773783504253267724447073863586360121533452708866778
        const sqrt5_scaled = 223606797749978969640917366873127623544061835961152572427089724541052092563780489n;
        const sqrt5_scale = 10n ** 80n;
        
        // Convert rationals to a common scale for calculation
        const work_scale = 10n ** 50n; // Smaller working scale to avoid overflow
        
        // Convert c0: (p * work_scale) / q
        const c0_scaled = (this.c0.p * work_scale) / this.c0.q;
        
        // Convert c1: (p * work_scale) / q  
        const c1_scaled = (this.c1.p * work_scale) / this.c1.q;
        
        // Calculate c1 * sqrt(5): (c1_scaled * sqrt5_scaled) / sqrt5_scale
        const c1_times_sqrt5 = (c1_scaled * sqrt5_scaled) / sqrt5_scale;
        
        // Final result: c0 + c1 * sqrt(5)
        const result_scaled = c0_scaled + c1_times_sqrt5;
        
        // Convert to final number
        const final_result = Number(result_scaled) / Number(work_scale);
        
        return new Real(final_result);
    }

    // Conjugate: x0 + x1√5 -> x0 - x1√5
    conjugate() {
        return new QuadraticField5(this.c0, this.c1.neg());
    }

    // Norm: this * this.conjugate() = x0² - 5x1²
    norm() {
        return this.c0.mul(this.c0).sub(this.c1.mul(this.c1).mul(new Rational(5)));
    }

    // Trace: this + this.conjugate() = 2x0
    trace() {
        return this.c0.mul(new Rational(2));
    }

    // Pretty print
    prettyPrint() {
        const c0Str = this.c0.prettyPrint();
        const c1Str = this.c1.prettyPrint();
        
        if (this.c1.equals(Rational.zero)) {
            return c0Str;
        }
        
        if (this.c0.equals(Rational.zero)) {
            if (this.c1.equals(Rational.one)) {
                return "√5";
            }
            if (this.c1.equals(Rational.one.neg())) {
                return "-√5";
            }
            return `${c1Str}√5`;
        }
        
        // Both parts non-zero
        let result = c0Str;
        
        if (this.c1.equals(Rational.one)) {
            result += " + √5";
        } else if (this.c1.equals(Rational.one.neg())) {
            result += " - √5";
        } else {
            // Check if c1 is positive or negative
            const c1Real = this.c1.realEmbedding();
            if (c1Real > 0) {
                result += ` + ${c1Str}√5`;
            } else {
                result += ` - ${this.c1.neg().prettyPrint()}√5`;
            }
        }
        
        return result;
    }

    // Static factory methods for common values
    static fromRational(r) {
        return new QuadraticField5(r, Rational.zero);
    }

    static fromInteger(n) {
        return new QuadraticField5(new Rational(n), Rational.zero);
    }

    // Golden ratio: φ = (1 + √5)/2
    static get goldenRatio() {
        return new QuadraticField5(
            new Rational(1, 2),
            new Rational(1, 2)
        );
    }

    // Conjugate of golden ratio: φ* = (1 - √5)/2
    static get goldenRatioConjugate() {
        return new QuadraticField5(
            new Rational(1, 2),
            new Rational(-1, 2)
        );
    }
}