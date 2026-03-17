import {
    CatmullRomCurve3,
    Mesh,
    MeshPhysicalMaterial,
    TubeGeometry,
    Vector2,
    Vector3,
    Vector4,
    SphereGeometry,
    DoubleSide,
    Group,
} from "three";

import {VarTubeGeometry} from "./VarTubeGeometry";
import ParametricGeometry from "./ParametricGeometry";

import {colors,stereoProj,toroidalCoords,makeMaterial} from "./utils";


//a class for showing what happens when we don't do all the
//work to make an isometric parameterization
//works same as HopfTorus

//coord curve is a function of the form t->{theta: f(t), phi:g(t)}
class HopfTorusNonIso{
    constructor(coordCurve,latticeData) {

        this.length = latticeData.length;
        this.area = latticeData.area;

        this.coordCurve = coordCurve;
        this.res = 256;

        //now build the geometry of the hopf surface:
        // map from R2 to R4, in the 3 sphere
        this.surface = function(s,t){
            let angles = coordCurve(t);
            let phi = angles.phi;
            let theta = angles.theta;
            return  stereoProj(toroidalCoords(theta+s,s,phi/2));
        }

    }

    getSurface(color=colors.glass, glass=false){
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
        let surfGeom = new ParametricGeometry(parameterization, this.res, this.res);
        let surfMat = makeMaterial(color,glass);
        return new Mesh(surfGeom, surfMat);
    }


    getCurve(planecurve, color =  colors.red, radius=0.05,  glass=false,closed = false){
        //DOMAIN OF CURVE: [0,1]
        //given a curve x->(s(x),t(x)) in the domain
        //lift under isometry to hopf torus
        let curvePts = [];
        let radiusValues = [];
        for(let i=0;i<this.res+1;i++){
            let t = i/this.res;
            let planarPt = planecurve(t);
            let pt = this.surface(planarPt.x,planarPt.y);
            curvePts.push(pt);
            let r = radius*(1+pt.lengthSq());
            radiusValues.push(new Vector3(r,r,r));
        }
        let curve  = new CatmullRomCurve3(curvePts);
        let radii = new CatmullRomCurve3(radiusValues);
        let curveGeom = new VarTubeGeometry(curve, radii, 2.*this.res,  16, closed);
        let mat = makeMaterial(color,glass);
        return new Mesh(curveGeom, mat);
    }



    getFiberAt(x, color=colors.blue, radius=0.025, glass=false){
        let edgeGen = new Vector2(this.area/2,this.length/2);
        let origin = edgeGen.multiplyScalar(x);
        let dir = new Vector2(2*Math.PI,0);
        let fiberCurve = function(s){
            return origin.clone().add(dir.clone().multiplyScalar(s));
        }
        return this.getCurve(fiberCurve,color, radius, glass);
    }

    getOppEdgeAt(x, color=colors.blue, radius=0.025, glass=false){
        let dir = new Vector2(-this.area/2,this.length/2);
        let origin = new Vector2(2*Math.PI,0).multiplyScalar(x);
        let edgeCurve = function(t){
            return origin.clone().add(dir.clone().multiplyScalar(t));
        }
        return this.getCurve(edgeCurve,color, radius, glass);
    }

    getEdgeAt(x, color=colors.blue, radius=0.025, glass=false){
        let dir = new Vector2(this.area/2,this.length/2);
        let origin = new Vector2(2*Math.PI,0).multiplyScalar(x);
        let edgeCurve = function(t){
            return origin.clone().add(dir.clone().multiplyScalar(t));
        }
        return this.getCurve(edgeCurve,color, radius, glass);
    }

    getPoint(pt,  color=colors.red, radius=0.05, glass=false){
        let q = this.surface(pt);
        let rescale = 1+q.lengthSq();
        let geom = new SphereGeometry(radius*rescale);
        let mat = makeMaterial(color,glass);
        let mesh = new Mesh(geom, mat);
        mesh.position.set(q.x,q.y,q.z);
        return mesh;
    }

}


export default HopfTorusNonIso;
