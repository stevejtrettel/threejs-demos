import {CatmullRomCurve3, Mesh, MeshPhysicalMaterial, SphereGeometry, TubeGeometry} from "three";

//class takes in a CatmullRom Curve and produces geometry.

class NumericalCurve{
    constructor(pts, color=0xfffff, radius = 0.1) {

        this.res = 1024;

        this.color = color;
        this.radius = radius;

        //make the curve
        this.curve = new CatmullRomCurve3(pts);

        this.material = new MeshPhysicalMaterial({
            clearcoat:1,
            environmentMapIntensity:2,
            color: color,
            metalness:0,
            roughness:0,
        });

        let geo = new TubeGeometry(this.curve, this.res, this.radius,8);
        this.tube = new Mesh( geo, this.material);

        let ball = new SphereGeometry(2*this.radius, 32,16);

        this.start = new Mesh( ball, this.material);
        let startPt = this.curve.getPoint(0);
        this.start.position.set(startPt.x, startPt.y, startPt.z);

        this.end = new Mesh(ball, this.material);
        let endPt = this.curve.getPoint(1);
        this.end.position.set(endPt.x, endPt.y, endPt.z);

    }

    setCurve(pts){
        this.curve = new CatmullRomCurve3(pts);
        this.tube.geometry.dispose();
        this.tube.geometry = new TubeGeometry(this.curve, this.res, this.radius,8);

        let startPt = this.curve.getPoint(0);
        this.start.position.set(startPt.x, startPt.y, startPt.z);
        let endPt = this.curve.getPoint(1);
        this.end.position.set(endPt.x, endPt.y, endPt.z);
    }

    setColor(color){
        this.material.color = color;
    }

    addToScene(scene){
        scene.add(this.tube);
        scene.add(this.start);
        scene.add(this.end);
    }
}


export default NumericalCurve;
