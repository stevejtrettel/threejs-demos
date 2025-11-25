import Rational from "./Rational";
import Real from "./Real";


//Degree-3 extension of Q by a = cos(pi/7),
//with a^3 = -1/8 + a/2 + a^2/2.
//Elements are x0 + x1*a + x2*a^2 in Q(a).
// the coefficients are accessed by this.co, this.c1, this.c2

export default class HeptagonField {
    constructor(x0 = Rational.zero, x1 = Rational.zero, x2 = Rational.zero) {
        // Ensure each coefficient is a Rational
        this.c0 = Rational.from(x0);
        this.c1 = Rational.from(x1);
        this.c2 = Rational.from(x2);
    }

    // Field identities
    static get zero() { return new HeptagonField(Rational.zero, Rational.zero, Rational.zero);}
    static get one()  { return new HeptagonField(Rational.one,  Rational.zero, Rational.zero);}

    // Clone this element
    clone() {
        return new HeptagonField(this.c0.clone(), this.c1.clone(), this.c2.clone());
    }

    // Equality check
    equals(other) {
        return this.c0.equals(other.c0) &&
            this.c1.equals(other.c1) &&
            this.c2.equals(other.c2);
    }

    // Addition: (c0,c1,c2) + (d0,d1,d2)
    add(other) {
        return new HeptagonField(
            this.c0.add(other.c0),
            this.c1.add(other.c1),
            this.c2.add(other.c2)
        );
    }

    // Subtraction
    sub(other) {
        return new HeptagonField(
            this.c0.sub(other.c0),
            this.c1.sub(other.c1),
            this.c2.sub(other.c2)
        );
    }

    // Scale by a rational scalar
    scale(r) {
        return new HeptagonField(
            this.c0.mul(r),
            this.c1.mul(r),
            this.c2.mul(r)
        );
    }

    // Multiply by the generator a (pure)
    _mulAlpha() {
        // a^3 = -1/8 + a/2 + a^2/2
        const t0 = this.c2.mul(new Rational(-1, 8));
        const half = new Rational(1, 2);
        const t1 = this.c0.add(this.c2.mul(half));
        const t2 = this.c1.add(this.c2.mul(half));
        return new HeptagonField(t0, t1, t2);
    }

    // Field multiplication: this * other
    mul(other) {
        // term0 = this * other.c0
        const term0 = this.scale(other.c0);
        // term1 = this*a * other.c1
        const term1 = this._mulAlpha().scale(other.c1);
        // term2 = this*a^2 * other.c2
        const term2 = this._mulAlpha()._mulAlpha().scale(other.c2);
        return term0.add(term1).add(term2);
    }

    // Multiplicative inverse
    inv() {
        const x0 = this.c0, x1 = this.c1, x2 = this.c2;


        // Norm (denominator) = product of Galois conjugates
        const denom = x0.mul(x0).mul(x0).mul(64)
            .add(x0.mul(x0).mul(x1).mul(32))
            .add(x0.mul(x0).mul(x2).mul(80))
            .sub(x0.mul(x1).mul(x1).mul(32))
            .add(x0.mul(x1).mul(x2).mul(8))
            .add(x0.mul(x2).mul(x2).mul(24))
            .sub(x1.mul(x1).mul(x1).mul(8))
            .sub(x1.mul(x1).mul(x2).mul(4))
            .add(x1.mul(x2).mul(x2).mul(4))
            .add(x2.mul(x2).mul(x2));

        // Numerators y0, y1, y2
        const y0 = x0.mul(x0).mul(64)
            .add(x0.mul(x1).mul(32))
            .add(x0.mul(x2).mul(80))
            .sub(x1.mul(x1).mul(32))
            .sub(x1.mul(x2).mul(8))
            .add(x2.mul(x2).mul(20));

        const y1 = x0.mul(x1).mul(-64)
            .sub(x1.mul(x1).mul(32))
            .sub(x1.mul(x2).mul(16))
            .add(x2.mul(x2).mul(8));

        const y2 = x0.mul(x2).mul(-64)
            .add(x1.mul(x1).mul(64))
            .add(x1.mul(x2).mul(32))
            .sub(x2.mul(x2).mul(32));

        return new HeptagonField(
            y0.div(denom),
            y1.div(denom),
            y2.div(denom)
        );
    }

    // Division: this / other
    div(other) {
        return this.mul(other.inv());
    }





    realEmbedding(){
        //embeds into R, returning a floating point number
        const a = Math.cos(Math.PI/7);
        const term0 = this.c0.realEmbedding();
        const term1 = this.c1.realEmbedding() *a;
        const term2 = this.c2.realEmbedding() *a*a;
        return new Real(term0 + term1 + term2);
    }




    /**
     * CHATGPT
     * Return a string of the form "x0 + x1 a + x2 a^2",
     * dropping any zero coefficient and fixing up signs.
     */
    prettyPrint() {
        const zero = Rational.zero;
        const parts = [];

        // constant term
        if (!this.c0.equals(zero)) {
            parts.push(this.c0.prettyPrint());
        }

        // a¹ term
        if (!this.c1.equals(zero)) {
            if (this.c1.equals(Rational.one)) {
                parts.push("a");
            } else if (this.c1.equals(Rational.one.neg())) {
                parts.push("-a");
            } else {
                parts.push(`${this.c1.prettyPrint()}*a`);
            }
        }

        // a² term
        if (!this.c2.equals(zero)) {
            if (this.c2.equals(Rational.one)) {
                parts.push("a^2");
            } else if (this.c2.equals(Rational.one.neg())) {
                parts.push("-a^2");
            } else {
                parts.push(`${this.c2.prettyPrint()}*a^2`);
            }
        }

        if (parts.length === 0) {
            return "0";
        }

        // join with " + ", then fix any "+ -" → "- "
        return parts.join(" + ").replace(/\+\s\-/g, "- ");
    }

}
