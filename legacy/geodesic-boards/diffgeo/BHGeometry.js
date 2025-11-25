import DiffGeo from "./DiffGeo-Abstract.js";
import {Vector2, Vector3} from "three";
import {NIntegrateRK} from "../integrators/NIntegrateRK.js";
import Symplectic2 from "../integrators/Symplectic2.js";
import TransportIntegrator from "../integrators/TransportIntegrator.js";
import {toGLSL} from "../utils/toGLSL.js";

export default class BHGeometry extends DiffGeo{

    constructor(R, domain = null) {
        super();

        this.R = R;

        //domain 3/2R is the Event Horizon, 9/8 is embedding limit
        this._setDomain(domain);

        //scratch for not generating things a bajillion times
        this.scratch = new Vector2();

        //build the embedding coords
        this._buildEmbeddingCoords();


        //compute the geodesic acceleration
        this.acceleration = (tv) => {
            let R = this.R;
            let u = tv.pos.x;
            let t = tv.pos.y;
            let uP = tv.vel.x;
            let tP = tv.vel.y;

            let denom = u*(R-u);

            let uAcc = 1/2*(2*u-3*R)*tP*tP - R*uP*uP/denom;
            let tAcc = (2*u-3*R)*uP*tP/denom;

            return this.scratch.set(uAcc,tAcc);
        }

        this.geodesicEqn = new Symplectic2(this.acceleration, 0.02);



    }

    _setDomain(dom=null){
        if(dom){
            this.domain=dom;
        }
        else{
            this.domain = [3 / 2 * this.R, 30 * this.R];
        }

        const [r0,r1] = this.domain;
        this._outside = (pos) => (pos.x < r0 || pos.x > r1);

    }


    _buildEmbeddingCoords(){

        const R = this.R;

        //parameterize a profile of the optical geometry with (r,h) as functions of u:
        this.radius = (u) => Math.sqrt(u*u*u / (u-this.R));
        this.radiusPrime = (u) => (this.radius(u+0.0001)-this.radius(u-0.0001))/(2*0.0001);

        //can compute the height function
        this.heightPrime = (u) => Math.sqrt(u*R*(8*u-9*this.R)/(4*(u-this.R)**3));
        this.height = NIntegrateRK(this.heightPrime,this.domain,0.001);

    }


    /* ----------------------------------------------------------------
    * Required Methods
    * ---------------------------------------------------------------- */

    parameterization = (u,theta) => {
        let r = this.radius(u);
        let h = this.height(u);
        return new Vector3(r*Math.cos(theta),r*Math.sin(theta),h);
    }

    surfaceNormal = (u,theta) => {
        //normal dir is (-h' costheta, -h'sintheta, r')
        let rP = this.radiusPrime(u);
        let hP = this.heightPrime(u);

        return new Vector3(-hP*Math.cos(theta),-hP*Math.sin(theta),rP).normalize();
    }

    integrateGeodesic = (tv, steps = 1000) => {

        const pts  = [];
        let state  = tv.clone();

        for (let i = 0; i < steps; ++i) {
            const u = state.pos.x;
            const t = state.pos.y;

            const pos = this.parameterization(u,t)
            pts.push([pos.x,pos.y,pos.z]);

            state = this.geodesicEqn.step(state);
            if (this._outside(state.pos)) {
                break;
            }
        }
        return pts;
    }


    integrateGeodesicCoords = (tv, steps = 1000) => {

        const pts  = [];
        let state  = tv.clone();

        for (let i = 0; i < steps; ++i) {
            const u = state.pos.x;
            const t = state.pos.y;
            pts.push([u,t]);

            state = this.geodesicEqn.step(state);
            if (this._outside(state.pos)) {
                break;
            }
        }
        return pts;
    }

    getParallelTransport = (coordCurve)=>{
        //return an interpolating function for basis along curve
        console.warn('Need to Implement ParallelTransport: right now doing nothing')
        let trivialTransport = (tv,V) => V;
        return new TransportIntegrator(coordCurve, trivialTransport);
    }

    rebuild(R,dom=null){
        this.R=R;
        this._setDomain(dom)
        this._buildEmbeddingCoords();
    }

    printToString(){

        const precision = 3.;//decimals to show

        let numPts = 500;
        let string = ``;
        string += `C(0,0,1)`;
        string += `\n`;

        let t,r,h,u;
        //a set of points along the [r,h] curve
        //space u evenly over the domain
        let start = this.domain[0];
        let range = this.domain[1]-this.domain[0];
        for(let i=0; i<numPts; i++){
            t = i/(numPts-1);//in 0 to 1
            u = start + t*range;
            r= this.radius(u).toFixed(precision);
            h = this.height(u).toFixed(precision);
            string += `(${r},${0},${h}), `
        }

        return string;

    }


}
