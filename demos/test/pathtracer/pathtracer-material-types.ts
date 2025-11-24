import { App } from '@/app/App';
import * as THREE from 'three';
import { viridis } from '@/utils/colormaps';

const app = new App({
    debug: true,
    antialias: true,
    pathTracerDefaults: {
        bounces: 10,
        samples: 1
    }
});

// Set up camera
app.camera.position.set(0, 2, 8);
app.camera.lookAt(0, 0, 0);

// Add simple gradient background
app.backgrounds.setSky({
    topColor: 0x87ceeb,      // Sky blue
    bottomColor: 0xffffff,   // White
    offset: 33,
    exponent: 0.6
});

// Add lights
const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(5, 5, 5);
app.scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 3, -5);
app.scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
app.scene.add(ambientLight);

// Add ground plane
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2
    })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1;
app.scene.add(ground);

// ===== SPHERE 1: Standard Material with Constant Color =====
const sphere1Geo = new THREE.SphereGeometry(1, 64, 64);
const sphere1Mat = new THREE.MeshStandardMaterial({
    color: 0xff3366,
    roughness: 0.3,
    metalness: 0.1
});
const sphere1 = new THREE.Mesh(sphere1Geo, sphere1Mat);
sphere1.position.set(-3, 0, 0);
app.scene.add(sphere1);

// ===== SPHERE 2: Shader Material =====
const sphere2Geo = new THREE.SphereGeometry(1, 64, 64);
const sphere2Mat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 }
    },
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
            vPosition = position;
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
            // Rainbow gradient based on position
            vec3 color = vec3(
                0.5 + 0.5 * sin(vPosition.y * 3.0 + time),
                0.5 + 0.5 * sin(vPosition.y * 3.0 + time + 2.094),
                0.5 + 0.5 * sin(vPosition.y * 3.0 + time + 4.188)
            );
            gl_FragColor = vec4(color, 1.0);
        }
    `
});
const sphere2 = new THREE.Mesh(sphere2Geo, sphere2Mat);
sphere2.position.set(0, 0, 0);
app.scene.add(sphere2);

// ===== SPHERE 3: Vertex Colors (JavaScript Colormap) =====
const sphere3Geo = new THREE.SphereGeometry(1, 64, 64);

// Assign vertex colors using the viridis colormap
const positions = sphere3Geo.attributes.position;
const colors = new Float32Array(positions.count * 3);

for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    // Map y coordinate (-1 to 1) to colormap (0 to 1)
    const t = (y + 1) / 2;
    const color = viridis(t);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
}

sphere3Geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const sphere3Mat = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.1,
    vertexColors: true  // Enable vertex colors
});
const sphere3 = new THREE.Mesh(sphere3Geo, sphere3Mat);
sphere3.position.set(3, 0, 0);
app.scene.add(sphere3);

// Add labels
const createLabel = (text: string, position: THREE.Vector3) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = 'bold 48px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(3, 0.75, 1);

    return sprite;
};

app.scene.add(createLabel('Constant Color', new THREE.Vector3(-3, 2, 0)));
app.scene.add(createLabel('Shader Material', new THREE.Vector3(0, 2, 0)));
app.scene.add(createLabel('Vertex Colors', new THREE.Vector3(3, 2, 0)));

// ===== UI Controls =====
const controlsContainer = document.createElement('div');
controlsContainer.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 20px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 14px;
    z-index: 1000;
`;

const title = document.createElement('div');
title.textContent = 'Pathtracer Material Test';
title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 15px;';
controlsContainer.appendChild(title);

const statusDiv = document.createElement('div');
statusDiv.style.marginBottom = '15px';
statusDiv.innerHTML = 'Mode: <span id="mode-status">WebGL Renderer</span>';
controlsContainer.appendChild(statusDiv);

const toggleButton = document.createElement('button');
toggleButton.textContent = 'Enable Path Tracer';
toggleButton.style.cssText = `
    padding: 10px 20px;
    font-size: 14px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    width: 100%;
    margin-bottom: 10px;
`;

let pathTracerEnabled = false;

toggleButton.addEventListener('click', () => {
    pathTracerEnabled = !pathTracerEnabled;
    const modeStatus = document.getElementById('mode-status')!;

    if (pathTracerEnabled) {
        app.enablePathTracing();
        toggleButton.textContent = 'Disable Path Tracer';
        toggleButton.style.background = '#f44336';
        modeStatus.textContent = 'Path Tracer';
        modeStatus.style.color = '#4CAF50';
    } else {
        app.disablePathTracing();
        toggleButton.textContent = 'Enable Path Tracer';
        toggleButton.style.background = '#4CAF50';
        modeStatus.textContent = 'WebGL Renderer';
        modeStatus.style.color = '#ffffff';
    }
});

controlsContainer.appendChild(toggleButton);

const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'margin-top: 15px; font-size: 12px; line-height: 1.6;';
infoDiv.innerHTML = `
    <strong>Testing:</strong><br>
    • Left: Standard material (should work)<br>
    • Middle: Shader material (may not work)<br>
    • Right: Vertex colors (will it work?)
`;
controlsContainer.appendChild(infoDiv);

document.body.appendChild(controlsContainer);

// Animation loop to update shader
app.onBeforeRender = () => {
    sphere2Mat.uniforms.time.value = performance.now() * 0.001;
};

// Start the app
app.start();

console.log('Pathtracer Material Types Demo');
console.log('-------------------------------');
console.log('Sphere 1 (left): MeshStandardMaterial with constant color');
console.log('Sphere 2 (middle): ShaderMaterial with animated gradient');
console.log('Sphere 3 (right): MeshStandardMaterial with vertex colors');
console.log('');
console.log('Toggle pathtracer to see which materials work!');
