


//a class implementing complex numbers
import Real from "./Real";

export default class Complex {
    constructor(re = 0, im = 0) {
        this.re = re;
        this.im = im;
    }

    // Factory getters for the additive and multiplicative identities
    static get zero() { return new Complex(0, 0); }
    static get one()  { return new Complex(1, 0); }

    // Clone this complex number
    clone() {
        return new Complex(this.re, this.im);
    }

    // Equality check ( only up to some fixed precision )
    equals(other) {
        let eps = 1e-10;
        return Math.abs(this.re - other.re) < eps &&
               Math.abs(this.im - other.im) < eps;
    }

    // Return a + b without modifying either operand
    add(other) {
        return new Complex(
            this.re + other.re,
            this.im + other.im
        );
    }

    // Return a - b
    sub(other) {
        return new Complex(
            this.re - other.re,
            this.im - other.im
        );
    }

    // Return a * b
    mul(other) {
        const re = this.re * other.re - this.im * other.im;
        const im = this.re * other.im + this.im * other.re;
        return new Complex(re, im);
    }

    // Return 1 / this
    inv() {
        const denom = this.re * this.re + this.im * this.im;
        return new Complex(
            this.re / denom,
            -this.im / denom
        );
    }

    // Return a / b
    div(other) {
        return this.mul(other.inv());
    }

    // Multiply by a floating scalar
    //maybe come back and make this know about the Real() class too?
    //ShouL
    scale(r) {
        return new Complex(
            this.re * r,
            this.im * r
        );
    }

    // Complex conjugate
    conj() {
        return new Complex(
            this.re,
            -this.im
        );
    }


    // Allow automatic coercion to native number when needed
    realEmbedding() {
        if (this.im !== 0) {
            throw new Error("Cannot convert non-real Complex to a Real Number");
        }
        return new Real(this.re);
    }




    /**
     * CHATGPT
     * Return a string of the form "a + bi", handling all the edge cases:
     *  - omit any zero part
     *  - print "i" instead of "1i", "-i" instead of "-1i"
     *  - use proper +/– placement
     */
    prettyPrint() {
        const { re, im } = this;
        // both zero
        if (re === 0 && im === 0) {
            return "0";
        }
        let s = "";

        // real part
        if (re !== 0) {
            s += re;
        }

        // imaginary part
        if (im !== 0) {
            // decide sign
            if (im > 0 && re !== 0) {
                s += " + ";
            } else if (im < 0 && re !== 0) {
                s += " - ";
            } else if (im < 0 && re === 0) {
                s += "-";
            }
            // magnitude (drop "1" before "i")
            const absIm = Math.abs(im);
            s += (absIm === 1 ? "" : absIm) + "i";
        }

        return s;
    }

}
