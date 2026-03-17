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

import {colors} from "../../../../items/utils";
import HopfTorus from "../../../../items/HopfTorus";
import {coordCurve,latticeData} from "/data/-4/tau";
import data from "/data/-4/2"


// init scene and objects, and lights
//--------------------------------------------


const glassColor =0xc9eaff;
const redColor = 0xd43b3b;//0xe03d24
const greenColor = 0x4fbf45;
const blueColor = 0x4287f5;
const yellowColor = 0xffd738;



const scene = new Scene();


// the computer for dealing with the hopf torus
let torus = new HopfTorus(coordCurve,latticeData);


//drawing the torus surface in R3
let surf = torus.getSurface(0xffffff, true);
scene.add(surf);


//drawing points over finite field:
let points = new Group();
scene.add(points);


//points of hte group
for(let i=0; i<data.length;i++){
    let pt = torus.fromTauCoords(data[i]);
    points.add(torus.getPoint(pt,colors.red));
}


//ADD EDGES!!!!

//for the subgroup
let subCurve = function(t){
    //get new initial direction: in unit square is 0.3, 0.1
    let dir = torus.fromTauCoords([0.3,0.1]);
    return dir.multiplyScalar(10*t);
}
scene.add(torus.getLift(subCurve,colors.blue,0.02,false));


//for the coset
let cosCurve = function(t){
    //get new initial direction: in unit square is 0.3, 0.1
    let dir = torus.fromTauCoords([0.3,0.1]);
    dir.multiplyScalar(10*t);
    let offset = torus.fromTauCoords([0.,0.5]);
    return dir.add(offset);
}

//slightly darker blue
scene.add(torus.getLift(cosCurve,0x2866c9,0.02,false));




//for the edges in-between
let tracks = new Group();
scene.add(tracks);

for(let i=0; i<10; i++){

    let start = torus.fromTauCoords([0.3,0.1]);
    start.multiplyScalar(i);
    let offset = torus.fromTauCoords([0.5,0.]);
    let curve = function(t){
        return start.clone().add(offset.clone().multiplyScalar(t));
    }
    tracks.add(torus.getLift(curve,colors.yellow,0.02,false));
}


//
// // area light for the scene:
// let areaLight = new ShapedAreaLight( new Color( 0xffffff ), 5.0, 1.0, 1.0 );
// areaLight.position.x = 1.5;
// areaLight.position.y = 1.0;
// areaLight.position.z = - 0.5;
// areaLight.rotateZ( - Math.PI / 4 );
// areaLight.rotateX( - Math.PI / 2 );
// areaLight.isCircular = false;
// scene.add( areaLight );
//
// let redLight = new ShapedAreaLight( new Color( 0xff0000 ), 15.0, 3.25, 3.75 );
// redLight.position.y = 1.25;
// redLight.position.z = - 3.5;
// redLight.rotateX( Math.PI );
// redLight.isCircular = false;
// scene.add( redLight );



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
ground.position.set(-1.,-4,-1);
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
camera.position.set( 1, 2.2, - 5 );
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

