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

import { createPathTracerControls } from '../../items/pathTracerControls.js';
import { showLoading, hideLoading, updateProgress } from '../../items/loadingScreen.js';



// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();

const tau4 = new Vector3(0,1);
const tau8 = new Vector3(0, Math.sqrt(2));
const tau3 = new Vector3(-1, Math.sqrt(3)).divideScalar(2);
const tau7 = new Vector3(-1, Math.sqrt(7)).divideScalar(2);
const tau11 = new Vector3(-1, Math.sqrt(11)).divideScalar(2);



// SLOW STUFF - only the points loading
async function loadPoints() {
    showLoading("Loading geometry...", true);
    await new Promise(resolve => setTimeout(resolve, 50));


        let fd4 = new FD(tau4);
        let g4 = new Group();
        scene.add(g4);
        g4.add(fd4.getParallelogram(colors.red));
        let grid4 = fd4.getGridlines(5,colors.red,0.01,false);
        grid4.position.set(0,-0.01,0);
        g4.add(grid4);
        g4.position.set(3,0,-1.5);

        let fd8 = new FD(tau8,1/Math.pow(2,0.25));
        let g8 = new Group();
        scene.add(g8);
        g8.add(fd8.getParallelogram(colors.yellow));
        let grid8 = fd8.getGridlines(5,colors.yellow,0.01,false);
        grid8.position.set(0,-0.01,0);
        g8.add(grid8);
        g8.position.set(1.5,0,-1.5);


        let fd3 = new FD(tau3,1.1);
        let g3 = new Group();
        scene.add(g3);
        let para3 = new Group();
        g3.add(para3);
        para3.add(fd3.getParallelogram(colors.green));

        let grid3 = fd3.getGridlines(5,colors.green,0.01,false);
        grid3.position.set(0,-0.01,0);
        para3.add(grid3);
        para3.position.set(-0.4,0,0);
        g3.position.set(0,0,-1.5);


        let fd7 = new FD(tau7,0.9);
        let g7 = new Group();
        scene.add(g7);
        let para7 = new Group();
        g7.add(para7);
        para7.add(fd7.getParallelogram(colors.blue));
        let grid7 = fd7.getGridlines(5,colors.blue,0.01,false);
        para7.add(grid7);
        grid7.position.set(0,-0.01,0);
        para7.position.set(-0.1,0,0)
        g7.position.set(-1.5,0,-1.5);


        let fd11 = new FD(tau11,0.77);
        let g11 = new Group();
        scene.add(g11);
        g11.add(fd11.getParallelogram(colors.purple));
        let grid11 = fd11.getGridlines(5,colors.purple,0.01,false);
        grid11.position.set(0,-0.01,0);
        g11.add(grid11);
        g11.position.set(-3,0,-1.5);





        //ADD THE TORI!!!


        let hopf4 = new HopfPreimage(coordCurve4);
        let torus4 = hopf4.getPreimageCurve(colors.red);
        torus4.scale.set(0.27,0.27,0.27);
        torus4.position.set(0.6,0,2);
        g4.add(torus4);


        let hopf8 = new HopfPreimage(coordCurve8);
        let torus8 = hopf8.getPreimageCurve(colors.yellow);
        torus8.scale.set(0.34,0.34,0.34);
        torus8.position.set(0.5,0,2);
        g8.add(torus8);



        let hopf3 = new HopfPreimage(coordCurve3);
        let torus3 = hopf3.getPreimageCurve(colors.green);
        torus3.scale.set(0.2,0.2,0.2);
        torus3.position.set(0.25,0,2);
        g3.add(torus3);




        let hopf7 = new HopfPreimage(coordCurve7);
        let torus7 = hopf7.getPreimageCurve(colors.blue);
        torus7.scale.set(0.2,0.2,0.2);
        torus7.position.set(0,0,2);
        g7.add(torus7);



        let hopf11 = new HopfPreimage(coordCurve11);
        let torus11 = hopf11.getPreimageCurve(colors.purple);
        torus11.scale.set(0.2,0.2,0.2);
        torus11.position.set(0,0,2);
        g11.add(torus11);



    hideLoading();
}




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
const camera = new PerspectiveCamera();
camera.position.set( 0, 7, -0.1 );
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

//
// const gui = new GUI().close();
// let params = {
//     saveit: ()=>saveImage(renderer.domElement),
// };
// gui.add( params, 'saveit' );



//controls
//--------------------------------------------
let controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 3, - 0.08 );
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



// START EVERYTHING - this replaces your old onResize(); animate(); at the bottom
loadPoints().then(() => {
    onResize();
    animate();
});
