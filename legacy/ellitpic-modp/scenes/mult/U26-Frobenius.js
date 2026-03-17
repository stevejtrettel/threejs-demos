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
    Vector3, Group, SphereGeometry, FloatType, DoubleSide, CatmullRomCurve3,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import Circle from "../../items/Circle";
import {colors} from "../../items/utils";

// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();

//color scheme
const glassColor =0xc9eaff;
const redColor = 0xd43b3b;//0xe03d24
const greenColor = 0x4fbf45;
const blueColor = 0x4287f5;
const yellowColor = 0xffd738;

let circle = new Circle(1.25);

//the background additive structure
let u1 = circle.getCircle(colors.glass,0.02);
u1.position.set(0,-0.25,0);
scene.add(u1);



//the nonzero points of the variety
let points = new Group();
scene.add(points);
for(let i=0; i<26; i++){
    let ang = i * 2*Math.PI/26;
    points.add(circle.getVertex(ang,colors.red,0.1));
}


//FROBENIUS
//the map x->x3 has two fixed points and eight 3-cycles
//the 3-cycles come in pairs (one and its negative)





//will be useful to convert modular arithmetic to angles
function toAng(i){
    return 2*Math.PI/26*i;
}

let frob = new Group();
scene.add(frob);

//path for the fixed point 1
let f1 = function(s){
    let t = 2*Math.PI*s;
    return new Vector3(1.05+0.15*Math.sin(t),0,0.15*Math.cos(t))
}
let fix1 = circle.getCurve(f1,colors.green,0.02);
frob.add(fix1);

//path for the fixed point -1
let f2 = function(s){
    let t = 2*Math.PI*s;
    return new Vector3(-1.05+0.15*Math.sin(t),0,0.15*Math.cos(t));
}
let fix2 = circle.getCurve(f2,colors.green,0.02);
frob.add(fix2);



//orbit 1
let o1 = [1,3,9];
frob.add(circle.getRod(toAng(o1[0]),toAng(o1[1]),colors.green));
frob.add(circle.getRod(toAng(o1[1]),toAng(o1[2]),colors.green));
frob.add(circle.getRod(toAng(o1[2]),toAng(o1[0]),colors.green));

//orbit 2
let o2 = [-1,-3,-9];
frob.add(circle.getRod(toAng(o2[0]),toAng(o2[1]),colors.green));
frob.add(circle.getRod(toAng(o2[1]),toAng(o2[2]),colors.green));
frob.add(circle.getRod(toAng(o2[2]),toAng(o2[0]),colors.green));

//orbit 3
let o3 = [2,6,18];
frob.add(circle.getRod(toAng(o3[0]),toAng(o3[1]),colors.green));
frob.add(circle.getRod(toAng(o3[1]),toAng(o3[2]),colors.green));
frob.add(circle.getRod(toAng(o3[2]),toAng(o3[0]),colors.green));

//orbit 4
let o4 = [-2,-6,-18];
frob.add(circle.getRod(toAng(o4[0]),toAng(o4[1]),colors.green));
frob.add(circle.getRod(toAng(o4[1]),toAng(o4[2]),colors.green));
frob.add(circle.getRod(toAng(o4[2]),toAng(o4[0]),colors.green));


//orbit 5
let o5 = [4,12,10];
frob.add(circle.getRod(toAng(o5[0]),toAng(o5[1]),colors.green));
frob.add(circle.getRod(toAng(o5[1]),toAng(o5[2]),colors.green));
frob.add(circle.getRod(toAng(o5[2]),toAng(o5[0]),colors.green));


//orbit 6
let o6 = [-4,-12,-10];
frob.add(circle.getRod(toAng(o6[0]),toAng(o6[1]),colors.green));
frob.add(circle.getRod(toAng(o6[1]),toAng(o6[2]),colors.green));
frob.add(circle.getRod(toAng(o6[2]),toAng(o6[0]),colors.green));

//orbit 7
let o7 = [5,15,19];
frob.add(circle.getRod(toAng(o7[0]),toAng(o7[1]),colors.green));
frob.add(circle.getRod(toAng(o7[1]),toAng(o7[2]),colors.green));
frob.add(circle.getRod(toAng(o7[2]),toAng(o7[0]),colors.green));

//orbit 8
let o8 = [-5,-15,-19];
frob.add(circle.getRod(toAng(o8[0]),toAng(o8[1]),colors.green));
frob.add(circle.getRod(toAng(o8[1]),toAng(o8[2]),colors.green));
frob.add(circle.getRod(toAng(o8[2]),toAng(o8[0]),colors.green));


//--------------------------------------------------------------
//-------------THE DEFAULT STUFF--------------------------------
//--------------------------------------------------------------


// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 6.0, 0 );
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
targetObject.position.z = 0.05;
scene.add( targetObject );









const ground = new Mesh(
    new BoxGeometry( 100, 0.1, 100 ),
    new MeshPhysicalMaterial({
        color:0xffffff, clearcoat:1, roughness:0.5,metalness:0
    }),
);
ground.position.set(0.,-0.5,0);
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
camera.position.set( 0,5,0 );
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

