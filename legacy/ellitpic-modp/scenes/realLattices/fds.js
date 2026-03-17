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
    Vector3, Group, SphereGeometry, FloatType, DoubleSide, LineCurve3,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import FD from "../../items/FD";
import {colors, makeMaterial} from "../../items/utils";

// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();




const tau4 = new Vector3(0,1);
let fd4 = new FD(tau4);
let g4 = new Group();
scene.add(g4);
g4.add(fd4.getParallelogram(0xe38686));
let grid4 = fd4.getGridlines(5,colors.red,0.01,false);
grid4.position.set(0,0.01,0);
g4.add(grid4);
g4.position.set(3,0,0);


const tau3 = new Vector3(-1, Math.sqrt(3)).divideScalar(2);
let fd3 = new FD(tau3,1.);
let g3 = new Group();
scene.add(g3);
g3.add(fd3.getParallelogram(0xa4e89e,false));
let grid3 = fd3.getGridlines(5,colors.green,0.01,false);
grid3.position.set(0,0.01,0);
g3.add(grid3);
g3.rotateY(2.1);
g3.position.set(1.5,0,1.4);




// let fd3 = new FD(tau3,1.1);
// let g3 = new Group();
// scene.add(g3);
// g3.add(fd3.getParallelogram(0xa4e89e,false));
// let grid3 = fd3.getGridlines(5,colors.green,0.01,false);
// grid3.position.set(0,0.01,0);
// g3.add(grid3);
//
//
// const tau3R = new Vector3(1, Math.sqrt(3)).divideScalar(2);
// let fd3R = new FD(tau3R,1.1);
// let g3R = new Group();
// scene.add(g3R);
// g3R.add(fd3R.getParallelogram(0xa4e89e,true));
// let grid3R = fd3R.getGridlines(5,colors.green,0.01,false);
// grid3R.position.set(0,0.01,0);
// g3R.add(grid3R);
// g3R.position.set(0.5,0.13,0);





const tau7 = new Vector3(-1, Math.sqrt(7)).divideScalar(2);
let fd7 = new FD(tau7,1.1);
let g7 = new Group();
scene.add(g7);
g7.add(fd7.getParallelogram(0x81acf0));
let grid7 = fd7.getGridlines(5,colors.blue,0.01,false);
grid7.position.set(0,0.01,0);
g7.add(grid7);
g7.position.set(-1.45,0,-0.1);



const tau7R = new Vector3(1, Math.sqrt(7)).divideScalar(2);
let fd7R = new FD(tau7R,1.1);
let g7R = new Group();
scene.add(g7R);
g7R.add(fd7R.getParallelogram(0x81acf0));
let grid7R = fd7R.getGridlines(5,colors.blue,0.01,false);
grid7R.position.set(0,0.01,0);
g7R.add(grid7R);
g7R.position.set(-1.,-.2,-0.1);







let fd71 = new FD(tau7,1.1);
let g71 = new Group();
scene.add(g71);
g71.add(fd71.getParallelogram(0x81acf0));
let grid71 = fd71.getGridlines(5,colors.blue,0.01,false);
grid71.position.set(0,0.01,0);
g71.add(grid71);
g71.rotateY(-1.2);
g71.position.set(-2.65,0,-0.4);



let fd7R1 = new FD(tau7R,1.1);
let g7R1 = new Group();
scene.add(g7R1);
g7R1.add(fd7R1.getParallelogram(0x81acf0));
let grid7R1 = fd7R1.getGridlines(5,colors.blue,0.01,false);
grid7R1.position.set(0,0.01,0);
g7R1.add(grid7R1);
g7R1.rotateY(1.2);
g7R1.position.set(-3.62,-.2,0.5);


//add a reflection line

let start = new Vector3(-10,-0.25,0.5);
let end = new Vector3(10,-0.25,0.5);
let lineGeom = new TubeGeometry(new LineCurve3(start,end),64,0.05);
let lineMat = makeMaterial(colors.glass,true);
let lineMesh = new Mesh(lineGeom,lineMat);
scene.add(lineMesh);


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
const camera = new PerspectiveCamera(25);
camera.position.set( 0, 15, -0.1 );
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

