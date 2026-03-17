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




let defaultMatParams = {
    color :0xc9eaff,
    //0xffffff,
        //0x4d80d1,
        //0xc9eaff,//lightblue
        //0xbee6c5,
        //0xffffff,
    side: DoubleSide,
    transparent:true,
    opacity:1,
    transmission:0.99,
    ior:1.2,
    thickness:0.2,
    roughness:0.1,
    clearcoat:1,
    metalness:0,
};




let toroidalCoords = function(a,b,c){
    let x = Math.cos(a)*Math.sin(c);
    let y = Math.sin(a)*Math.sin(c);
    let z = Math.cos(b)*Math.cos(c);
    let w = Math.sin(b)*Math.cos(c);

    //rotate (x,z,-y)
    return new Vector4(x,z,-y,w);
}


let stereoProj = function(pt){
    return new Vector3(pt.x,pt.y,pt.z).divideScalar(1.-pt.w);
}

let sphCoords = function(angles){
    let phi = angles.phi;
    let theta = angles.theta;

    let x = Math.cos(theta)*Math.sin(phi);
    let y = Math.sin(theta)*Math.sin(phi);
    let z = Math.cos(phi);

    return new Vector3(x,y,z);

}


//coord curve is a function of the form t->{theta: f(t), phi:g(t)}
class HopfTorus{
    constructor(coordCurve,length=6.28, area=6.28) {

        this.length = length;
        this.area = area;

        this.coordCurve = coordCurve;
        this.res = 256;


        //now build the geometry of the hopf surface:
        // map from R2 to R4, in the 3 sphere
        this.surface = function(s,t){
            let angles = coordCurve(t);
            let phi = angles.phi;
            let theta = angles.theta;
            return  toroidalCoords(theta+s,s,phi/2);
        }


        //auxiliary functions for building the actual isometry
        let fudgeFactor = function(t){
            let dt = 0.00025;
            //do a riemann sum up to t:
            let N = Math.floor(t/dt);
            let total = 0.;
            let x = 0.;
            for(let i=0;i<N;i++){
                let a0 = coordCurve(x);
                let a1 = coordCurve(x+dt);

                let sin = Math.sin(a0.phi/2);
                let dtheta = (a1.theta-a0.theta);
                total+= sin*sin*dtheta;
                x += dt;
            }
            return total;
        }
        this.fudgeFactor = fudgeFactor;


        let arcLength = function(t){
            //find the arclength of c(t) at parameter t;
            let x = 0;
            let dx = 2*Math.PI/1000;
            let N = Math.floor(t/dx);

            let tot = 0;
            for(let i=0; i<N; i++) {
                let a0 = coordCurve(x);
                let a1 = coordCurve(x + dx);

                let sin = Math.sin(a0.phi);
                let dtheta = a1.theta - a0.theta;
                let dphi = a1.phi - a0.phi;
                let ds2 = sin * sin * dtheta * dtheta + dphi * dphi;
                let ds = Math.sqrt(ds2);

                tot += ds;
                x += dx;
            }

            return tot;
        }
        this.arcLength = arcLength;

        let inverseArc = function(L){
            //find the t such that the curve on the 2 sphere has length L from o to t.
            let t=0;
            let tot = 0;
            let N = 3000;
            let dt = 2.*Math.PI/N;

            for(let i=0; i<N; i++){
                let a0 = coordCurve(t);
                let a1 = coordCurve(t+dt);

                let sin = Math.sin(a0.phi);
                let dtheta = a1.theta-a0.theta;
                let dphi = a1.phi-a0.phi;
                let ds2 = sin*sin*dtheta*dtheta + dphi*dphi;
                let ds = Math.sqrt(ds2);

                tot += ds;

                if(tot>L){
                    break;
                }
                t += dt;
            }

            return t;
        }
        //save it
        this.inverseArc = inverseArc;


        let isometricImage = function(pt){
            //take a point (u,v) in the plane and find its image on the torus!
            let s = pt.x;
            let v = pt.y;
            //STEP 1: find inverse arclength of 2v
            let t = inverseArc(2*v);
            //STEP 2: PLUG (s,t) into Hopf Map
            let angles = coordCurve(t);
            let phi = angles.phi;
            let theta = angles.theta;
            let f = fudgeFactor(t);
            let P = toroidalCoords(theta+s-f,s-f,phi/2);
            return stereoProj(P);
        }
        this.isometricImage = isometricImage;


        let nonIsoTransitionMap = function(p){
            //map from the plane to the plane
            // (u,v) up to torus isometrically
            //then down to s,t via simple parameterization
            let u = p.x;
            let v = p.y;
            let f = fudgeFactor(v);
            let L = arcLength(v);

            let s = u  + f;
            let t = L/2;

            return new Vector2(s,t);
        }
        this.nonIsoTransitionMap = nonIsoTransitionMap;



    }


    getCurve(curveFn, color=0x25178f, radius = 0.01,closed=false){

        //the curve mesh
        let curvePts = [];
        let radiusValues = [];
        for(let i=0;i<this.res+1;i++){
            let t = 2.*Math.PI * i/this.res;
            let pt = curveFn(t);
            curvePts.push(pt);
            let r = radius*(1+pt.lengthSq());
            radiusValues.push(new Vector3(r,r,r));
        }

        //this is a curve we can call with respect to arclength!
        let curve  = new CatmullRomCurve3(curvePts);
        let radii = new CatmullRomCurve3(radiusValues);
        let mat = new MeshPhysicalMaterial({color:color, roughness:0.5,metalness:0,clearcoat:1});
        let curveGeom = new VarTubeGeometry(curve, radii, 2.*this.res,  16, closed);
        return new Mesh(curveGeom, mat);
    }





    getPlaneCurve(curveFn, color=0x25178f, radius = 0.01,closed=false){

        //the curve mesh
        let curvePts = [];
        let radiusValues = [];
        for(let i=0;i<this.res+1;i++){
            let t = 2.*Math.PI * i/this.res;
            let pt = curveFn(t);
            curvePts.push(pt);
        }

        //this is a curve we can call with respect to arclength!
        let curve  = new CatmullRomCurve3(curvePts);
        let mat = new MeshPhysicalMaterial({color:color, roughness:0.5,metalness:0,clearcoat:1});
        let curveGeom = new TubeGeometry(curve, 2.*this.res,  radius,16, closed);
        return new Mesh(curveGeom, mat);
    }


    getSurface(materialParams = defaultMatParams){

        let mat = new MeshPhysicalMaterial(materialParams);

        let surface = this.surface;
        let paraFn = function(s,t,dest){
            let S = 2.*Math.PI*s;
            let T = 2.*Math.PI*t;
            let q = surface(S,T);
            let P = stereoProj(q);
            dest.set(P.x,P.y,P.z);
        };

        let surfGeom = new ParametricGeometry(paraFn, this.res, this.res);
       return new Mesh(surfGeom, mat);

    }

    getHopfFiber(angles,color=0x8f2117, radius=0.01){
        //given theta and phi, compute the fiber of the hopf map thru this point of S2
        let theta = angles.theta;
        let phi = angles.phi;
        //the curve mesh
        let curvePts = [];
        for(let i=0;i<this.res;i++){
            let s = 2.*Math.PI*i/this.res;
            let P = toroidalCoords(theta+s,s,phi/2);
            let pt = stereoProj(P);
            curvePts.push(pt);
        }

        //this is a curve we can call with respect to arclength!
        let curve  = new CatmullRomCurve3(curvePts);
        let mat = new MeshPhysicalMaterial({color:color});
        let curveGeom = new TubeGeometry(curve, 3.*this.res, radius, 8,true);
        return new Mesh(curveGeom, mat);

    }


    getEdgeTranslate(x,color=0xa32017,radius=0.01){

        //x is a PERCENTAGE OF ALL THE WAY ALONG THE EDGE: IN (0,1)


        let isometricImage = this.isometricImage;
        let area = this.area;
        let length=this.length;

        let curve = function(t){

            //move horizontally along the fiber to get new point
            //fiber has length 2Pi
            let dist = 2.*Math.PI *x;

            //draw translate of the curve connecting  (0,0) to (A/2,L/2)
            let pt = new Vector2(t*area/(4*Math.PI)+dist, t*length/(4*Math.PI));
            //now apply isometry
            return isometricImage(pt);
        }

        return this.getCurve(curve,color,radius,true);
    }

    getIsometricCurve(planecurve,color,radius,closed){

        let isometricImage = this.isometricImage;
        let area = this.area;
        let length=this.length;

        let curve = function(t) {
            let pt = planecurve(t);
            return isometricImage(pt);
        }

        return this.getCurve(curve,color,radius,closed);
    }


    getFiberTranslate(x,color=0x161ba8,radius=0.01){

        //x is a PERCENTAGE OF ALL THE WAY ALONG THE EDGE: IN (0,1)

        //use isometric image to test it out (MUCH SLOWER THAN JUST USING FIBER COMMAND!)
        let isometricImage = this.isometricImage;
        let area = this.area;
        let length=this.length;

        let curve = function(t){
            //translate along curve from (0,0) to (A/2,L/2):
            //to go x percent is easy; just multiply endpoint by x
            let pt = new Vector2(area/2, length/2).multiplyScalar(x);
            pt.add(new Vector2(t,0));
            //now apply isometry
            return isometricImage(pt);
        }

        return this.getCurve(curve,color,radius,true);

    }



    getPointLattice(fiberOffset,edgeOffset,color=0x8c1a0f,radius=0.01){

        let tau = new Vector2(this.area/(2), this.length/(2));
        let xOffsetVec = new Vector3(fiberOffset,0,0).multiplyScalar(2*Math.PI);
        let yOffsetVec = new Vector3(tau.x,tau.y,0).multiplyScalar(edgeOffset);
        let pos = xOffsetVec.add(yOffsetVec);

        let pt = this.isometricImage(pos);
        let r2 = pt.lengthSq();

        let pointGeom = new SphereGeometry(radius*(1+r2));
        let pointMat = new MeshPhysicalMaterial({color:color,roughness:0.1,metalness:0,clearcoat:1});
        let mesh = new Mesh(pointGeom,pointMat)
        mesh.position.set(pt.x,pt.y,pt.z);
        return mesh;

    }


    //takes in a point p=(x,y) in the plane
    getPointXY(p, color=0x8c1a0f, radius =0.01){
        //p is mathematica input [x,y] in the domain spanned by 1 and tau.
        let P = new Vector2(p[0],p[1]).multiplyScalar(2.*Math.PI);

        let pt = this.isometricImage(P);
        let r2 = pt.lengthSq();

        let pointGeom = new SphereGeometry(radius*(1+r2));
        let pointMat = new MeshPhysicalMaterial({color:color,roughness:0.1,metalness:0,clearcoat:1});
        let mesh = new Mesh(pointGeom,pointMat)
        mesh.position.set(pt.x,pt.y,pt.z);
        return mesh;
    }



    getGridlines(N, edgeColor, vertexColor, radius){

        let lines = new Group();

        //get curves on the surface:
        for(let i=0; i<N+1; i++){
            let horiz = this.getFiberTranslate(i/N,edgeColor,radius);
            let vert = this.getEdgeTranslate(i/N,edgeColor,radius);
            lines.add(horiz);
            lines.add(vert);
        }

        // //get vertices to go with these
        // for(let i=0; i<N+1; i++){
        //     for(let j=0; j<N+1; j++){
        //         let pt = this.getPointLattice(i/N,j/N,vertexColor, 1.4*radius);
        //         lines.add(pt);
        //     }
        // }

        return lines;

    }



    getBaseSphere(color=0xa32017,radius=0.01){

        let base = new Group();

        //make the sphere.
        //ITS A TINY SPHERE: RADIUS 1/2
        let sphGeom = new SphereGeometry(0.5);
        let sphMat = new MeshPhysicalMaterial({
            color: 0xc9eaff,
                //0xffffff,
            metalness:0,
            roughness:0.3,
            transparent:true,
            opacity:1,
            transmission:0.95,
            ior:1.4,
            thickness:1,
            clearcoat:1,
        });
        const sph = new Mesh(sphGeom,sphMat);
        base.add(sph);


        //make curve
        let coordCurve = this.coordCurve;
        let sphereCurve = function(t){
            let P = sphCoords(coordCurve(t));
            //display as x, z, -y
           return new Vector3(P.x,P.z,-P.y).multiplyScalar(0.5);
           // return P.multiplyScalar(0.5);
        }
        let curve = this.getCurve(sphereCurve, color, radius,true)
        base.add(curve);

        return base;

    }


    getTransitionEdge(x,color,radius){

        //x is a percent distance along the curve on the sphere
        let transition = this.nonIsoTransitionMap;
        let area = this.area;
        let length = this.length;
        let curve = function(v){
            //curve length is 2Pi:
            let off = 2*Math.PI * x;
            let q = new Vector2(area/2,length/2).divideScalar(2*Math.PI);
            q.multiplyScalar(v);
            q.add(new Vector2(off,0));
            let p = transition(q);
            return new Vector3(p.x,0,p.y);
        }
        return this.getPlaneCurve(curve,color,radius,false);
    }


    getTransitionFiber(x,color,radius){

        //x is a percent distance along the curve on the sphere
        let transition = this.nonIsoTransitionMap;
        let fudge = this.fudgeFactor;
        let curve = function(u){
            //fiber length is 2Pi:
            //getCurve already has 2PI built in, so just let s go from 0 to 1
            let v = 2*Math.PI * x;
            let q = new Vector2(u,v);
            let p = transition(q);
            return new Vector3(p.x,0,p.y);
        }
        return this.getPlaneCurve(curve,color,radius,false);
    }



    getTransitionGridlines(N, color, radius){

        let lines = new Group();

        //get curves on the surface:
        for(let i=0; i<N+1; i++){
            let horiz = this.getTransitionFiber(i/N,color,radius);
            let vert = this.getTransitionEdge(i/N,color,radius);
            lines.add(horiz);
            lines.add(vert);
        }

        return lines;
    }



}


export default HopfTorus;
