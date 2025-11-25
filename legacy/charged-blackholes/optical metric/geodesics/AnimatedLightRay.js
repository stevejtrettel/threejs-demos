
import NumericalCurve from "./NumericalCurve.js";

// traces out an initial condition
// has a default color
// if it hits a black hole, changes to that color
class AnimatedLightRay {
    constructor(bh, state, radius=0.01, length=100) {

        this.bh = bh;
        this.state = bh.normalize(state);

        this.pts = [this.state.pos.clone(),this.state.pos.clone()];

        //save the options for this curve:
        this.radius = radius;
        this.length = length;

        //number of steps to integrate out.
        this.N = Math.floor(length / bh.integrator.ep);
        this.total =0;

        //find color by seeing where we landed (by taking last elt of pts array)
        //build the curve


        this.trajectory = new NumericalCurve(this.pts, 0x000000, this.radius);
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


    addToScene(scene){
        this.trajectory.addToScene(scene);
    }

    step(){

        let state = this.state.clone();

        for(let i=0; i<5; i++){
            this.total += 1;
            if(this.total > this.N){
                break;
            }
            if(this.bh.stop(state)){
                break;
            }
            state = this.bh.integrator.step( state );
        }

        this.state = state;
        this.pts.push( state.pos.clone() );
        this.trajectory.setCurve(this.pts);

    }

}


export default AnimatedLightRay;
