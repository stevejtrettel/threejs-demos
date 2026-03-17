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
    Vector3, Group, SphereGeometry, FloatType, TextureLoader,
    EquirectangularReflectionMapping,
    LinearFilter,
    Matrix3,
    Matrix4
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { makeMaterial } from "../../../items/utils";

import {
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight, PhysicalCamera,
} from 'three-gpu-pathtracer';

import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { RGBELoader } from "three/examples/jsm/Addons.js";

import { colors, getPastelColor, greenShades } from "../../../items/utils";
import HopfTorus from "../../../items/HopfTorus";
import { coordCurve, latticeData } from "/data/-3/tau";

import data from "/data/-3/3";


//--------------------------------------------
// SCENE + OBJECTS
//--------------------------------------------

const scene = new Scene();

// Hopf torus helper
let torus = new HopfTorus(coordCurve, latticeData);

// Sample points on the torus
let points = new Group();
scene.add(points);

for (let i = 0; i < data.length; i++) {
    let pt = torus.fromTauCoords(data[i]);
    let sph = torus.getPoint(pt, 0xc93232, 0.09, false);

    let x = Math.random();

    //if(x<0.5){
    let light = 0.1+0.3*Math.random();
    sph.material.color.setHSL(0, 0.7+0.1*Math.random(), 0.1+0.4*Math.random());
    //}
    // else{
    // let hue = 0.4+0.04*(Math.random()-0.5);
    // let light = 0.17*0.1*Math.random();
    // sph.material.color.setHSL(hue,	0.8, 0.3+0.1*Math.random());
    // }

    points.add(sph);
}


//------add other points-------------


let sph = new SphereGeometry(1);
let mat = makeMaterial(0xc93232);
mat.color.setHSL(0.5,0.9,0.3);
let mesh = new Mesh(sph, mat);
mesh.position.set(-8,-2,0);
mesh.scale.set(1.5,1.5,1.5);
scene.add(mesh);


let mesh1 = new Mesh(sph, mat);
mesh1.material.color.setHSL(0.45,1,0.3);
mesh1.position.set(3,-2,-8);
mesh1.scale.set(1,1,1);
scene.add(mesh1);


let mesh2 = new Mesh(sph, mat);
mesh2.material.color.setHSL(0.5,0.9,0.3);
mesh2.position.set(8,-2,1);
mesh2.scale.set(2,2,2);
scene.add(mesh2);


let mesh3 = new Mesh(sph, mat);
mesh3.material.color.setHSL(0.5,0.9,0.3);
mesh3.position.set(3,-2,12);
mesh3.scale.set(1.3,1.3,1.3);
scene.add(mesh3);



let mesh4 = new Mesh(sph, mat);
mesh4.material.color.setHSL(0.5,0.9,0.3);
mesh4.position.set(2,0,7);
mesh4.scale.set(1.,1.,1.);
scene.add(mesh4);


let mesh5 = new Mesh(sph, mat);
mesh5.material.color.setHSL(0.5,0.9,0.3);
mesh5.position.set(8,-2,10);
mesh5.scale.set(1.6,1.6,1.6);
scene.add(mesh5);





let mesh6 = new Mesh(sph, mat);
mesh6.material.color.setHSL(0.5,0.9,0.3);
mesh6.position.set(-7,-2,7);
mesh6.scale.set(1.,1.,1.);
scene.add(mesh6);


let mesh7 = new Mesh(sph, mat);
mesh7.material.color.setHSL(0.5,0.9,0.3);
mesh7.position.set(-2,-2,10);
mesh7.scale.set(1.6,1.6,1.6);
scene.add(mesh7);


let mesh8 = new Mesh(sph, mat);
mesh8.material.color.setHSL(0.5,0.9,0.3);
mesh8.position.set(-4,0,6);
mesh8.scale.set(0.5,0.5,0.5);
scene.add(mesh8);


let mesh9 = new Mesh(sph, mat);
mesh9.material.color.setHSL(0.5,0.9,0.3);
mesh9.position.set(-6,0,-3.5);
mesh9.scale.set(0.5,0.5,0.5);
scene.add(mesh9);

let mesh10 = new Mesh(sph, mat);
mesh10.material.color.setHSL(0.5,0.9,0.3);
mesh10.position.set(6,-2,5);
mesh10.scale.set(0.5,0.5,0.5);
scene.add(mesh10);


//--------------------------------------------
// LIGHTS
//--------------------------------------------

// Spot light
let spotLight = new PhysicalSpotLight(0xffffff);
spotLight.position.set(-3, 6.0, 0);
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 5.0;
spotLight.radius = 0.5;

// Shadows
spotLight.shadow.mapSize.width = 512;
spotLight.shadow.mapSize.height = 512;
spotLight.shadow.camera.near = 0.1;
spotLight.shadow.camera.far = 10.0;
spotLight.shadow.focus = 1.0;
spotLight.castShadow = true;
scene.add(spotLight);

// Light target
const targetObject = spotLight.target;
targetObject.position.set(1, 0, 0.05);
scene.add(targetObject);


// Ground plane
const ground = new Mesh(
    new BoxGeometry(100, 0.1, 100),
    new MeshPhysicalMaterial({
        color: 0xffffff,
        clearcoat: 1,
        roughness: 0.5,
        metalness: 0,
    })
);
ground.position.set(-1., -7, -1);
scene.add(ground);


//--------------------------------------------
// ENVIRONMENT — HDR
//--------------------------------------------

new RGBELoader()
    .setPath("/textures/")  // from public/textures/
    .load("xmas.hdr", (hdrTex) => {

        hdrTex.mapping = EquirectangularReflectionMapping;
        hdrTex.minFilter = LinearFilter;
        hdrTex.magFilter = LinearFilter;
        hdrTex.generateMipmaps = false;


        // // Allow UV transform
        // hdrTex.matrixAutoUpdate = true;

        // // Build a rotation matrix (rotate around Y here)
        // const rot = new Matrix3().setFromMatrix4(
        //     new Matrix4().makeRotationZ( Math.PI / 2 ) // 45° rotation
        // );

        // hdrTex.matrix.setFromMatrix4(rot);


        scene.environment = hdrTex;
        scene.background = hdrTex;

        // Refresh sampling in the path tracer
        if (pathTracer) {
            pathTracer.updateEnvironment();
            pathTracer.reset();
        }
    });


//--------------------------------------------
// CAMERA
//--------------------------------------------

const camera = new PerspectiveCamera();
camera.position.set(0.1, 10, -0.1);
camera.lookAt(0, 0, 0);


//--------------------------------------------
// RENDERER
//--------------------------------------------

let renderer = new WebGLRenderer({
    preserveDrawingBuffer: true,
});
renderer.toneMapping = ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);


//--------------------------------------------
// PATH TRACER
//--------------------------------------------

let pathTracer = new WebGLPathTracer(renderer);
pathTracer.setScene(scene, camera);

pathTracer.renderScale = Math.max(1 / window.devicePixelRatio, 0.5);
pathTracer.tiles.setScalar(3);
pathTracer.bounces = 50;


//--------------------------------------------
// SCREENSHOT TOOL
//--------------------------------------------

function saveImage(canvas) {
    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let hour = date.getHours();
    let minute = date.getMinutes();

    let link = document.createElement('a');
    link.download = `pathtrace ${month}-${day}-${hour}${minute}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}


//--------------------------------------------
// GUI
//--------------------------------------------

const gui = new GUI().close();
let params = {
    saveit: () => saveImage(renderer.domElement),
    rebuild: () => pathTracer.setScene(scene, camera),
};
gui.add(params, 'saveit');
gui.add(params, 'rebuild');


//--------------------------------------------
// ORBIT CONTROLS
//--------------------------------------------

let controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.33, -0.08);
controls.addEventListener('change', () => pathTracer.updateCamera());
controls.update();


//--------------------------------------------
// ANIMATION LOOP
//--------------------------------------------

onResize();
animate();

window.addEventListener('resize', onResize);

function animate() {
    requestAnimationFrame(animate);
    pathTracer.renderSample();
}

function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    pathTracer.setScene(scene, camera);
}
