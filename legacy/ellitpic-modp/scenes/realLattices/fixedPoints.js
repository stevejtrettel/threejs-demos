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
let grid4 = fd4.getGridlines(1,0xe38686,0.01,false);
grid4.position.set(0,0.01,0);
g4.add(grid4);
g4.position.set(3,0,0);
//fixed edges
let fixed1 = fd4.getHorizontalAt(0.5,colors.red);
g4.add(fixed1);
let fixed2 = fd4.getHorizontalAt(0,colors.red);
g4.add(fixed2);
let fixed3 = fd4.getHorizontalAt(1,colors.red);
g4.add(fixed3);
//vertices
g4.add(fd4.getPoint({x:0,y:0},0x9c2828,0.04));
g4.add(fd4.getPoint({x:1,y:0},0x9c2828,0.04));
g4.add(fd4.getPoint({x:0,y:1},0x9c2828,0.04));
g4.add(fd4.getPoint({x:1,y:1},0x9c2828,0.04));

const tau3 = new Vector3(-1, Math.sqrt(3)).divideScalar(2);
let fd3 = new FD(tau3,1);
let g3 = new Group();
scene.add(g3);
g3.add(fd3.getParallelogram(0x7ebd79,false));
let grid3 = fd3.getGridlines(1,0x7ebd79,0.01,false);
grid3.position.set(0,0.01,0);
g3.add(grid3);
g3.rotateY(2.1);
g3.position.set(1.5,0,1.4);

//add fixed line for the parallelogram
//need to make it custom (its not a gridline)
let lineMat = makeMaterial(0x3a8c32);
let lineStart = new Vector3(-0.53,0,0);
let lineEnd = new Vector3(0.53,0,0);
let lineGeom = new TubeGeometry(new LineCurve3(lineStart, lineEnd),64,0.025)
let fixed4 = new Mesh(lineGeom,lineMat);
fixed4.position.set(1.5,0,0.46);
scene.add(fixed4);


//vertices
g3.add(fd3.getPoint({x:0,y:0},0x2e7028,0.04));
g3.add(fd3.getPoint({x:1.08,y:0},0x2e7028,0.04));
g3.add(fd3.getPoint({x:1.08*0.5,y:1.08*Math.sqrt(3)/2},0x2e7028,0.04));
g3.add(fd3.getPoint({x:1.08*1.5,y:1.08*Math.sqrt(3)/2},0x2e7028,0.04));

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

