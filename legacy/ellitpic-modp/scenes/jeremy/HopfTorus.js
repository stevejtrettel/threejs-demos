import {
    Vector2,
    Vector3,
    Mesh, CatmullRomCurve3, SphereGeometry, Group,
} from "three";


import{
    toroidalCoords,
    stereoProj,
} from "../../items/utils";
import ParametricGeometry from "../../items/ParametricGeometry";
import {VarTubeGeometry} from "../../items/VarTubeGeometry";



class HopfTorus{

    constructor(coordCurve, latticeData) {
        //curve is a closed curve on 0 to 2*pi
        this.coordCurve = coordCurve;

        //store length and area
        this.length =latticeData.length;
        this.area =latticeData.area;
        this.tau = latticeData.tau;
        this.fromTauCoords = latticeData.fromTauCoords;

        this.res = 256;

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

        let toFundamentalDomain = function(pt){
            //FIX THIS FUNCTION TO BE BETTER, LATER
            //get us into the right strip: we dont' actually care if x direction is within fundamental domain or not
            //all our points are positive (so just need to move down if y is above height of fd)
            let gen = new Vector2(latticeData.area/2,latticeData.length/2);
            while(pt.y>(latticeData.length/2)){
                pt = pt.sub(gen);
            }

            return pt;
        }
        this.toFundamentalDomain = toFundamentalDomain;

        let isometricImage = function(pt){
            //take a point (u,v) in the plane and find its image on the torus
            //FUNDAMENTAL DOMAIN: (0,2PI) in U direction, to height (A/2, L/2).
            pt = toFundamentalDomain(pt);
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

    }

    getSurface(material){
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
        return new Mesh(surfGeom, material);
    }


    getLift(planecurve, radius=0.05, material,closed = false){
        //DOMAIN OF CURVE: [0,1]
        //given a curve x->(s(x),t(x)) in the domain
        //lift under isometry to hopf torus
        let curvePts = [];
        let radiusValues = [];
        for(let i=0;i<this.res+1;i++){
            let t = i/this.res;
            let planarPt = planecurve(t);
            let pt = this.isometricImage(planarPt);
            curvePts.push(pt);
            let r = radius*(1+pt.lengthSq());
            radiusValues.push(new Vector3(r,r,r));
        }
        let curve  = new CatmullRomCurve3(curvePts);
        let radii = new CatmullRomCurve3(radiusValues);
        let curveGeom = new VarTubeGeometry(curve, radii, 2.*this.res,  16, closed);
        return new Mesh(curveGeom, material);
    }


    getFiberAt(x, radius=0.025, mateirla){
        let edgeGen = new Vector2(this.area/2,this.length/2);
        let origin = edgeGen.multiplyScalar(x);
        let dir = new Vector2(2*Math.PI,0);
        let fiberCurve = function(s){
            return origin.clone().add(dir.clone().multiplyScalar(s));
        }
        return this.getLift(fiberCurve, radius, material);
    }

    getOppEdgeAt(x, radius=0.025, material){
        let dir = new Vector2(-this.area/2,this.length/2);
        let origin = new Vector2(2*Math.PI,0).multiplyScalar(x);
        let edgeCurve = function(t){
            return origin.clone().add(dir.clone().multiplyScalar(t));
        }
        return this.getLift(edgeCurve, radius, material);
    }

    getEdgeAt(x,  radius=0.025, material){
        let dir = new Vector2(this.area/2,this.length/2);
        let origin = new Vector2(2*Math.PI,0).multiplyScalar(x);
        let edgeCurve = function(t){
            return origin.clone().add(dir.clone().multiplyScalar(t));
        }
        return this.getLift(edgeCurve, radius, material);
    }

    getGridlines(N,radius=0.025,material){
        let lines = new Group();
        //get curves on the surface:
        for(let i=0; i<N+1; i++){
            let horiz = this.getFiberAt(i/N,radius,material);
            let vert = this.getEdgeAt(i/N,radius,material);
            lines.add(horiz);
            lines.add(vert);
        }
        return lines;
    }

    getPoint(pt, radius=0.05, material){
        let q = this.isometricImage(pt);
        let rescale = 1+q.lengthSq();
        let geom = new SphereGeometry(radius*rescale);
        let mesh = new Mesh(geom, material);
        mesh.position.set(q.x,q.y,q.z);
        return mesh;
    }


}


export default HopfTorus;
