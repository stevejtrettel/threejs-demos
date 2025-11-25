import{ Vector3 } from "three";

import State from "../integrators/States/State.js";

// initial conditions for the light ray bundle
//exports an object with states, radii.  Each of these is an array.

let spray = function(state,  numRays = 10, spread=0.2,radius=0.02){
    let states = [];
    let radii = [];

    //each position is the same
    let pos = state.pos.clone();
    //get original direction and a normal to the direction, to create spray
    let dir = state.vel.clone().normalize();
    let normal = new Vector3(0,1,0).cross(dir);

    for(let i=-numRays; i<numRays+1; i++){
        let ang = spread*i/(numRays);//spans from -spread to spread in radians

        let arc = dir.clone().multiplyScalar(Math.cos(ang));
        arc.add(normal.clone().multiplyScalar(Math.sin(ang)));

        let newState = new State(pos, arc);
        states.push(newState);

        let newRadius = radius;
            //0.02/(1 + 2.*(i/numRays)*(i/numRays));
        radii.push(newRadius);
    }

    return {states: states, radii:radii};
}



let sprayGrid = function(){
    let states = [];
    let radii = [];

    return {states: states, radii:radii};
}


let sprayCone = function(){
    let states = [];
    let radii = [];

    return {states: states, radii:radii};
}


export {spray, sprayCone, sprayGrid}
