import {
    Group,
    Vector3,
    Vector2,
    SphereGeometry,
    Mesh,
    MeshPhysicalMaterial,
    Cylindrical,
    CylinderGeometry, DoubleSide,
} from "three";

import dState from "./integrators/States/dState.js";
import SymplecticIntegrator from "./integrators/Symplectic.js";


// this class implements black hole Majumdar-Papapetrou Solutions
// to the Einstein-Maxwell Equations
// Follows https://arxiv.org/abs/1603.04469 Main idea is below
// (1) null geodesics are invariant under conformal change
// (2)this metric is conformal to the ultrastatic metric -dt^2 + U^4 g_euc
// (3) geodesics of ultrastatic metrics project to geodesics of space metric
// (4) space metric is conformally flat: easy to write down geodesic eqns

let defaultbhs =[
    {
        mass:1,
        pos: new Vector2(0,0),
        color: 0x000000,
    },
    {
        mass:1,
        pos: new Vector2(2,0),
        color: 0x000000,
    }];



//set the radius of event horizon for drawing spheres
let ehRadius = function(mass){
    return mass/5.+0.1;
}




class BlackHoles {

    constructor(bhs = defaultbhs, scale = 1) {


        this.bhs = bhs;
        this.scale = scale;

        //set color to black if not specified:
        for (let i = 0; i < bhs.length; i++) {
            if (!this.bhs[i].hasOwnProperty('color')) {
                this.bhs[i].color = 0x000000;
            }
        }

        // Store original masses for updateMass scaling
        this.originalMasses = bhs.map(bh => bh.mass);

        //default color for lightrays:
        this.defaultColor = 0xc7a70a;
        //0x000000;

        this.meshes = new Group();

        for (let i = 0; i < bhs.length; i++) {
            //make the geom and material (diff for each bh as might color)
            let rad = ehRadius(bhs[i].mass);
            let ehGeom = new CylinderGeometry(rad,rad,100,32,1,false);
            let ehMat = new MeshPhysicalMaterial({
                color: this.bhs[i].color,
                clearcoat: 1,
                side:DoubleSide,
            });
            let pos = bhs[i].pos;
            let eh = new Mesh(ehGeom, ehMat);
            eh.rotateZ(Math.PI/2);
            // Pre-divide by scale so that after group scaling it ends up at the correct position
            eh.position.set(0, pos.x / scale, pos.y / scale);

            this.meshes.add(eh);
        }

        this.meshes.scale.set(1,scale,scale);
        this.buildIntegrator();

    }


    buildIntegrator() {

        //relevant constants for the functions
        //that will be locked in each time it's rebuilt
        let bhs = this.bhs;

        //the function determining potential:
        function U(pos2D) {
            //let pos2D = new Vector2(pos.y,pos.z);
            let u = 1.;
            for (let i = 0; i < bhs.length; i++) {
                let mi = bhs[i].mass;
                let ri = pos2D.clone().sub(bhs[i].pos).length();
                u += mi / ri;
            }
            return u;
        }

        //its partial derivatives:
        function gradU(pos2D) {
            let grad = new Vector2(0, 0);
            // let pos2D = new Vector2(pos.y,pos.z);
            for (let i = 0; i < bhs.length; i++) {
                let di = pos2D.clone().sub(bhs[i].pos);
                let ri = di.length();
                let mi = bhs[i].mass;
                grad.add(di.multiplyScalar(-mi / (ri * ri * ri)))
            }
            return grad;
        }


        this.normalize = function (state) {
            //normalize to unit vector in the metric U^2 ds:
            //let u = U(state.pos);
            //console.log(u);
            state.vel.normalize();
            //state.vel.divideScalar(u*u);
            return state;
        }

        //build the integrator
        let derive = function (state) {
            let pos = state.pos;
            let vel = state.vel.clone();

            let pos2D = new Vector2(pos.y,pos.z);
            let vel2D = new Vector2(vel.y,vel.z);


            let u = U(pos2D);
            let grad = gradU(pos2D);
            let vel2 = vel2D.lengthSq();
            let dirD = grad.dot(vel2D);

            let term1 = grad.clone().multiplyScalar(vel2);
            let term2 = vel2D.clone().multiplyScalar(2 * dirD);
            let acc = term1.sub(term2);
            acc.multiplyScalar(2 / u);

            //acc is a 2D vector
            //we want the final direction (X) to go at constant speed
            let acc3D = new Vector3(0,acc.x,acc.y);

            return new dState(state.vel, acc3D);
        }

        let ep = 0.01;
        this.integrator = new SymplecticIntegrator(derive, ep);

    }

    addToScene(scene) {
        scene.add(this.meshes);
    }

    removeFromScene(scene) {
        scene.remove(this.meshes);
    }

    getEH(pos) {
        //get color of EH if we hit one;
        //else return DEFAULT COLOR
        // Extract spatial coordinates from Vector3
        let pos2D = new Vector2(pos.y, pos.z);
        for(let i=0; i<this.bhs.length; i++){
            let v = pos2D.clone().sub(this.bhs[i].pos);
            let d = v.length();
            if(d<ehRadius(this.bhs[i].mass)){
                return this.bhs[i].color;
            }
        }
        return this.defaultColor
    }


    updatePos(index, pos) {
        // pos is a Vector2 with .x and .y components
        this.bhs[index].pos = pos;

        // Reset the position of the black hole cylinder
        // Pre-divide by scale so that after group scaling it ends up at the correct position
        this.meshes.children[index].position.set(0, pos.x / this.scale, pos.y / this.scale);

        // Rebuild the integrator with new positions
        this.buildIntegrator();
    }

    updateMass(index, mass) {
        this.bhs[index].mass = mass;

        // Calculate scale factor relative to original mass
        let originalRad = ehRadius(this.originalMasses[index]);
        let newRad = ehRadius(mass);
        let scaleFactor = newRad / originalRad;

        // Set the local scale of this black hole mesh
        this.meshes.children[index].scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Rebuild the integrator with new masses
        this.buildIntegrator();
    }


    stop(state){
        // return false;
        let pos2D = new Vector2(state.pos.y,state.pos.z);
        let r = pos2D.clone().length();
        if(r>50){
            return true;
        }
        for(let i=0; i<this.bhs.length; i++){

            let v = pos2D.clone().sub(this.bhs[i].pos);
            let d = v.length();
            if(d< 0.5*ehRadius(this.bhs[i].mass)){
                return true;
            }
        }
        return false;
    }

}


export default BlackHoles;
