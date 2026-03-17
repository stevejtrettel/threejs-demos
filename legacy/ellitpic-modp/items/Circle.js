
//color scheme
import {
    EllipseCurve,
    MeshPhysicalMaterial,
    TubeGeometry,
    Vector3,
    Mesh,
    LineCurve3,
    SphereGeometry,
    CatmullRomCurve3
} from "three";

import CircleCurve from "./CircleCurve";

import {makeMaterial,colors} from "./utils";

const glassColor =0xc9eaff;
const redColor = 0xd43b3b;//0xe03d24
const greenColor = 0x4fbf45;
const blueColor = 0x4287f5;
const yellowColor = 0xffd738;



let toVec3 = function(ang){
    return new Vector3(Math.cos(ang), 0, Math.sin(ang));
}


class Circle{
    constructor(scale=1.){
        this.scale = scale;
    }

    getCircle(color=colors.glass,radius=0.02,glass=true){
        const tau = 2*Math.PI;
        let scale = this.scale;
        let fn = function(t){
            return new Vector3(Math.cos(tau*t),0, Math.sin(tau*t)).multiplyScalar(scale);
        }
        return this.getCurve(fn,color,radius,glass);
    }

    getArc(ang0,ang1,color=colors.blue,radius=0.025,glass=false){

        let scale = this.scale;
        let fn = function(t){
            let ang = ang0 + t*(ang1-ang0);
            return new Vector3(Math.cos(ang),0, Math.sin(ang)).multiplyScalar(scale);
        }
        return this.getCurve(fn,color,radius,glass);
    }

    getRod(ang0,ang1,color=colors.blue,radius=0.025,glass=false){
        let p = toVec3(ang0).multiplyScalar(this.scale);
        let q = toVec3(ang1).multiplyScalar(this.scale);
        const line = new LineCurve3(p,q);
        const geom = new TubeGeometry(line,64,radius,8,false);
        const mesh = new Mesh(geom, makeMaterial(color,glass));
        return mesh;
    }

    getBentRod(start,end,bendingDir, color=colors.blue, radius=0.02, glass=false){
        //start and end are angles
        const p = toVec3(start).multiplyScalar(this.scale);
        const q = toVec3(end).multiplyScalar(this.scale);
        const dir = q.clone().sub(p);
        let amp =this.scale;

        let pts = [];
        for(let i=0; i<64; i++){
            let t = i/63;
            let pos = p.clone().add(dir.clone().multiplyScalar(t));
            let offset = bendingDir.clone().multiplyScalar(amp*Math.sin(Math.PI*t));
            pos.add(offset)
            pts.push(pos);
        }

        const curve = new CatmullRomCurve3(pts);
        const geom = new TubeGeometry(curve, 64,radius);
        const mesh = new Mesh(geom, makeMaterial(color,glass));
        return mesh;
    }

    getVertex(ang,color=colors.red,radius=0.15,glass=false){
        const p = toVec3(ang).multiplyScalar(this.scale);
        let geom = new SphereGeometry(radius);
        let mesh = new Mesh(geom, makeMaterial(color,glass));
        mesh.position.set(p.x,p.y,p.z);
        return mesh;
    }

    getCurve(fn,color=colors.blue,radius=0.025,glass=false){
        let pts = [];
        for(let i=0; i<64; i++){
            let t = i/63;
            pts.push(fn(t));
        }
        let path = new CatmullRomCurve3(pts);
        let curveGeom = new TubeGeometry(path,64,radius);
        return new Mesh(curveGeom, makeMaterial(color,glass));
    }

}


export default Circle;
