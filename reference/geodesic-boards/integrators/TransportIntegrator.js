import {Vector2} from "three";
import {createCatmullRomVec} from "../interpolators/catmullRomVector.js";


export default class TransportIntegrator{
    constructor(curve, dTransport, h=0.001) {
        this.h = h;
        this.curve = curve;
        this.dTransport = dTransport;
    }

    step(t,vec){
        //take one step at time t along curve, transporting X
        let k1,k2,k3,k4;
        let tv1, tv2, tv3, tv4;
        let temp;

        //get the derivative
        tv1 =  this.curve.getTV(t);
        k1 = this.dTransport(tv1,vec);
        k1.multiplyScalar(this.h);

        //get k2
        tv2 = this.curve.getTV(t+0.5*this.h);
        temp=vec.clone().add(k1.clone().multiplyScalar(0.5));
        k2=this.dTransport(tv2, temp);
        k2.multiplyScalar(this.h);

        //get k3
        tv3 = this.curve.getTV(t+0.5*this.h);
        temp=vec.clone().add(k2.clone().multiplyScalar(0.5));
        k3=this.dTransport(tv3,temp);
        k3.multiplyScalar(this.h);

        //get k4
        tv4 =  this.curve.getTV(t+this.h);
        temp=vec.clone().add(k3.multiplyScalar(1.));
        k4=this.dTransport(tv4,temp);
        k4.multiplyScalar(this.h);

        //add up results:
        let update = k1;//scale factor 1
        update.add(k2.multiplyScalar(2));
        update.add(k3.multiplyScalar(2));
        update.add(k4);//scale factor 1
        update.multiplyScalar(1/6);

        //move ahead one step
        return vec.clone().add(update);
    }

    getTransportedBasis(){
        //set the number of steps needed for the integration
        let steps = 1/this.h;

        //choose basis and initialize arrays
        const Ts = [], Xs = [], Ys = [];
        let X = new Vector2(1, 0), Y = new Vector2(0, 1);
        Ts.push(0); Xs.push(X.clone()); Ys.push(Y.clone());

        //perform the integration for each basis vector
        let t=0;
        for (let i = 0; i <= steps; ++i) {
            t += this.h;
            X = this.step(t , X);
            Y = this.step(t , Y);
            Ts.push(t);
            Xs.push(X.clone());
            Ys.push(Y.clone());
        }

        const XTransport = createCatmullRomVec(Ts,Xs);
        const YTransport = createCatmullRomVec(Ts,Ys);
        return (t)=>[XTransport(t),YTransport(t)];
    }

}

