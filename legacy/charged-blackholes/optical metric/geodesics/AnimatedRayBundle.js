
import AnimatedLightRay from "./AnimatedLightRay.js";


class AnimatedRayBundle {
    constructor(bh, states, radii, length=600){
        this.bh = bh;
        this.states = states;
        this.radii = radii;
        this.length = length;

        this.N = this.states.length;

        this.rays = [];

        for(let i=0; i<this.N; i++){
            let ray = new AnimatedLightRay(this.bh, this.states[i], this.radii[i], this.length);
            this.rays.push(ray);
        }

    }

    addToScene(scene){
        for(let i=0; i<this.N; i++){
            this.rays[i].addToScene(scene);
        }
    }


    step(){
        for(let i=0; i<this.N; i++){
            this.rays[i].step();
        }
    }


}



export default AnimatedRayBundle;
