//
//
// //class basically covering "Number" but using our field arithmetic syntax.
// //operations leave inputs intact and return a new Real() object with the result
//
// export default class Real {
//     constructor(value) {
//         // always store a JS Number internally
//         this.value = Number(value);
//     }
//
//     // factory to coerce Numbers or other Reals
//     static from(x) {
//         return x instanceof Real ? x : new Real(x);
//     }
//
//     static get zero() { return new Real(0); }
//     static get one()  { return new Real(1); }
//
//
//     // arithmetic methods return new Real instances
//     add(x) {
//         const other = Real.from(x);
//         return new Real(this.value + other.value);
//     }
//
//     sub(x) {
//         const other = Real.from(x);
//         return new Real(this.value - other.value);
//     }
//
//     mul(x) {
//         const other = Real.from(x);
//         return new Real(this.value * other.value);
//     }
//
//     div(x) {
//         const other = Real.from(x);
//         if (other.value === 0) throw new Error("Division by zero");
//         return new Real(this.value / other.value);
//     }
//
//     // comparisons
//     equals(x) {
//         const other = Real.from(x);
//         return this.value === other.value;
//     }
//
//     realEmbedding() {
//         return this.value;
//     }
//
//     // simplify printing
//     prettyPrint() {
//         const res = this.value.toFixed(3).toString();
//
//         return res;
//         //return this.value.toString();
//     }
//
//
// }



//new approach to real numbers: have them extend JS number class!
//that way we can use them as "normal" javascript numbers outside of our system
//so, for example. vec.realEmbedding() will produce an array (since vec3 extends array) of numbers (since real extends number)
//and this will be recognized by other things that want arrays of numbers


export default class Real extends Number {
    constructor(value) {
        // Call Number constructor for primitive [[NumberData]]
        super(value);
    }

    // Factory to coerce Numbers or other Reals
    static from(x) {
        return x instanceof Real ? x : new Real(x);
    }

    static get zero() { return new Real(0); }
    static get one()  { return new Real(1); }

    // Arithmetic methods return new Real instances
    add(x) {
        const other = Real.from(x);
        return new Real(this.valueOf() + other.valueOf());
    }

    sub(x) {
        const other = Real.from(x);
        return new Real(this.valueOf() - other.valueOf());
    }

    mul(x) {
        const other = Real.from(x);
        return new Real(this.valueOf() * other.valueOf());
    }

    inv(){
        return new Real(1/this.valueOf());
    }

    div(x) {
        const other = Real.from(x);
        if (other.valueOf() === 0) throw new Error("Division by zero");
        return new Real(this.valueOf() / other.valueOf());
    }

    // Comparisons (within JS Number precision)
    equals(x) {
        const other = Real.from(x);
        return Math.abs(this.valueOf() - other.valueOf()) < 1e-10; // Use a small epsilon for floating point comparison
    }

    // Expose primitive Number for embedding
    realEmbedding() {
       // return this;
        return this.valueOf();
    }

    // Override toString for pretty printing
    toString() {
        return this.valueOf().toFixed(3);
    }

    // Ensure numeric contexts use the primitive value
    valueOf() {
        return super.valueOf();
    }

    prettyPrint() {
        return this.toString();
    }
}

