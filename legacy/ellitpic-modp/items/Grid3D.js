import {
    CatmullRomCurve3,
    Mesh,
    MeshPhysicalMaterial,
    TubeGeometry,
    Vector3,
    LineCurve3,
    SphereGeometry,
    Group
} from "three";

import{ colors,makeMaterial} from "./utils";


let toVec3 = function(p){
    return new Vector3(p[0],p[1],p[2]);
}


class Grid3D{
    constructor(scale=1) {
        this.scale = scale;
    }

    getVertex(pos,color=colors.red, radius=0.15, glass=false){
        //pos is something like [i,j,k];
        const p = toVec3(pos).multiplyScalar(this.scale);
        let geom = new SphereGeometry(radius);
        let mesh = new Mesh(geom, makeMaterial(color,glass));
        mesh.position.set(p.x,p.y,p.z);
        return mesh;
    }

    getRod(start, end, color=colors.blue, radius=0.025, glass=false){
        //start end are [i,j,k]
        const p = toVec3(start).multiplyScalar(this.scale);
        const q = toVec3(end).multiplyScalar(this.scale);
        const line = new LineCurve3(p,q);
        const geom = new TubeGeometry(line,64,radius,8,false);
        const mesh = new Mesh(geom, makeMaterial(color,glass));
        return mesh;
    }

    getBentRod(start,end,bendingDir,color=colors.blue,radius=0.02, glass=false){
        //start and end are [i,j,k]
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


    getGridLines(n,color=colors.glass, radius=0.02,glass=true,overhang = 0.5){
        //n gridlines in each direction
        let grid = new Group();

        //overhang is a percentage of spacing:
        let over = overhang*this.scale;

        for(let i = -n; i<n+1; i++) {
            for (let j = -n; j < n + 1; j++) {
                //x gridline
                grid.add(this.getRod([-n - over, i, j], [n + over, i, j],color,radius,glass));
                //y gridline
                grid.add(this.getRod([i, -n - over, j], [i, n + over,j],color,radius,glass));
                //z gridline
                grid.add(this.getRod([i,j, -n - over], [i,j, n + over],color,radius,glass));
            }
        }
        return grid;
    }

    getGridVertices(n,color=colors.glass, radius=0.05, glass=true){
        //nxn spread of vertices
        let sphGeom = new SphereGeometry(radius);
        let sphMesh = new Mesh(sphGeom, makeMaterial(color,glass));
        let vertices = new Group();
        for(let i=-n;i<n+1;i++){
            for(let j=-n;j<n;j++){
                for(let k=-n;k<n+1;k++) {
                    let mesh = sphMesh.clone();
                    let p = toVec3([i,j,k]).multiplyScalar(this.scale);
                    mesh.position.set(p.x,p.y,p.z);
                    vertices.add(mesh);
                }
            }
        }
        return vertices;
    }

    getCurve(fn,color=colors.blue,radius=0.025, glass=false){
            let pts = [];
            for(let i=0; i<64; i++){
                let t = i/63;
                pts.push(fn(t).multiplyScalar(this.scale));
            }
            let path = new CatmullRomCurve3(pts);
            let curveGeom = new TubeGeometry(path,64,radius);
            return new Mesh(curveGeom, makeMaterial(color,glass));
    }

}


export default Grid3D;
