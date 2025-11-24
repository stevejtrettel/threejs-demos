# Camera & Timeline System

Documentation for camera management and timeline control in the animation framework.

## Timeline Manager

The `TimelineManager` acts as the central clock, managing global time, playback, and animation speed.

### Basic Usage

```typescript
import { TimelineManager } from './app/TimelineManager';

const timeline = new TimelineManager();

// In animation loop
app.addAnimateCallback((timestamp) => {
  timeline.update(timestamp);
  
  // Use timeline values
  const time = timeline.time;   // Current time in seconds
  const delta = timeline.delta; // Time since last frame
  const frame = timeline.frame; // Frame counter
});
```

### Playback Control

```typescript
// Play/Pause
timeline.play();
timeline.pause();
timeline.togglePlay();

// Stop and reset to zero
timeline.stop();

// Reset without pausing
timeline.reset();

// Scrub to specific time
timeline.setTime(5.0); // Jump to 5 seconds
```

### Speed Control

```typescript
// Normal speed
timeline.setSpeed(1.0);

// Half speed (slow motion)
timeline.setSpeed(0.5);

// Double speed
timeline.setSpeed(2.0);

// Reverse playback
timeline.setSpeed(-1.0);
```

### State Properties

```typescript
timeline.time;      // Current time (seconds)
timeline.delta;     // Frame delta (seconds)
timeline.frame;     // Frame counter
timeline.isPlaying; // Playback state
timeline.speed;     // Current playback speed
```

## Camera Manager

The `CameraManager` handles camera positioning, smooth transitions, and view presets.

### Basic Setup

```typescript
import { CameraManager } from './app/CameraManager';

const cameraManager = new CameraManager({
  fov: 75,           // Field of view (degrees)
  near: 0.1,         // Near clipping plane
  far: 1000,         // Far clipping plane
  position: new THREE.Vector3(0, 2, 5) // Initial position
});

// Access the camera
const camera = cameraManager.camera;
```

### Direct Positioning

```typescript
// Set position
cameraManager.setPosition(5, 3, 10);

// Look at point
cameraManager.lookAt(0, 0, 0);
```

### Smooth Transitions

```typescript
// Fly camera to new position
await cameraManager.flyTo(
  new THREE.Vector3(0, 5, 10),  // Target position
  new THREE.Vector3(0, 0, 0),   // Look-at target
  {
    duration: 2.0,                // Seconds
    easing: (t) => t * t          // Optional easing function
  }
);

console.log('Camera transition complete!');
```

The default easing is **ease-in-out cubic** for smooth starts and stops.

### Window Resize

The camera manager handles aspect ratio updates:

```typescript
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  cameraManager.resize(width, height);
  renderer.setSize(width, height);
});
```

## Integration with App

Both managers are automatically created and integrated in the `App` class:

```typescript
import { App } from './app/App';

const app = new App();

// Access managers
app.timeline.play();
app.camera.position.set(0, 2, 5);

// Timeline auto-updates each frame
// Camera auto-resizes with window
```

## Use Cases

### Animation Timing

```typescript
// Sine wave motion based on timeline
app.addAnimateCallback(() => {
  const t = app.timeline.time;
  cube.position.y = Math.sin(t * 2) * 2;
});
```

### Slow Motion Effect

```typescript
function enableSlowMotion() {
  app.timeline.setSpeed(0.3);
}
```

### Camera Presets

```typescript
async function showTopView() {
  await app.cameraManager.flyTo(
    new THREE.Vector3(0, 10, 0.1),
    new THREE.Vector3(0, 0, 0),
    { duration: 1.5 }
  );
}

async function showSideView() {
  await app.cameraManager.flyTo(
    new THREE.Vector3(10, 2, 0),
    new THREE.Vector3(0, 0, 0),
    { duration: 1.5 }
  );
}
```

### Frame-by-Frame Export

```typescript
// Video export uses timeline for precise frame control
app.video.export({
  duration: 5,  // 5 seconds
  fps: 30,      // 30 frames per second
  onProgress: (p) => console.log(`${Math.round(p * 100)}%`)
});

// Timeline automatically:
// 1. Pauses playback
// 2. Steps through each frame
// 3. Captures screenshot
// 4. Restores original state
```

## Advanced: Custom Easing

```typescript
// Bounce easing
const bounceEasing = (t: number) => {
  if (t < 0.5) {
    return 2 * t * t;
  }
  return 1 - Math.pow(-2 * t + 2, 2) / 2;
};

await cameraManager.flyTo(position, target, {
  duration: 3,
  easing: bounceEasing
});
```

## Notes

- Timeline delta is **zero when paused** to prevent unwanted updates
- Camera transitions can be **awaited** for choreographed sequences
- Timeline speed can be **negative for reverse playback**
- Camera aspect ratio **auto-updates on window resize**
