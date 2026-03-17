import {DoubleSide, MeshPhysicalMaterial, Vector3, Vector4 ,Color} from "three";


let toroidalCoords = function(a,b,c){
    let x = Math.cos(a)*Math.sin(c);
    let y = Math.sin(a)*Math.sin(c);
    let z = Math.cos(b)*Math.cos(c);
    let w = Math.sin(b)*Math.cos(c);
    //rotate (x,z,-y)
    return new Vector4(x,z,-y,w);
}

// //ORIG STEREO
// let stereoProj = function(pt){
//     return new Vector3(pt.x,pt.y,pt.w).divideScalar(1.-pt.z);
// }

//alt axix
let stereoProj = function(pt){
    return new Vector3(pt.y,-pt.x,pt.w).divideScalar(1.-pt.z);
}




let sphCoords = function(angles){
    let phi = angles.phi;
    let theta = angles.theta;

    let x = Math.cos(theta)*Math.sin(phi);
    let y = Math.sin(theta)*Math.sin(phi);
    let z = Math.cos(phi);

    return new Vector3(x,y,z);
}




let makeMaterial = function(color=glassColor, glass=false){
    let props = {
        color:color,
        clearcoat:1,
        roughness:0.1,
        metalness:0.8,
    }
    if(glass){
        props.transparent=true;
        props.opacity=1;
        props.transmission=0.99;
        props.ior=1.05;
        props.thickness=0.01;
    }
    return new MeshPhysicalMaterial(props);
}



let colors = {
    red: 0xd43b3b,
    orange:0xc25b2b,
    yellow:0xe8ac2a,
    green: 0x43a33b,//0x4fbf45,
    blue: 0x4287f5,
    purple: 0x7d46bd,
    pink: 0xcf48bf,
    glass:0xc9eaff
}



let redShades = {
    light: 0xed5858,
    medium: 0xd43b3b,
    dark: 0x991212,
};


let yellowShades = {
    medium : 0xe8ac2a,
    dark:0xcc8d04,
}


let greenShades = {
    dark: 0x0f4709,
    medium: 0x43a33b,
    light: 0x43a33b,
}

let blueShades = {
    dark: 0xf3c85,
    medium: 0x3478e3,
    light:0x5d9bfc,
}


let purpleShades = {
    medium: 0x7d46bd,
}


let getPastelColor = function(x){
    //x is in [0,1]
    let hue = x;
    let sat = 0.5;
    let light = 0.1;
    return new Color().setHSL(hue,sat,light);
}



export{
    stereoProj,
    toroidalCoords,
    sphCoords,
    makeMaterial,
    colors,
    redShades,
    blueShades,
    greenShades,
    yellowShades,
    getPastelColor,
}

