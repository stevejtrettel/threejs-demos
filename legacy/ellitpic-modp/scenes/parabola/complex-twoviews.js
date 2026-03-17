import {
    WebGLRenderer,
    ACESFilmicToneMapping,
    PerspectiveCamera,
    Color,
    Scene,
    Mesh,
    MeshPhysicalMaterial,
    Vector2,
    BoxGeometry, TorusKnotGeometry,
    TorusGeometry, TubeGeometry, CylinderGeometry,
    Vector3, Group, SphereGeometry, FloatType, DoubleSide, CatmullRomCurve3, LineCurve3,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";


import {colors, makeMaterial} from "../../items/utils";
import ParametricGeometry from "../../items/ParametricGeometry";



// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();


let parabola1 = new Group();
let parabola2 = new Group();

let mat = makeMaterial(colors.blue);
mat.side = DoubleSide;
let range = 2;


let squaring = function(r,t){
    //takes in polar but returns cartesian
    let r2= r*r;
    let c = Math.cos(2*t);
    let s = Math.sin(2*t);
    return new Vector2(r2*c,r2*s);
}




//BUILDING THE FIRST PARABOLA
let param1 = function(r,t){
    //project off one of the INPUTS
    let x = r*Math.cos(t);
    let sq = squaring(r,t);
    let y = sq.x;
    let z = sq.y;
    return new Vector3(z,x,y);
}


let surfParam1 = function(u,v,dest){
    let r = range*u;
    let t = 2*Math.PI*v;
    let res = param1(r,t);
    dest.set(res.x,res.y,res.z);
}


function makeRCurve1(t,color,radius){
    let mat = makeMaterial(color);
    let pts = [];
    let N = 50;
    for(let i=0;i<N+1; i++){
        let r = range*i/N;
        pts.push(param1(r,t));
    }
    let path = new CatmullRomCurve3(pts);
    let curveGeom = new TubeGeometry(path,128,radius);
    return new Mesh(curveGeom,mat);
}

function makeTCurve1(r,color,radius){
    let mat = makeMaterial(color);
    let pts = [];
    let N = 50;
    for(let i=0;i<N; i++){
        let t = 2*Math.PI*i/N;
        pts.push(param1(r,t));
    }
    let path = new CatmullRomCurve3(pts);
    let curveGeom = new TubeGeometry(path,256,radius,8,true);
    return new Mesh(curveGeom,mat);
}













//BUILDING THE SECOND PARABOLA
let param2 = function(r,t){
    //project off one of the OUTPUTS
    let x = r*Math.cos(t);
    let y = r*Math.sin(t)
    let sq = squaring(r,t);
    let z = sq.x;
    return new Vector3(x,z,y);
}


let surfParam2 = function(u,v,dest){
    let r = range*u;
    let t = 2*Math.PI*v;
    let res = param2(r,t);
    dest.set(res.x,res.y,res.z);
}




function makeRCurve2(t,color,radius){
    let mat = makeMaterial(color);
    let pts = [];
    let N = 50;
    for(let i=0;i<N+1; i++){
        let r = range*i/N;
        pts.push(param2(r,t));
    }
    let path = new CatmullRomCurve3(pts);
    let curveGeom = new TubeGeometry(path,128,radius);
    return new Mesh(curveGeom,mat);
}

function makeTCurve2(r,color,radius){
    let mat = makeMaterial(color);
    let pts = [];
    let N = 50;
    for(let i=0;i<N; i++){
        let t = 2*Math.PI*i/N;
        pts.push(param2(r,t));
    }
    let path = new CatmullRomCurve3(pts);
    let curveGeom = new TubeGeometry(path,256,radius,8,true);
    return new Mesh(curveGeom,mat);
}






//--------ACTUALLY ASSEMBLING THE PIECES

//---parabola 1
let surfGeom1 = new ParametricGeometry(surfParam1,50,100);
let surfMesh1 = new Mesh(surfGeom1, mat);
parabola1.add(surfMesh1);

//outer boundary
parabola1.add(makeTCurve1(range,0x356fcc,0.075));

//add some gridlines
for(let i=0; i<10; i++){
    let ri = range*i/10;
    parabola1.add(makeTCurve1(ri,0x356fcc,0.05));
}
for(let i=0; i<30; i++){
    let ti = 2*Math.PI *i/30;
    parabola1.add(makeRCurve1(ti,0x356fcc,0.05));
}

parabola1.position.set(4,3,-4);
scene.add(parabola1);

//---parabola 2

let surfGeom2 = new ParametricGeometry(surfParam2,50,100);
let surfMesh2 = new Mesh(surfGeom2, mat);
parabola2.add(surfMesh2);

//outer boundary
parabola2.add(makeTCurve2(range,0x356fcc,0.075));

//add some gridlines
for(let i=0; i<10; i++){
    let ri = range*i/10;
    parabola2.add(makeTCurve2(ri,0x356fcc,0.05));
}
for(let i=0; i<30; i++){
    let ti = 2*Math.PI *i/30;
    parabola2.add(makeRCurve2(ti,0x356fcc,0.05));
}

parabola2.position.set(-4,3,-4);
parabola2.rotateY(0.5);
scene.add(parabola2);





// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 10.0, -10 );
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 2.0;
spotLight.radius = 0.5;

// spot light shadow
spotLight.shadow.mapSize.width = 512;
spotLight.shadow.mapSize.height = 512;
spotLight.shadow.camera.near = 0.1;
spotLight.shadow.camera.far = 10.0;
spotLight.shadow.focus = 1.0;
spotLight.castShadow = true;
scene.add( spotLight );

// spot light target
const targetObject = spotLight.target;
targetObject.position.x = 1;
targetObject.position.y = 0;
targetObject.position.z = 1.05;
scene.add( targetObject );









const ground = new Mesh(
    new BoxGeometry( 100, 0.1, 100 ),
    new MeshPhysicalMaterial({
        color:0xffffff, clearcoat:1, roughness:0.5,metalness:0
    }),
);
ground.position.set(0.,-2,0);
scene.add(ground);

const backWall = new Mesh(
    new BoxGeometry( 100, 100, 0.1 ),
    new MeshPhysicalMaterial({
    }),
);
backWall.position.set(0,0,1);
scene.add(backWall);


// environment for the scene
//--------------------------------------------
// set the environment map
const texture = new GradientEquirectTexture();
texture.bottomColor.set( 0xffffff );
texture.bottomColor.set( 0x666666 );
texture.update();
scene.environment = texture;
scene.background = texture;


// camera
//--------------------------------------------
const camera = new PerspectiveCamera();
camera.position.set( 0, 10, -20 );
camera.lookAt( 0, 0, 0 );


// const camera = new PhysicalCamera( 60, window.innerWidth / window.innerHeight, 0.025, 500 );
// camera.position.set( - 0.262, 0.5276, - 1.1606 );
// camera.apertureBlades = 0;
// camera.fStop = 1.5;
// camera.focusDistance = 1.1878;
// let focusPoint = new Vector3();
// focusPoint.set( 0,0,-0.25 );



// set up the renderer
//--------------------------------------------
let renderer = new WebGLRenderer({
    preserveDrawingBuffer:true,
});
renderer.toneMapping = ACESFilmicToneMapping;
document.body.appendChild( renderer.domElement );



// set up the Path tracer
//--------------------------------------------
let pathTracer = new WebGLPathTracer( renderer );
pathTracer.setScene( scene, camera );

pathTracer.renderScale = Math.max( 1 / window.devicePixelRatio, 0.5 );;
pathTracer.tiles.setScalar( 3 );
pathTracer.bounces = 30.;



// SCREENSHOTS
//---------------------------------------------------

function saveImage(canvas){
    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let hour = date.getHours();
    let minute = date.getMinutes();

    let link = document.createElement('a');
    link.download = `pathtrace ${month}-${day}-${hour}${minute}`+'.png';
    link.href = canvas.toDataURL("image/png");
    //.replace("image/png", "image/octet-stream");
    link.click();
}


const gui = new GUI().close();
let params = {
    saveit: ()=>saveImage(renderer.domElement),
};
gui.add( params, 'saveit' );



//controls
//--------------------------------------------
let controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.33, - 0.08 );
controls.addEventListener( 'change', () => pathTracer.updateCamera() );
controls.update();
// controls.addEventListener( 'change', () => {
//     camera.focusDistance = camera.position.distanceTo( focusPoint ) - camera.near;
//     pathTracer.updateCamera();
// } );




//animate loop
//--------------------------------------------


onResize();

animate();

window.addEventListener( 'resize', onResize );

function animate() {

    // if the camera position changes call "ptRenderer.reset()"
    requestAnimationFrame( animate );

    // update the camera and render one sample
    pathTracer.renderSample();

}

function onResize() {

    // update rendering resolution
    const w = window.innerWidth;
    const h = window.innerHeight;

    renderer.setSize( w, h );
    renderer.setPixelRatio( window.devicePixelRatio );

    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    pathTracer.setScene( scene, camera );

}

