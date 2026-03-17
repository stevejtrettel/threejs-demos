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

import FD from "../../items/FD";
import {colors, makeMaterial} from "../../items/utils";

// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();


const scale = 0.5;
const dy = new Vector2(0,1).multiplyScalar(scale);
const dx = new Vector2(1,0).multiplyScalar(scale);



function createBall(pos,color,rad){
    let mat = makeMaterial(color,false);
    let geom = new SphereGeometry(rad);
    let mesh = new Mesh(geom,mat);
    mesh.position.set(pos.x,0,pos.y);
    return mesh;
}


function createHorizontal(j,color,rad){

    let mat = makeMaterial(color, false);

    let s = dx.clone().multiplyScalar(-20);
    let e = dx.clone().multiplyScalar(20);
    let start = new Vector3(s.x, 0, s.y);
    let end = new Vector3(e.x,0,e.y);

    let path = new LineCurve3(start,end);

    let geom = new TubeGeometry(path,2,rad,8, false);
    let mesh = new Mesh(geom,mat);

    let h = dy.clone().multiplyScalar(j);
    mesh.position.set(h.x,0,h.y);
    return mesh;
}


function createVertical(j,color,rad){

    let mat = makeMaterial(color, false);

    let s = dy.clone().multiplyScalar(-20);
    let e = dy.clone().multiplyScalar(20);
    let start = new Vector3(s.x, 0, s.y);
    let end = new Vector3(e.x,0,e.y);

    let path = new LineCurve3(start,end);

    let geom = new TubeGeometry(path,2,rad,8, false);
    let mesh = new Mesh(geom,mat);

    let h = dx.clone().multiplyScalar(j);
    mesh.position.set(h.x,0,h.y);
    return mesh;
}


let pts = new Group();
scene.add(pts);

const layers=8;
for(let i=-layers;i<layers;i++){
    for(let j=-layers;j<layers;j++){


        let vert = new Vector2();
        vert.add(dx.clone().multiplyScalar(i));
        vert.add(dy.clone().multiplyScalar(j));
        pts.add(createBall(vert,0xa82c2c,0.03));

        let pt = vert.clone().add(new Vector2(-0.2,0.2));
        pts.add(createBall(pt,0x781919,0.04));

    }
}

let edges = new Group();
scene.add(edges);

for( let i=-10; i<10; i++){
    edges.add(createHorizontal(i,colors.red,0.015));
    edges.add(createVertical(i,colors.red,0.015));
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

