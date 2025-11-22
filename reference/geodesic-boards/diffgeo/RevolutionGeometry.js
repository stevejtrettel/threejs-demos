import {Vector2, Vector3} from "three";

import { parse,simplify,derivative } from 'mathjs/number';

import DiffGeo from "./DiffGeo-Abstract.js";
import Symplectic2 from "../integrators/Symplectic2.js";
import {fromMathJS} from "../utils/fromMathJS.js";
import {toGLSL} from "../utils/toGLSL.js";
import TransportIntegrator from "../integrators/TransportIntegrator.js";
import {createCatmullRomVec} from "../interpolators/catmullRomVector.js";


//curve equation is a pair [r,h] as functions of a variable u: [r,h]=[x,y] when rotating around y axis
export default class RevolutionGeometry extends DiffGeo{
    constructor(curveEqn, curveDomain, parameters) {
        super();

        //set the rEqn and hEqn from curve
        this._setEquation(curveEqn);

        //save domain and parameters
        this.domain     = [curveDomain,[0,2*Math.PI]];
        this.parameters = parameters;

        //domain guard
        const [u0,u1] = curveDomain;
        this._outside = (pos) => (pos.x < u0 || pos.x > u1);

        /* scratch vector reused each call to avoid GC churn */
        this.scratch = new Vector2();

        //0.  Build f, fx, fy, fxx, fxy, fyy  (symbolic → compiled)
        this._buildDerivatives();

        //1.  Build geodesic acceleration, parallel transport etc from derivatives
        this.acceleration = tv => {

            const {pos: {x:u,y:t},vel:{x:uP,y:tP}} = tv;

            //const h = this.h(u);
            const hu = this.hu(u);
            const huu = this.huu(u);

            const r = this.r(u);
            const ru = this.ru(u);
            const ruu = this.ruu(u);

            const uAcc = (r*ru*tP*tP - uP*uP*(hu*huu + ru*ruu))/(1. + hu*hu + ru*ru);
            const tAcc = -2.*uP*tP*ru/r;

            return this.scratch.set(uAcc, tAcc);
        };

        this.geodesicEqn = new Symplectic2(this.acceleration, 0.02);

        this.dTransport = (tv, V) => {

            const {pos: {x:u,y:t},vel:{x:uP,y:tP}} = tv;

           // const h = this.h(u);
            const hu = this.hu(u);
            const huu = this.huu(u);

            const r = this.r(u);
            const ru = this.ru(u);
            const ruu = this.ruu(u);

            const denom = 1 + ru * ru + hu * hu;

            /* Christoffel symbols in coordinates */
            //x=u and y=t for our surface of rev
            const Γxxx =  (hu*huu + ru*ruu)/denom;
            const Γyyy =  0;
            const Γxyx =  0;
            const Γxxy =  0;
            const Γxyy =  ru/r;
            const Γyyx =  -r*ru / denom;

            const VuP = -uP * (Γxxx * V.x + Γxyx * V.y)
                -tP * (Γxyx * V.x + Γyyx * V.y);
            const VtP = -uP * (Γxxy * V.x + Γxyy * V.y)
                -tP * (Γxyy * V.x + Γyyy * V.y);

            return this.scratch.set(VuP, VtP);
        };


    }



    /* ----------------------------------------------------------------
    * Internals
    * ---------------------------------------------------------------- */

    _setEquation(curveEqn){
        this.rEqn = undefined;
        this.hEqn = undefined;

        //eqn is an array [rEqn,hEqn]: if we get just ONE equation, make a standard surface of rev
        if(typeof curveEqn == "string"){
            this.rEqn = curveEqn;
            this.hEqn = 'u';
        }

        else{
            this.rEqn = curveEqn[0];
            this.hEqn = curveEqn[1];
        }

    }


    _buildDerivatives() {

        // 1) parse & simplify once
        const nodeR      = parse(this.rEqn);
        const nodeH      = parse(this.hEqn);
        const paramNames = Object.keys(this.parameters);

        //compile to standard JS using our own function
        const compile       = src =>
            fromMathJS(src, {
                vars:      ['u'],
                params:    paramNames,
                paramsObj: this.parameters
            });

        // helper to get a simplified node derivative
        const d = (n,v) => simplify(derivative(n, v));

        // 2) build symbolic ASTs for each
        const nodeRu  = d(nodeR,    'u');
        const nodeRuu = d(nodeRu,   'u');

        const nodeHu  = d(nodeH,    'u');
        const nodeHuu = d(nodeHu,   'u');


        // 3) compile to JS functions (with numeric fallback)
        this.r   = compile(nodeR);
        this.ru  = compile(nodeRu);
        this.ruu  = compile(nodeRuu);

        this.h   = compile(nodeH);
        this.hu = compile(nodeHu);
        this.huu = compile(nodeHuu);


        // 4) capture GLSL‐compatible code strings
        //  These strings can be inlined into the shader as:
        // float r(float u) { return <this.glsl_r>; }
        this.glsl_r   = toGLSL(nodeR);
        this.glsl_ru  = toGLSL(nodeRu);
        this.glsl_ruu  = toGLSL(nodeRuu);

        this.glsl_h   = toGLSL(nodeH);
        this.glsl_hu  = toGLSL(nodeHu);
        this.glsl_huu  = toGLSL(nodeHuu);

    }





    /* ----------------------------------------------------------------
    * Required Methods
    * ---------------------------------------------------------------- */

    parameterization = (u,t)=> {
        let r = this.r(u);
        let h = this.h(u);
        return new Vector3(r*Math.cos(t),r*Math.sin(t),h);
    }

    surfaceNormal = (coords) => {
        const {x:u,y:t}=coords;
        const ru = this.ru(u);
        const hu= this.hu(u);
        return new Vector3(-hu*Math.cos(t),-hu*Math.sin(t),ru).normalize();
    }

    integrateGeodesic(tv, steps = 300) {

        const pts  = [];
        let state  = tv.clone();

        for (let i = 0; i < steps; ++i) {

            const u = state.pos.x;
            const t = state.pos.y;
            const pos = this.parameterization(u,t)

            pts.push([pos.x,pos.y,pos.z]);

            state = this.geodesicEqn.step(state);
            if (this._outside(state.pos)) break;
        }

        return pts;
    }

    integrateGeodesicCoords(tv, steps = 300) {

        const pts  = [];
        let state  = tv.clone();

        for (let i = 0; i < steps; ++i) {

            const u = state.pos.x;
            const t = state.pos.y;
            pts.push([u,t]);

            state = this.geodesicEqn.step(state);
            if (this._outside(state.pos)) break;
        }

        return pts;
    }


    getParallelTransport = (coordCurve) => {
        //return an interpolating function for basis along curve
        //coordCurve goes from 0 to 1
        return new TransportIntegrator(coordCurve, this.dTransport,0.0005);
    }
    //
    //
    // parallelTransport(coordCurve){
    //     //return an interpolating function for basis along curve
    //     //coordCurve goes from 0 to 1
    //     //X and Y are our COORDINATES
    //
    //     const integrator  = new TransportIntegrator(coordCurve, this.dTransport);
    //
    //     const steps = 100;
    //     const Ts = [], Xs = [], Ys = [];
    //
    //     let X = new Vector2(1, 0), Y = new Vector2(0, 1);
    //     Ts.push(0); Xs.push(X.clone()); Ys.push(Y.clone());
    //
    //     for (let i = 0; i < steps; ++i) {
    //         const t = i / steps;
    //         X = integrator.step(t - 1 / steps, X);
    //         Y = integrator.step(t - 1 / steps, Y);
    //         Ts.push(t);
    //         Xs.push(X.clone());
    //         Ys.push(Y.clone());
    //     }
    //
    //     const XTransport = createCatmullRomVec(Ts,Xs);
    //     const YTransport = createCatmullRomVec(Ts,Ys);
    //     return (t)=>[XTransport(t),YTransport(t)];
    // }

    rebuild(curveEqn){
        //rebuild: the other functions all call the derivatifes so don't need to be rebuilt
        this._setEquation(curveEqn);
        this._buildDerivatives();
    }


}
