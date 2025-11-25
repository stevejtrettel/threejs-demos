import {Vector2,Vector3} from "three";

import State from "../integrators/States/State.js";
import LightRay from "./LightRay.js";

class LightConeSpray{
    constructor(bh, pos, numRays=20, rad=0.01, length=100, timeComponent=1) {

        this.bh = bh;
        this.pos = pos;
        this.N = numRays;
        this.rad = rad;
        this.length = length;
        this.timeComponent = timeComponent;

        this.rays = [];

        for(let i=0; i<this.N; i++){
            let ang = 2*Math.PI*i/this.N;
            let vel = new Vector3(timeComponent, Math.cos(ang), Math.sin(ang));
            let state = new State(this.pos, vel);
            let ray = new LightRay(this.bh, state, this.rad, this.length);
            this.rays.push(ray);
        }
    }

    addToScene(scene){
        for(let i=0; i<this.N; i++){
            this.rays[i].addToScene(scene);
        }
    }

    removeFromScene(scene){
        for(let i=0; i<this.N; i++){
            const ray = this.rays[i];
            if (ray.trajectory) {
                scene.remove(ray.trajectory.tube, ray.trajectory.start, ray.trajectory.end);
                ray.trajectory.tube.geometry.dispose();
                if (ray.trajectory.start) ray.trajectory.start.geometry.dispose();
                if (ray.trajectory.end) ray.trajectory.end.geometry.dispose();
            }
        }
    }
}


export default LightConeSpray;
