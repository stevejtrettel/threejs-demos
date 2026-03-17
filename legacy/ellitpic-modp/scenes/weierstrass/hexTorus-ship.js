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
    Vector3, Group, SphereGeometry, FloatType, DoubleSide,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";


import {colors, makeMaterial} from "../../items/utils";

import NumericalSurfaceGeometry from "../../items/NumericalSurfaceGeometry";
import NumericalTubeGeometry from "../../items/NumericalTubeGeometry";

import boundaryPts from "./0_1/boundaryPts";
import surfacePts from "./0_1/surfacePts";
// import {realPts1,realPts2} from "./3_0/realPts";
import realPts from "./0_1/realPts";


import { createPathTracerControls } from '../../items/pathTracerControls.js';
import { showLoading, hideLoading, updateProgress } from '../../items/loadingScreen.js';




// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();


let eCurve = new Group();



let mat = makeMaterial(0x2b6e25,false);
mat.side = DoubleSide;

let geom = new NumericalSurfaceGeometry(surfacePts);
let surf = new Mesh(geom,mat);
eCurve.add(surf);




let bdyMat = makeMaterial(colors.green,false);
let bdyGeom = new NumericalTubeGeometry(boundaryPts,0.05,true,256);
let bdy = new Mesh(bdyGeom,bdyMat);
eCurve.add(bdy);



//
// let realMat = makeMaterial(colors.green);
// let realGeom = new NumericalTubeGeometry(realPts,0.085,false,256);
// let real = new Mesh(realGeom,realMat);
// eCurve.add(real);

//
// let realGeom2 = new NumericalTubeGeometry(realPts2,0.075,true,256);
// let real2 = new Mesh(realGeom2,realMat);
// eCurve.add(real2);
//




let realMat = makeMaterial(0xd6be38);
let realGeom = new NumericalTubeGeometry(realPts,0.085,false,256);
let real = new Mesh(realGeom,realMat);
eCurve.add(real);

//spheres on the end
let sphGeom = new SphereGeometry(0.15);
let startPt = new Mesh(sphGeom, realMat);
let endPt = startPt.clone();

startPt.position.set(1.19, 0., 2.97 );
endPt.position.set(1.19, 0., -2.97 );

eCurve.add(startPt);
eCurve.add(endPt);



 eCurve.rotateX(Math.PI/2);
//eCurve.rotateZ(-Math.PI/2);
eCurve.position.set(0,2.5,0);
scene.add(eCurve);







// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 15.0, -10 );
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
ground.position.set(0.,-1,0);
scene.add(ground);

const backWall = new Mesh(
    new BoxGeometry( 100, 100, 0.1 ),
    new MeshPhysicalMaterial({
    }),
);
backWall.position.set(0,0,5);
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
camera.position.set( 0, 5, -12 );
camera.lookAt( 0, 2, 0 );


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

createPathTracerControls(pathTracer, renderer);



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


// const gui = new GUI().close();
// let params = {
//     saveit: ()=>saveImage(renderer.domElement),
// };
// gui.add( params, 'saveit' );
//


//controls
//--------------------------------------------
let controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 2, - 0.08 );
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

