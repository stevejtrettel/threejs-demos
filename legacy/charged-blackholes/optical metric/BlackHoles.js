import {Group, Vector3, SphereGeometry, Mesh, MeshPhysicalMaterial,} from "three";

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
        pos: new Vector3(0,0,2),
        color: 0x000000,
    },
    {
        mass:1,
        pos: new Vector3(2,0,0),
        color: 0x000000,
    },
    {
        mass:1,
        pos: new Vector3(0,2,0),
        color: 0x000000,
    }];



//set the radius of event horizon for drawing spheres
let ehRadius = function(mass){
    if(mass==0){
        return 0.6;
    }
    return mass/5;
}




class BlackHoles {

    constructor(bhs = defaultbhs) {


        this.bhs = bhs;

        //set color to black if not specified:
        for (let i = 0; i < bhs.length; i++) {
            if (!this.bhs[i].hasOwnProperty('color')) {
                this.bhs[i].color = 0x000000;
            }
        }

        //default color for lightrays:
        this.defaultColor =0x1f2630;
            //0xc7a70a;
            //0x1f2630;
            //0x000000;

        this.meshes = new Group();

        for (let i = 0; i < bhs.length; i++) {
            //make the geom and material (diff for each bh as might color)
            let ehGeom = new SphereGeometry(1);
            let ehMat = new MeshPhysicalMaterial({
                color: this.bhs[i].color,
                clearcoat: 1,
            });

            let rad = ehRadius(bhs[i].mass);
            let pos = bhs[i].pos;

            let eh = new Mesh(ehGeom, ehMat);
            eh.scale.set(rad, rad, rad);
            eh.position.set(pos.x, pos.y, pos.z);

            this.meshes.add(eh);
        }

        this.buildIntegrator();

    }


    buildIntegrator() {

        //relevant constants for the functions
        //that will be locked in each time it's rebuilt
        let bhs = this.bhs;

        //the function determining potential:
        function U(pos) {
            let u = 1.;
            for (let i = 0; i < bhs.length; i++) {
                let mi = bhs[i].mass;
                let ri = pos.clone().sub(bhs[i].pos).length();
                u += mi / ri;
            }

            return u;
        }

        //its partial derivatives:
        function gradU(pos) {
            let grad = new Vector3(0, 0, 0);
            for (let i = 0; i < bhs.length; i++) {

                let di = pos.clone().sub(bhs[i].pos);
                let ri = di.length();
                let mi = bhs[i].mass;

                grad.add(di.multiplyScalar(-mi / (ri * ri * ri)))
            }

            return grad;
        }


        this.normalize = function (state) {
            //normalize to unit vector in the metric U^2 ds:
            let u = U(state.pos);
            //console.log(u);
            state.vel.normalize();
            //state.vel.divideScalar(u*u);
            return state;
        }

        //build the integrator
        let derive = function (state) {
            let pos = state.pos;
            let vel = state.vel.clone();


            let u = U(pos);
            let grad = gradU(pos);
            let vel2 = vel.lengthSq();
            let dirD = grad.dot(vel);

            let term1 = grad.clone().multiplyScalar(vel2);
            let term2 = vel.clone().multiplyScalar(2 * dirD);
            let acc = term1.sub(term2);
            acc.multiplyScalar(2 / u);

            return new dState(state.vel, acc);
        }
        let ep = 0.01;
        this.integrator = new SymplecticIntegrator(derive, ep);

    }

    addToScene(scene) {
        scene.add(this.meshes);
    }
    updatePos(index, pos) {
        this.bhs[index].pos = pos;

        //reset the position of the blackhole:
        this.meshes.children[index].position.set(pos.x, pos.y, pos.z);  // ← Added .children

        //rebuild the integrator
        this.buildIntegrator();
    }

    updateMass(index, mass) {
        this.bhs[index].mass = mass;

        //reset the scale of this blackhole:
        let rad = ehRadius(mass);
        this.meshes.children[index].scale.set(rad, rad, rad);  // ← Added .children

        //rebuild the integrator
        this.buildIntegrator();
    }


    getEH(pos) {
        //get color of EH if we hit one;
        //else return DEFAULT COLOR
        for(let i=0; i<this.bhs.length; i++){
            let v = pos.clone().sub(this.bhs[i].pos);
            let d = v.length();
            if(d<ehRadius(this.bhs[i].mass)){
                return this.bhs[i].color;
            }
        }
        return this.defaultColor
    }

    stop(state){
        // return false;
        let r = state.pos.clone().length();
        if(r>20){
            //5.2){
            return true;
        }
        for(let i=0; i<this.bhs.length; i++){
            let v = state.pos.clone().sub(this.bhs[i].pos);
            let d = v.length();
            if(d< ehRadius(this.bhs[i].mass)){
                return true;
            }
        }
        return false;
    }

}


export default BlackHoles;
