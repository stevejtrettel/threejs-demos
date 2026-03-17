import {CatmullRomCurve3, Group, Mesh, MeshPhysicalMaterial,
    SphereGeometry, TubeGeometry, Vector3, DoubleSide} from "three";

import {sphCoords,makeMaterial, stereoProj, toroidalCoords,colors} from "./utils";
import ParametricGeometry from "./ParametricGeometry";
import {VarTubeGeometry} from "./VarTubeGeometry";



//a class to draw the preimage of a curve under the hopf fibration
//doesn't need any of the fancy stuff for isometrics, just points along curve and hopf fibers.
//also can render out the base


let equator = function(t){
    return { theta: t, phi: Math.PI/2};
}

class HopfPreimage{
    constructor(coordCurve = equator) {

        this.coordCurve = coordCurve;
        this.baseRad = 0.5;

    }

    getPreimageCurve(color=colors.glass,glass=false){
        //preimage of entire curve = a surface

        //now build the geometry of the hopf surface:
        //this is a function on [0,2pi]x[0,2pi]
        let coordCurve = this.coordCurve;
        let parameterization = function(s,t,dest){
            //s and t are in [0,1]x[0,1]:
            let S = 2*Math.PI*s;
            let T = 2.*Math.PI*t;
            let angles = coordCurve(T);
            let phi = angles.phi;
            let theta = angles.theta;
            let p4 =  toroidalCoords(theta+S,S,phi/2);
            let p = stereoProj(p4);
            dest.set(p.x,p.y,p.z);
        }
        let surfGeom = new ParametricGeometry(parameterization, 256,256);
        let surfMat = makeMaterial(color,glass);
        surfMat.side = DoubleSide;
        let mesh =  new Mesh(surfGeom, surfMat);
        return mesh;
    }


    getPreimagePoint(angles, color=colors.blue,radius=0.025,glass=false){
        let theta = angles.theta;
        let phi = angles.phi;

        //the curve mesh
        let curvePts = [];
        let curveRadii = [];
        for(let i=0;i<128;i++){
            let s = 2.*Math.PI*i/128;
            let P = toroidalCoords(theta+s,s,phi/2);
            let pt = stereoProj(P);
            curvePts.push(pt);
            let r = radius*(1+pt.lengthSq());
            curveRadii.push(new Vector3(r,r,r));
        }
        let curve  = new CatmullRomCurve3(curvePts);
        let radii = new CatmullRomCurve3(curveRadii);
        let curveGeom = new VarTubeGeometry(curve, radii, 256,  16, true);
        let mat = makeMaterial(color,glass);
        return new Mesh(curveGeom, mat);
    }

    getPreimagePointOnCurve(t,color=colors.blue,radius=0.025,glass=false){
        let ang = this.coordCurve(t);
       return this.getPreimagePoint(ang,color,radius,glass);
    }

    getBase(color=colors.glass){
        //get glass sphere for base
        let geo = new SphereGeometry(this.baseRad);
        let mat = new MeshPhysicalMaterial({
            color:color,
            transparent:true,
            opacity:1,
            transmission:0.9,
            ior:1.1,
            thickness:0.2,
            roughness:0.1,
            clearcoat:1,
            metalness:0,
        });
        return new Mesh(geo,mat);
    }

    getBasePoint(angles,color=colors.blue,radius=0.05,glass=false){
        let pt = sphCoords(angles).multiplyScalar(this.baseRad);
        let geo = new SphereGeometry(radius);
        let mat = makeMaterial(color,glass);
        let mesh = new Mesh(geo,mat);
        mesh.position.set(pt.x,pt.z,-pt.y);
        return mesh;
    }

    getBasePointOnCurve(t,color=colors.blue, radius=0.05,glass=false){
        //get point c(t) along curve
        let angles = this.coordCurve(t);
        return this.getBasePoint(angles,color,radius,glass);
    }

    getBaseCurve(color=colors.blue,radius=0.025,glass=false){
        //get the curve on the base sphere
        let pts = [];
        for(let i=0;i<128;i++){
            let t = 2*Math.PI * i/128;
            let p = sphCoords(this.coordCurve(t));
            pts.push(new Vector3(p.x,p.z,-p.y).multiplyScalar(this.baseRad));
        }
        let curve = new CatmullRomCurve3(pts);
        let geo = new TubeGeometry(curve, 256,radius,8,false);
        let mat = makeMaterial(color,glass);
        return new Mesh(geo,mat);
    }

    getCurveOnBase(color=colors.blue,radius=0.025,glass){
        //curve and base as one object
        let base = new Group();
        base.add(this.getBase());
        base.add(this.getBaseCurve(color,radius,glass));
        return base;
    }

}


export default HopfPreimage;
