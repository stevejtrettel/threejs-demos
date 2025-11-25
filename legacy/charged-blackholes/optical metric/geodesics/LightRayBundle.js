
import LightRay from "./LightRay.js";


class LightRayBundle {
    constructor(bh, states, radii, length=600){
        this.bh = bh;
        this.states = states;
        this.radii = radii;
        this.length = length;

        this.N = this.states.length;

        this.rays = [];

        for(let i=0; i<this.N; i++){
            let ray = new LightRay(this.bh, this.states[i], this.radii[i], this.length);
            this.rays.push(ray);
        }

    }


    update(states, radii = this.radii){
        this.states = states;
        this.radii = radii;
        for(let i=0; i<this.N; i++){
            this.rays[i].update(this.states[i],this.radii[i]);
        }
    }

    addToScene(scene){
        for(let i=0; i<this.N; i++){
            this.rays[i].addToScene(scene);
        }
    }


}



export default LightRayBundle;
