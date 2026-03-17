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

import {colors} from "/js/items/utils";
import FD from "/js/items/FD";
import {coordCurve,latticeData} from "/data/-11/tau";
import data from "/data/-11/4"



const scene = new Scene();

let fd = new FD(latticeData.tau,5);

let domain = new Group();
domain.add(fd.getParallelogram());
domain.add(fd.getGridlines(1,colors.glass,0.015,true));
domain.position.set(0,-0.05,0);
scene.add(domain);

//drawing points over finite field:
let points = new Group();
scene.add(points);
for(let i=0; i<data.length;i++){
    points.add(fd.getDataPoint(data[i]));
}




//draw the group orbit:
//
// //the original group
// let orbit = new Group();
// scene.add(orbit);
// orbit.add(fd.getLine([0,0],[1,1/3],colors.blue,0.02));
// orbit.add(fd.getLine([0,1/3],[1,2/3],colors.blue,0.02));
// orbit.add(fd.getLine([0,2/3],[1,1],colors.blue,0.02));
//
//
// //the coset
// let orbit2 = new Group();
// scene.add(orbit2);
// orbit2.add( fd.getLine([0,1/6],[1,1/2],0x2866c9,0.02));
// orbit2.add(fd.getLine([0,1/2],[1,5/6],0x2866c9,0.02));
// orbit2.add(fd.getLine([0,5/6],[1/2,1],0x2866c9,0.02));
// orbit2.add(fd.getLine([1/2,0],[1,1/6],0x2866c9,0.02));
//
// //all the edges!
// //these come from adding (1/2,0) to each point!!!
// //here are the points of the orig group (each connected to a pt of coset)
// //    [0,0],
// //     [0.1, 0.7],
// //     [0.2, 0.4],
// //     [ 0.3, 0.1],
// //     [0.4, 0.8],
// //     [ 0.5, 0.5],
// //     [0.6, 0.2],
// //     [ 0.7, 0.9],
// //     [0.8, 0.6],
// //     [ 0.9, 0.3]
//
//
// let tracks = new Group();
// scene.add(tracks);
// tracks.add(fd.getLine([0,0],[0.5,0],colors.yellow,0.02));
// tracks.add(fd.getLine([0.1,0.7],[0.6,0.7],colors.yellow,0.02));
// tracks.add(fd.getLine([0.2,0.4],[0.7,0.4],colors.yellow,0.02));
// tracks.add(fd.getLine([0.3,0.1],[0.8,0.1],colors.yellow,0.02));
// tracks.add(fd.getLine([0.4,0.8],[0.9,0.8],colors.yellow,0.02));
// tracks.add(fd.getLine([0.5,0.5],[1,0.5],colors.yellow,0.02));
//
// //some of the remaining need two pieces
// tracks.add(fd.getLine([0.6,0.2],[1,0.2],colors.yellow,0.02));
// tracks.add(fd.getLine([0,0.2],[0.1,0.2],colors.yellow,0.02));
//
// tracks.add(fd.getLine([0.7,0.9],[1,0.9],colors.yellow,0.02));
// tracks.add(fd.getLine([0,0.9],[0.2,0.9],colors.yellow,0.02));
//
// tracks.add(fd.getLine([0.8,0.6],[1,0.6],colors.yellow,0.02));
// tracks.add(fd.getLine([0,0.6],[0.3,0.6],colors.yellow,0.02));
//
// tracks.add(fd.getLine([0.9,0.3],[1,0.3],colors.yellow,0.02));
// tracks.add(fd.getLine([0,0.3],[0.4,0.3],colors.yellow,0.02));
//
//









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
ground.position.set(-1.,-1,-1);
scene.add(ground);

const backWall = new Mesh(
    new BoxGeometry( 100, 100, 0.1 ),
    new MeshPhysicalMaterial({
    }),
);
backWall.position.set(0,4,10);
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
camera.position.set( 0,3,-1);
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

