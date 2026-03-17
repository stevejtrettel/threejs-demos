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
    Vector3, Group, SphereGeometry,FloatType,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import {colors,greenShades} from "../../../../items/utils";
import HopfTorus from "../../../../items/HopfTorus";
import {coordCurve,latticeData} from "/data/-3/tau";

import data4 from "/data/-3/3"

import { createPathTracerControls } from "../../../../items/PathTracerControls";


// init scene and objects, and lights
//--------------------------------------------


const scene = new Scene();


// the computer for dealing with the hopf torus
let torus = new HopfTorus(coordCurve,latticeData);


//drawing the torus surface in R3
let surf = torus.getSurface();
scene.add(surf);



// let points4 = new Group();
// scene.add(points4);
// for(let i=0; i<data4.length;i++){
//     let pt = torus.fromTauCoords(data4[i]);
//     points4.add(torus.getPoint(pt,greenShades.medium,0.025));
// }


import { showLoading, hideLoading, updateProgress, updateLoadingText } from '../../../../items/loadingScreen';

// SLOW STUFF - only the points loading
async function loadPoints() {
    showLoading("Loading geometry...", true);
    await new Promise(resolve => setTimeout(resolve, 50));

    let points4 = new Group();
    const CHUNK_SIZE = 200;

    for(let i = 0; i < data4.length; i++) {
        let pt = torus.fromTauCoords(data4[i]);
        points4.add(torus.getPoint(pt, greenShades.medium, 0.04));

        if (i % CHUNK_SIZE === 0) {
            updateProgress((i / data4.length) * 100);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    scene.add(points4);
    hideLoading();
}


// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 6.0, 0 );
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 5.0;
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
targetObject.position.z = 0.05;
scene.add( targetObject );









const ground = new Mesh(
    new BoxGeometry( 100, 0.1, 100 ),
    new MeshPhysicalMaterial({
        color:0xffffff, clearcoat:1, roughness:0.5,metalness:0
    }),
);
ground.position.set(-1.,-2,-1);
scene.add(ground);

// const backWall = new Mesh(
//     new BoxGeometry( 100, 100, 0.1 ),
//     new MeshPhysicalMaterial({
//     }),
// );
// backWall.position.set(0,4,31);
// scene.add(backWall);


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
camera.position.set( 0.1, 10, - 0.1 );
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
// let renderer = new WebGLRenderer({
//     preserveDrawingBuffer:true,
// });
// renderer.toneMapping = ACESFilmicToneMapping;
// document.body.appendChild( renderer.domElement );

let renderer = new WebGLRenderer({
    preserveDrawingBuffer:true,
});
renderer.toneMapping = ACESFilmicToneMapping;

// Target the #World div
const container = document.getElementById('World');
if (container) {
    container.appendChild( renderer.domElement );
} else {
    // Fallback to body if World doesn't exist
    document.body.appendChild( renderer.domElement );
}


// set up the Path tracer
//--------------------------------------------
let pathTracer = new WebGLPathTracer( renderer );
pathTracer.setScene( scene, camera );

pathTracer.renderScale = Math.max( 1 / window.devicePixelRatio, 0.5 );;
pathTracer.tiles.setScalar( 3 );
pathTracer.bounces = 30.;

createPathTracerControls(pathTracer,renderer);


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


window.addEventListener( 'resize', onResize );

function animate() {

    // if the camera position changes call "ptRenderer.reset()"
    requestAnimationFrame( animate );

    // update the camera and render one sample
    pathTracer.renderSample();

}

// function onResize() {
//
//     // update rendering resolution
//     const w = window.innerWidth;
//     const h = window.innerHeight;
//
//     renderer.setSize( w, h );
//     renderer.setPixelRatio( window.devicePixelRatio );
//
//     const aspect = w / h;
//     camera.aspect = aspect;
//     camera.updateProjectionMatrix();
//
//     pathTracer.setScene( scene, camera );
//
// }

function onResize() {
    const container = document.getElementById('World');
    const w = container ? container.clientWidth : window.innerWidth;
    const h = container ? container.clientHeight : window.innerHeight;

    renderer.setSize( w, h );
    renderer.setPixelRatio( window.devicePixelRatio );

    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    pathTracer.setScene( scene, camera );
}



// START EVERYTHING - this replaces your old onResize(); animate(); at the bottom
loadPoints().then(() => {
    onResize();
    animate();
});
