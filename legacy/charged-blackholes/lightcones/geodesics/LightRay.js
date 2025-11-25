
import NumericalCurve from "./NumericalCurve.js";

// traces out an initial condition
// has a default color
// if it hits a black hole, changes to that color
class LightRay {
    constructor(bh, state, radius=0.01, length=100,scale=1) {

        this.bh = bh;
        this.state = bh.normalize(state);

        //save the options for this curve:
        this.radius = radius;
        this.length = length;
        this.scale = scale;

        //number of steps to integrate out.
        this.N = Math.floor(length / bh.integrator.ep);

        //build the trajectory: this computes this.pts
        this.integrate();
        //find color by seeing where we landed (by taking last elt of pts array)
        let color = 0xc7a70a;
            //this.bh.getEH(this.pts.slice(-1)[0]);
        //build the curve
        this.trajectory = new NumericalCurve(this.pts, color, this.radius,this.scale);
    }

    integrate(){

        let state = this.state.clone();
        this.pts = [state.pos.clone()];

        for(let i=0; i<this.N; i++){
            if(this.bh.stop(state)){
                break;
            }
            state = this.bh.integrator.step( state );
            this.pts.push( state.pos.clone() );
        }
    }

    update(iniCond, radius = this.radius){
        this.state = this.bh.normalize(iniCond);
        this.radius = radius;

        this.integrate();
        this.trajectory.setCurve(this.pts);
        //if it hit a black hole, change color
        let color = this.bh.getEH(this.pts.slice(-1)[0]);
        this.trajectory.setColor(color);

    }

    resetBlackHole(bh){
        this.bh = bh;
    }

    addToScene(scene){
        this.trajectory.addToScene(scene);
    }

}


export default LightRay;
