import {Vector2, Vector3} from "three";

import State from "../integrators/States/State.js";
import LightRay from "./LightRay.js";

class LightRaySpray{
    constructor(bh, pos, centralVel, numRays=20, angularSpread=0.5, rad=0.01, length=100, timeComponent=null) {

        this.bh = bh;
        this.pos = pos;
        this.centralVel = centralVel;
        this.N = numRays;
        this.angularSpread = angularSpread; // in radians
        this.rad = rad;
        this.length = length;
        // If timeComponent not specified, use the central velocity's time component
        this.timeComponent = (timeComponent !== null) ? timeComponent : centralVel.x;

        this.rays = [];

        // Extract spatial velocity components (y, z)
        let spatialVel = new Vector2(centralVel.y, centralVel.z);
        let spatialDir = spatialVel.clone().normalize();

        // Create perpendicular direction in spatial plane
        // If spatial direction is (a, b), perpendicular is (-b, a)
        let spatialNormal = new Vector2(-spatialDir.y, spatialDir.x);

        for(let i = 0; i < this.N; i++){
            // Distribute rays evenly within the angular spread
            // Map i from [0, N-1] to angle from [-angularSpread, +angularSpread]
            let t = (i / (this.N - 1)) * 2 - 1; // ranges from -1 to +1
            let ang = t * angularSpread;

            // Create new spatial direction by rotating in spatial plane
            let newSpatialDir = spatialDir.clone().multiplyScalar(Math.cos(ang))
                .add(spatialNormal.clone().multiplyScalar(Math.sin(ang)));

            // Reconstruct full spacetime velocity
            // Use the specified time component (can compress/stretch time axis)
            let newVel = new Vector3(this.timeComponent, newSpatialDir.x, newSpatialDir.y);

            let state = new State(this.pos, newVel);
            let ray = new LightRay(this.bh, state, this.rad, this.length);
            this.rays.push(ray);
        }
    }

    addToScene(scene){
        for(let i = 0; i < this.N; i++){
            this.rays[i].addToScene(scene);
        }
    }

    removeFromScene(scene){
        for(let i = 0; i < this.N; i++){
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


export default LightRaySpray;
