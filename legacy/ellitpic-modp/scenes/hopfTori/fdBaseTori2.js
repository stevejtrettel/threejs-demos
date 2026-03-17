import {
    WebGLRenderer,
    ACESFilmicToneMapping,
    PerspectiveCamera,
    Scene,
    Mesh,
    MeshPhysicalMaterial,
    BoxGeometry,
    Vector3,
    Group,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import FD from "../../items/FD";
import HopfPreimage from "../../items/HopfPreimage";
import {colors} from "../../items/utils";

import {coordCurve as coordCurve3 } from "../../../data/-3/tau";
import {coordCurve as coordCurve4 } from "../../../data/-4/tau";
import {coordCurve as coordCurve7 } from "../../../data/-7/tau";
import {coordCurve as coordCurve8 } from "../../../data/-8/tau";
import {coordCurve as coordCurve11 } from "../../../data/-11/tau";




// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();

const tau4 = new Vector3(0,1);
const tau8 = new Vector3(0, Math.sqrt(2));
const tau3 = new Vector3(-1, Math.sqrt(3)).divideScalar(2);
const tau7 = new Vector3(-1, Math.sqrt(7)).divideScalar(2);
const tau11 = new Vector3(-1, Math.sqrt(11)).divideScalar(2);



// Make Tori

let makeTorus = function(curve,color,scale,xoffset){
    let grp = new Group();
    let hopf = new HopfPreimage(curve);
    let torus = hopf.getPreimageCurve(color);
    torus.rotateX(Math.PI/2);
    torus.scale.set(scale,scale,scale);
    torus.position.set(0,1.25,0);
    grp.add(torus);
    let base = hopf.getCurveOnBase(color);
    base.position.set(0,0,0);
    base.scale.set(0.8,0.8,0.8);
    grp.add(base);
    grp.position.set(xoffset,0,0);
    return grp;
}


// Make fundamental domains

let makeFD = function(tau, color, xoffset){
    let grp = new Group();
    let fd = new FD(tau,0.5);
    grp.add(fd.getParallelogram(color,false));
    let grid = fd.getGridlines(5,color,0.01,false);
    grid.position.set(0,0.01,0);
    grp.add(grid);
    grp.rotateX(-Math.PI/2);
    grp.position.set(xoffset-0.2,2.25,0.);
    return grp;
}


let disc4 = makeTorus(coordCurve4,colors.red,0.27,4);
let fd4 = makeFD(tau4,colors.red,-0.25);
disc4.add(fd4);
scene.add(disc4);

let disc8 = makeTorus(coordCurve8,colors.yellow,0.34,2);
let fd8 = makeFD(tau8,colors.yellow,-0.15);
fd8.position.y-=0.05;
disc8.add(fd8);
scene.add(disc8);

let disc3 = makeTorus(coordCurve3,colors.green,0.2,0.);
let fd3 = makeFD(tau3,colors.green,-0.23);
disc3.add(fd3);
scene.add(disc3);

let disc7 = makeTorus(coordCurve7,colors.blue,0.2,-2);
let fd7 =makeFD(tau7,colors.blue,-0.05);
fd7.position.y-=0.05;
disc7.add(fd7);
scene.add(disc7);

let disc11 = makeTorus(coordCurve11,colors.purple,0.2,-4);
let fd11 = makeFD(tau11,colors.purple,-0.05);
fd11.position.y-=0.075;
disc11.add(fd11);
scene.add(disc11);





// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 6.0, -2 );
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
ground.position.set(0.,-3,0);
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
camera.position.set( 0,2,-10 );
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

