

import Real from "./Real";


//rational numbers as objects {p:BigInt, q:BigInt}
//constructor takes two BigInts
//methods leave original objects *invariant* and create new ones.  So the reduction logic is in the constructor

export default class Rational {
    // p and q are BigInt always; invariant: q > 0
    constructor(p = 0n, q = 1n) {
        p = BigInt(p);
        q = BigInt(q);
        if (q === 0n) throw new Error("Denominator cannot be zero");
        // force the sign into numerator
        if (q < 0n) { p = -p; q = -q; }
        const g = Rational._gcd(p < 0n ? -p : p, q);
        this.p = p / g;
        this.q = q / g;
    }

    // BigInt gcd
    static _gcd(a, b) {
        while (b !== 0n) {
            [a, b] = [b, a % b];
        }
        return a;
    }

    static get zero() { return new Rational(0n, 1n); }
    static get one()  { return new Rational(1n, 1n); }


    // coerce a Number or BigInt or Rational into a Rational
    //useful as it lets us multiply and divide by normal integers
    //or make rationals out of other inputs, if we expand this method
    static from(x) {
        if (x instanceof Rational) return x;
        return new Rational(x, 1n);
    }

    clone() {return new Rational(this.p, this.q);}


    add(other) {
        other = Rational.from(other);
        const p = this.p * other.q + other.p * this.q;
        const q = this.q * other.q;
        return new Rational(p, q);
    }

    sub(other) {
        other = Rational.from(other);
        const p = this.p * other.q - other.p * this.q;
        const q = this.q * other.q;
        return new Rational(p, q);
    }

    mul(other) {
        other = Rational.from(other);
        const p = this.p * other.p;
        const q = this.q * other.q;
        return new Rational(p, q);
    }

    inv(){
        if (this.p === 0n) throw new Error("Division by zero");
        return new Rational(this.q,this.p);
    }

    div(other) {
        other = Rational.from(other);
        if (other.p === 0n) throw new Error("Division by zero");
        // invert other
        const p = this.p * other.q;
        const q = this.q * other.p;
        return new Rational(p, q);
    }

    neg() {
        return new Rational(-this.p, this.q);
    }



    equals(other) {
        return this.p === other.p && this.q === other.q;
    }

    realEmbedding() {
       //returns a real number (float)
        return new Real(Number(this.p) / Number(this.q));
    }


    prettyPrint() {
        // BigInt#toString() drops the trailing "n"
        return this.q === 1n
            ? `${this.p}`
            : `${this.p}/${this.q}`;
    }
}
