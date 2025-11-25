import Real from "./Field/Real";
import Vector3 from "./Vector3";
import Matrix3 from "./Matrix3";



function euclideanInnerProduct(v,w) {
    //the inner product of two vectors in the Euclidean space
    //B(v,w) = v^T w
    return v[0].mul(w[0]).add(v[1].mul(w[1])).add(v[2].mul(w[2]));
}

function euclideanCross(u,w) {
        const x = u[1].mul(w[2]).sub(u[2].mul(w[1]));
        const y = u[2].mul(w[0]).sub(u[0].mul(w[2]));
        const z = u[0].mul(w[1]).sub(u[1].mul(w[0]));
        return new Vector3(x, y, z);
    }

//a quadratic form on V gives the structure of an inner product space
//(I'm using inner product loosely here; it doesn't have to be positive definite: we want Lorentzian geometry after all!)
//
export default class InnerProduct {
    constructor(B) {
        this.B = B;

        // sniff out the Field class from one entry of B:
        // B.entry(0,0) is a field‐element instance, whose constructor
        // *is* the Field class (e.g. Rational, Complex, HeptagonField…)
        this.FieldType = this.B.entry(0, 0).constructor;

    }


    dot(v,w){
        //the dot product of these two vectors with respect to the form
        //B(v,w) = v^T B w
        return euclideanInnerProduct(v,this.B.vecMul(w));
    }

    norm2(v){
        //the norm square dot(v,v)
        return this.dot(v,v);
    }

    cos2(v,w){
        //the cosine square of the angle between them

    }

    cross(v,w){
        return euclideanCross(this.B.vecMul(v), this.B.vecMul(w));
    }

    reflectIn(n){
        //reflection matrix in plane with normal vector n

            const F = this.FieldType;

            const zero = F.zero;                    //0 in the field
            const one = F.one;                     // 1 in the field
            const two = one.add(one);              // 2

            // compute denominator: nᵀ B n
            const denom = this.norm2(n);

            const e0 = Vector3.basis(0,F);
            const e1 = Vector3.basis(1,F);
            const e2 = Vector3.basis(2,F);

            let coef0 = this.dot(e0,n).mul(two).div(denom);
            let col0 = e0.sub(n.scale(coef0));

            let coef1 = this.dot(e1,n).mul(two).div(denom);
            let col1 = e1.sub(n.scale(coef1));

            let coef2 = this.dot(e2,n).mul(two).div(denom);
            let col2 = e2.sub(n.scale(coef2));

            return new Matrix3(col0, col1,col2);

    }

    projectOnto(v){
        //projection matrix orthogonally onto the line spanned by v
    }





    //---------------------------------------------
    //RETURNING ELEMENTS OF R, NOT UNDERLYING FIELD
    //---------------------------------------------

    realNorm(v){
        // the absolute value of the norm of a vector
        let n2 = this.norm2(v).realEmbedding();
        return new Real(Math.sqrt(Math.abs(n2)));
    }

    realAngle(v,w){
        //if the form B is euclidean
        const cos = this.dot(v,w).realEmbedding()/ (this.realNorm(v)*this.realNorm(w));
        return new Real(Math.acos(cos));
    }

    realDistance(v,w){
        //if the form B is lorentzian
        //AND if both vectors are negative norm (on 2 sheet hyperboloid)
        if(this.norm2(v).realEmbedding()<0 && this.norm2(w).realEmbedding()<0){
            const cosh = - this.dot(v,w).realEmbedding()/ ( this.realNorm(v)*this.realNorm(w));
            return new Real(Math.acosh(cosh));
        }
        throw new Error('At least one vector is not on the hyperboloid; the distance is undefined')
    }



    realDiagonalize(){
        // returns: Matrix3 C (with Real entries) so that
        //C^T * (B.realEmbedding()) * C = diag(1,1,-1).
        //USE: applying C to points in our Vector space takes them to R^(2,1)


    }


}
