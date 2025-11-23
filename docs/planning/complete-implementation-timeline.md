# Complete Infrastructure Implementation Timeline

**All infrastructure from original requirements list, organized week by week**

**Timeline:** 8 weeks to rock-solid infrastructure before research program

---

## 📅 Week 1: Asset Foundation

### Days 1-2: Asset Management System
**Deliverable:** Can load textures, HDRIs, shaders, models

- Create `AssetManager` class
- Texture loading (PNG, JPG, EXR)
  - `app.assets.loadTexture(path)` → Promise<Texture>
  - Caching system
  - Progress tracking
- HDRI loading (HDR, EXR)
  - RGBELoader integration
  - EXRLoader integration
  - `app.assets.loadHDRI(path)` → Promise<Texture>
- Shader file loading
  - Load .glsl files
  - Parse vertex/fragment shaders
  - `app.assets.loadShader(vertPath, fragPath)` → {vertex, fragment}
- GLTF/GLB model loading
  - GLTFLoader integration
  - `app.assets.loadModel(path)` → Promise<Group>
- Asset disposal and cleanup

**Files to create:**
- `src/app/AssetManager.ts`

---

### Days 3-4: Material & Shader System
**Deliverable:** Can apply textures to materials, create custom shaders

- Extend Materials.ts with texture support
  - `Materials.textured(texture, options)` → Material with texture
  - UV mapping support
  - Normal maps, roughness maps, metalness maps
- Custom shader material utilities
  - `Materials.shader(vertexShader, fragmentShader, uniforms)` → ShaderMaterial
  - Helper for common uniforms (time, resolution, camera, etc.)
  - Uniform binding to Params system
- Shader examples
  - Curvature colormap shader
  - Normal-based coloring
  - Data-driven vertex coloring
- Material switching at runtime
  - `object.setMaterial(newMaterial)`

**Files to create:**
- `src/shaders/` directory
- `src/shaders/curvature.vert.glsl`
- `src/shaders/curvature.frag.glsl`
- Update `src/materials/Materials.ts`

---

### Day 5: Environment Maps & Beautiful Backgrounds
**Deliverable:** Can load HDRI, have environmental lighting, beautiful backgrounds

- Extend BackgroundManager with HDRI support
  - Load HDRI environment map
  - Set as scene background
  - Set as environment map (for reflections)
- Image-based lighting (IBL) setup
  - PMREMGenerator for environment
  - Apply to scene.environment
- Background presets
  - HDRI environments
  - Gradient backgrounds ✓ (enhance existing)
  - Solid colors ✓ (enhance existing)
  - Custom texture backgrounds
- Environment intensity control
  - Adjust brightness
  - Adjust rotation

**Files to update:**
- `src/app/BackgroundManager.ts`

**Example HDRIs to include:**
- Studio lighting
- Outdoor natural light
- Night sky
- Abstract gradients

---

## 📅 Week 2: Interaction & Selection

### Days 1-2: Object Picking & Selection System ⭐
**Deliverable:** Can click on objects, select them, trigger callbacks

- Raycasting system
  - THREE.Raycaster integration
  - Mouse position → ray
  - Ray → intersected objects
  - Handle different object types (Mesh, Line, Points)
- Click detection
  - Click on object → select it
  - Click empty space → deselect
  - Click handlers: `object.onClick(point, event)`
- Hover detection
  - Hover over object → highlight
  - Hover callbacks: `object.onHover(point, event)`
  - Mouse leave callbacks: `object.onHoverEnd()`
- Selection highlighting
  - Outline selected object (outline shader or THREE.OutlinePass?)
  - Change material emissive
  - Visual feedback
- Multi-selection
  - Ctrl+click to add to selection
  - Selection array
  - Select all, deselect all
- Integration with UI
  - When object selected → expose its Params in UI
  - Show object name/type

**Files to create:**
- `src/app/InteractionManager.ts` or `src/app/SelectionManager.ts`

**Architecture:**
```typescript
app.interaction.enablePicking();
app.interaction.on('click', (object, point) => { ... });
app.interaction.on('hover', (object, point) => { ... });
app.interaction.getSelected(); // → Object3D[]
```

---

### Days 3-4: Scene Management & Groups
**Deliverable:** Better patterns for organizing hierarchies

- Hierarchical path-based naming
  - `app.add(obj, { path: 'scene1/surfaces/torus' })`
  - `app.getObject('scene1/surfaces/torus')`
  - Path-based operations
- Group utilities
  - `app.createGroup('name', parentPath?)`
  - `app.getGroup('path')` → Group
  - List children of group
- Tags/layers system
  - `app.add(obj, { tags: ['animated', 'geodesic'] })`
  - `app.getByTag('animated')` → Object3D[]
  - `app.showByTag('geodesic')`
  - `app.hideByTag('animated')`
- Hierarchical operations
  - `app.showSubtree('scene1/surfaces')` - show all descendants
  - `app.hideSubtree('scene1')`
  - `app.transformSubtree('scene1', matrix)`
  - `app.disposeSubtree('scene1')`
- Scene inspection
  - `app.listObjects()` - all objects
  - `app.listGroups()` - all groups
  - `app.printSceneGraph()` - hierarchical tree

**Files to create/update:**
- Enhance `src/app/App.ts` with group management
- Or create `src/app/SceneManager.ts`

**Example hierarchy:**
```
app/
  scene1/
    surfaces/
      torus [tags: animated]
      sphere [tags: static]
    curves/
      geodesic1 [tags: animated, geodesic]
      geodesic2 [tags: geodesic]
  scene2/
    ...
```

---

### Day 5: Performance & Debug Overlay
**Deliverable:** FPS counter, debug toggles, performance monitoring

- Stats panel (FPS, frame time, draw calls)
  - Integrate stats.js library OR custom implementation
  - Position: top-left corner (separate from main UI)
  - Show/hide with keyboard shortcut
- Extended stats
  - Draw calls
  - Triangle count
  - Geometries in memory
  - Textures in memory
  - Active objects count
- Debug mode toggles
  - Wireframe overlay (keyboard: W)
  - Show bounding boxes (keyboard: B)
  - Show normals (keyboard: N)
  - Show coordinate axes (keyboard: A)
  - Show grid (keyboard: G)
  - Show scene graph (keyboard: S)
- Performance profiling
  - Time function calls: `app.debug.profile('rebuild', fn)`
  - Log rebuild() times
  - Log update() times
  - Identify bottlenecks
- Keyboard shortcuts
  - F: Toggle fullscreen
  - H: Toggle UI visibility
  - D: Toggle debug overlay
  - Plus all debug toggles above

**Files to create:**
- `src/app/DebugManager.ts`
- Keyboard shortcut handler

**IMPORTANT:** This is SEPARATE from main UI (ParameterManager)

---

## 📅 Week 3: Colormaps & Measurements

### Days 1-2: Colormap System (JS)
**Deliverable:** Can color objects by data values

- Colormap utilities (JS)
  - Map scalar → hex color: `colormap.map(value, 'viridis')`
  - Presets:
    - Scientific: viridis, plasma, inferno, magma, cividis
    - Diverging: coolwarm, RdYlBu
    - Sequential: turbo, jet (legacy)
    - Custom: rainbow, grayscale
  - Value normalization
    - Auto min/max from data array
    - Manual range: `colormap.map(value, 'viridis', {min: 0, max: 1})`
  - Color scales
    - Linear (default)
    - Logarithmic
    - Custom function
- Color gradient generation
  - Multi-stop gradients
  - Smooth interpolation
  - `colormap.gradient(['#ff0000', '#00ff00', '#0000ff'], steps)`
- Integration examples
  - Color curve by arc length
  - Color surface by curvature (using vertex colors)
  - Color particles by speed

**Files to create:**
- `src/algorithms/colormaps.ts` (or enhance existing)
- Colormap data (color stops for each preset)

---

### Days 3-4: Colormap System (GLSL)
**Deliverable:** Can color in shaders using same colormaps

- GLSL colormap functions
  - Shader functions: `vec3 viridis(float t)`
  - Same visual output as JS colormaps
  - Optimized for GPU
- Generate GLSL from definitions
  - Share colormap data between JS and GLSL
  - Script to generate .glsl files from data?
  - Or hand-code but keep visually identical
- Shader integration
  - Pass data as vertex attribute or uniform
  - Map to color in fragment shader
  - Examples:
    - Curvature-colored surface
    - Distance-colored mesh
    - Heat map visualization
- Uniform controls
  - Min/max range (uniforms)
  - Colormap selection (uniform int)
  - Integration with Params

**Files to create:**
- `src/shaders/colormaps.glsl` - all colormap functions
- `src/shaders/examples/curvature-colored.vert.glsl`
- `src/shaders/examples/curvature-colored.frag.glsl`

---

### Day 5: Measurement Tools (Basic)
**Deliverable:** Can measure distance, show coordinates

- Coordinate display on hover
  - Show (x, y, z) in overlay
  - Formatted nicely
  - Option to show in different coordinate systems
- Distance measurement
  - Click two points → show distance
  - Draw line between points
  - Show distance label
  - Clear measurements
- Measurement mode
  - Toggle measurement mode on/off
  - In measurement mode, clicks measure instead of selecting
  - Visual feedback (crosshair cursor?)
- 3D text labels
  - Billboard text (always faces camera)
  - Attach label to point in space
  - `app.measurements.addLabel('Origin', new Vector3(0,0,0))`
  - Show/hide labels
  - Clear all labels

**Files to create:**
- `src/app/MeasurementManager.ts`
- Text sprite utilities for 3D labels

**Future (not this week):**
- Arc length along curves
- Curvature at point
- Angle measurement

---

## 📅 Week 4: Camera & Screenshots

### Days 1-2: Camera System
**Deliverable:** Easy camera control, positioning, animation

- Camera positioning API
  - `app.camera.setPosition(x, y, z)`
  - `app.camera.lookAt(x, y, z)` or `lookAt(object)`
  - `app.camera.setFOV(degrees)`
  - Get current camera state: `app.camera.getState()`
- Camera presets
  - Save named positions: `app.camera.savePreset('front-view')`
  - Load preset: `app.camera.loadPreset('front-view')`
  - Built-in presets: 'top', 'front', 'side', 'isometric'
  - Serialize/deserialize camera state
- Smooth camera transitions
  - Animate from current to target: `app.camera.flyTo(position, target, duration)`
  - Easing functions (ease-in-out, etc.)
  - Promise-based: `await app.camera.flyTo(...)`
- Camera animation (keyframes)
  - Define keyframes: position, target, fov at times
  - Interpolate between keyframes
  - Camera as Animatable object
  - Integration with timeline
- Mode switching
  - Interactive mode (OrbitControls enabled)
  - Programmatic mode (OrbitControls disabled)
  - Auto-switch based on API calls
- Projection modes
  - Perspective (current)
  - Orthographic
  - Switch between them

**Files to create:**
- `src/app/CameraManager.ts`
- Camera animation helpers

**Integration:**
- When camera is animating, disable OrbitControls
- When user interacts with OrbitControls, stop animation
- Smooth handoff between modes

---

### Days 3-5: Screenshot System with Metadata
**Deliverable:** Save screenshots, high-res, with embedded parameters

**Basic Screenshots:**
- Capture at canvas resolution
  - `app.screenshot()` → downloads PNG
  - Keyboard shortcut (P for "photo")
  - Filename with timestamp
- Format options
  - PNG (default, lossless)
  - JPEG (lossy, smaller)
  - WebP (modern, good compression)

**High-Resolution Rendering:**
- Render off-screen at any resolution
  - `app.screenshot({ width: 4096, height: 2160 })`
  - Create off-screen canvas
  - Render to off-screen
  - Download result
  - Don't affect visible canvas
- Scale from current resolution
  - `app.screenshot({ scale: 2 })` → double resolution
  - `app.screenshot({ scale: 4 })` → 4K from 1080p

**Transparent Background:**
- Alpha channel option
  - `app.screenshot({ transparent: true })`
  - Useful for compositing
  - PNG only (JPEG doesn't support alpha)

**Metadata Embedding:**
- Embed parameter state in PNG metadata
  - Extract all Params from all objects
  - Serialize to JSON
  - Embed in PNG tEXt chunk
  - Include:
    - All parameter values
    - Camera position/rotation/fov
    - Render settings
    - Timestamp
    - Framework version
    - Git commit hash (if available)
- Load scene from screenshot
  - `app.loadFromScreenshot(file)`
  - Read PNG metadata
  - Parse JSON
  - Recreate exact scene
  - Restore camera
- Metadata viewer
  - Drag & drop PNG to see its metadata
  - Show parameter state
  - Copy parameters

**Architecture:**
```typescript
// Basic
app.screenshot(); // Downloads 'screenshot_2024-11-23_14-30-45.png'

// High-res
app.screenshot({
  width: 3840,
  height: 2160,
  format: 'png',
  filename: 'figure-3-geodesics.png'
});

// Transparent
app.screenshot({
  transparent: true,
  filename: 'surface-alpha.png'
});

// With metadata
app.screenshot({
  width: 4096,
  height: 2160,
  embedMetadata: true,
  filename: 'paper-figure-1.png'
});

// Restore from screenshot
await app.loadFromScreenshot('paper-figure-1.png');
// Scene and camera now match screenshot exactly
```

**Files to create:**
- Enhance `src/app/App.ts` with screenshot methods
- Or create `src/app/ScreenshotManager.ts`
- PNG metadata utilities (tEXt chunk read/write)

**Libraries to consider:**
- pngjs or UPNG.js for PNG manipulation
- Or use canvas.toBlob() and manual metadata injection

---

## 📅 Week 5: Export & Animation Timeline

### Days 1-2: Export Formats (GLTF, OBJ, STL)
**Deliverable:** Export 3D models for external tools

**GLTF/GLB Export:**
- Export entire scene
  - `app.export.gltf('scene.glb')`
  - Preserves materials, textures, hierarchy
  - Binary GLB (compact) or JSON GLTF (readable)
- Export selected objects
  - `app.export.gltf('selection.glb', { objects: [obj1, obj2] })`
  - Export specific subtree
- Options
  - Embed textures or external files
  - Draco compression (smaller files)
  - Include animations

**OBJ Export:**
- Export meshes
  - `app.export.obj('model.obj')`
  - Generates .obj + .mtl files
  - Good for Blender, MeshLab, etc.
- Options
  - Single object or multiple
  - Include materials (MTL file)

**STL Export:**
- For 3D printing
  - `app.export.stl('model.stl')`
  - Binary STL (compact) or ASCII STL (readable)
- Ensure manifold geometry
  - Warn if mesh has holes
  - Suggest repair tools

**Data Export:**
- CSV export for curves/surfaces
  - `app.export.csv(curve.points, 'curve-points.csv')`
  - Header row with column names
  - X, Y, Z columns
- JSON export
  - Parameter state: `app.export.parametersJSON()`
  - Scene graph: `app.export.sceneJSON()`

**Files to create:**
- `src/app/ExportManager.ts`
- Or add methods to `src/app/App.ts`

**Libraries:**
- GLTFExporter (THREE.js built-in)
- OBJExporter (THREE.js examples)
- STLExporter (THREE.js examples)

---

### Days 3-4: Animation Timeline System
**Deliverable:** Play, pause, scrub, control animations

**Playback Controls:**
- Play/pause/stop
  - `app.timeline.play()`
  - `app.timeline.pause()`
  - `app.timeline.stop()` - reset to start
  - Keyboard shortcuts (Space = play/pause)
- Loop modes
  - Once (stop at end)
  - Loop (restart at end)
  - Ping-pong (reverse at end)
  - `app.timeline.setLoopMode('loop')`
- Speed control
  - `app.timeline.setSpeed(0.5)` - slow motion
  - `app.timeline.setSpeed(2.0)` - fast forward
  - `app.timeline.setSpeed(-1.0)` - reverse
  - Range: -10x to +10x

**Timeline Scrubbing:**
- Set time directly
  - `app.timeline.setTime(5.0)` - jump to 5 seconds
  - Scrub bar (drag to any time)
  - Click timeline to jump
- Frame stepping
  - `app.timeline.stepFrame(1)` - next frame
  - `app.timeline.stepFrame(-1)` - previous frame
  - Keyboard: Arrow keys or , / .
- Frame-accurate control
  - Set FPS: `app.timeline.setFPS(60)`
  - Frame counter display
  - Time display (seconds and frames)

**Time Display:**
- Current time / duration
  - Format: MM:SS or HH:MM:SS
  - Frame counter: Frame 150 / 600
- Progress bar
  - Visual timeline
  - Click to scrub
  - Drag playhead

**Global Time:**
- All animatables share same clock
  - `app.timeline.time` - current time
  - Passed to all animate() callbacks
- Pause time but allow camera
  - Freeze objects, still move camera
  - Debug mode

**Architecture:**
```typescript
app.timeline.play();
app.timeline.pause();
app.timeline.setTime(5.0);
app.timeline.setSpeed(0.5);
app.timeline.setLoopMode('ping-pong');
app.timeline.setFPS(60);

// Current state
app.timeline.time; // 5.3
app.timeline.frame; // 318
app.timeline.isPlaying; // true
app.timeline.speed; // 0.5

// Events
app.timeline.on('play', () => { ... });
app.timeline.on('pause', () => { ... });
app.timeline.on('timechange', (time) => { ... });
```

**Files to create:**
- `src/app/TimelineManager.ts`
- Timeline UI component (scrubber bar)

---

### Day 5: Video Export (PNG Sequence)
**Deliverable:** Export animations as frame sequences

**Frame-by-Frame Capture:**
- Manual time control
  - Set exact time: `app.timeline.setTime(t)`
  - Render that frame
  - Save screenshot
  - Loop for all frames
- Options
  - Duration: 10 seconds
  - FPS: 60
  - Resolution: 1920x1080
  - Start/end times
  - Frame number padding (001, 002, ...)
- PNG sequence export
  - `app.video.export({ duration: 10, fps: 60 })`
  - Downloads: frame_001.png, frame_002.png, ...
  - Or zip file with all frames
- Progress indicator
  - Current frame / total frames
  - Estimated time remaining
  - Cancel button

**Post-Processing:**
- Provide ffmpeg command
  - Log to console:
    ```
    ffmpeg -framerate 60 -i frame_%03d.png -c:v libx264 -pix_fmt yuv420p output.mp4
    ```
  - Copy-paste to terminal
- Alternative: Web-based encoding
  - WASM ffmpeg (ffmpeg.wasm)
  - Client-side MP4 encoding
  - Slower but convenient
  - Optional feature

**Architecture:**
```typescript
app.video.export({
  duration: 10,
  fps: 60,
  width: 1920,
  height: 1080,
  startTime: 0,
  endTime: 10,
  filename: 'animation',
  format: 'png', // or 'jpg'
  onProgress: (frame, total) => {
    console.log(`Frame ${frame}/${total}`);
  }
});
// Downloads: animation_001.png, animation_002.png, ...

// Or manual loop
for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / fps;
  app.timeline.setTime(time);
  await app.screenshot({ filename: `frame_${frame.toString().padStart(3, '0')}.png` });
}
```

**Files to create:**
- `src/app/VideoExportManager.ts`
- Or enhance `src/app/App.ts`

**Integration:**
- Uses timeline system (setTime)
- Uses screenshot system (capture frame)
- Combines both systems

---

## 📅 Week 6: Pathtracer Integration

### Days 1-3: Rendering Backend Architecture
**Deliverable:** Can switch between standard and pathtracer renderers

**Renderer Abstraction:**
- Common interface for renderers
  ```typescript
  interface Renderer {
    render(scene: Scene, camera: Camera): void;
    setSize(width: number, height: number): void;
    dispose(): void;
    screenshot(): Promise<Blob>;
  }
  ```
- Standard renderer (current WebGLRenderer)
  - Wrap existing renderer in interface
  - `StandardRenderer implements Renderer`
- Pathtracer renderer (future)
  - `PathtracerRenderer implements Renderer`
  - Will implement in next days

**Backend Switching:**
- Switch renderers
  - `app.setRenderer('standard')` - default
  - `app.setRenderer('pathtracer')` - high quality
  - Seamless transition
- Renderer settings
  - `app.rendererSettings({ ... })`
  - Different settings per backend
  - Standard: antialias, shadows, etc.
  - Pathtracer: samples, bounces, etc.
- Scene compatibility
  - Same scene works with both renderers
  - Material translation if needed
  - Lights translation if needed

**Architecture:**
```typescript
class App {
  private renderer: Renderer;
  private standardRenderer: StandardRenderer;
  private pathtracerRenderer: PathtracerRenderer;

  setRenderer(type: 'standard' | 'pathtracer') {
    this.renderer = type === 'standard'
      ? this.standardRenderer
      : this.pathtracerRenderer;
  }
}
```

**Files to create:**
- `src/rendering/Renderer.ts` - interface
- `src/rendering/StandardRenderer.ts` - wrapper
- `src/rendering/PathtracerRenderer.ts` - stub for now

---

### Days 4-5: three-gpu-pathtracer Integration
**Deliverable:** High-quality pathtraced rendering

**Setup:**
- Install three-gpu-pathtracer
  - `npm install three-gpu-pathtracer`
  - Check compatibility with THREE.js version
- Initialize pathtracer
  - Create pathtracer instance
  - Configure pathtracer for our scene
  - Material conversion (if needed)

**Progressive Rendering:**
- Sample accumulation
  - Render samples progressively
  - Display updates as samples accumulate
  - Visual feedback (sample count, convergence)
- Convergence detection
  - When to stop rendering
  - Quality threshold
  - Max samples limit
  - `app.pathtracer.render({ samples: 1000 })`

**Pathtracer Controls:**
- Samples per frame
  - Low (100) - fast preview
  - Medium (500) - good quality
  - High (2000+) - production quality
- Bounces (light bounces)
  - More bounces = better caustics, slower
  - Typical: 3-8 bounces
- Resolution
  - Same as canvas or custom
- Denoise
  - If available in library
  - Post-processing denoise

**Material Translation:**
- Convert standard materials to pathtracer
  - THREE.MeshStandardMaterial → pathtracer compatible
  - THREE.MeshPhysicalMaterial → pathtracer compatible
  - Texture support
- Pathtracer-specific materials
  - Dielectric (glass)
  - Conductor (metal)
  - Emissive (lights)

**Architecture:**
```typescript
app.setRenderer('pathtracer');

app.pathtracer.render({
  samples: 1000,
  bounces: 5,
  onProgress: (samples) => {
    console.log(`Rendered ${samples} samples`);
  }
}).then(() => {
  console.log('Converged!');
});

// Settings
app.pathtracer.setSamples(2000);
app.pathtracer.setBounces(8);
app.pathtracer.setResolution(3840, 2160);
```

**Files to create:**
- `src/rendering/PathtracerRenderer.ts` - implement
- Pathtracer utilities and helpers

**Challenges to solve:**
- Scene graph compatibility
- Material conversion
- Light conversion
- Performance optimization

---

## 📅 Week 7: Pathtracer Animation & UI Foundation

### Days 1-2: Pathtracer Animation Rendering
**Deliverable:** Export pathtraced animations (high quality, slow)

**Per-Frame Pathtracing:**
- Render each frame with pathtracer
  - Set time for frame
  - Pathtracer render to convergence
  - Save frame
  - Move to next frame
- Quality vs. time tradeoff
  - Samples per frame (more = better, slower)
  - Convergence threshold
  - Max time per frame

**Progress Tracking:**
- Multi-level progress
  - Overall: frame X / total frames
  - Per-frame: sample Y / target samples
  - Estimated time remaining
- Progress UI
  - Progress bar
  - Current frame preview
  - Time elapsed / remaining
  - Cancel button

**Resume Capability:**
- Save progress
  - Which frames completed
  - Partial frame state?
  - Resume from interruption
- State file
  - JSON with progress data
  - Resume export session

**Architecture:**
```typescript
app.video.exportPathtraced({
  duration: 10,
  fps: 30,
  samplesPerFrame: 2000,
  bounces: 5,
  width: 1920,
  height: 1080,
  filename: 'pathtraced_animation',
  onFrameProgress: (frame, samples, totalSamples) => {
    console.log(`Frame ${frame}, sample ${samples}/${totalSamples}`);
  },
  onFrameComplete: (frame, totalFrames) => {
    console.log(`Completed frame ${frame}/${totalFrames}`);
  }
});

// Resume
app.video.resumePathtracedExport('pathtraced_animation_progress.json');
```

**Warning:**
- This can take HOURS or DAYS for high quality
- Need good progress indication
- Need ability to pause/resume
- Consider distributed rendering (future)

**Files to create:**
- Enhance `src/app/VideoExportManager.ts`
- Progress state save/load

---

### Days 3-5: Custom UI Foundation
**Deliverable:** Beautiful custom UI for parameters (not lil-gui)

**Technology Choice:**
- Custom HTML/CSS/JS (no framework)
  - Full control over styling
  - Lightweight
  - No build complexity
  - Direct DOM manipulation

**UI Components:**
- Parameter controls
  - Slider (number with min/max)
    - Drag to change
    - Click to type exact value
    - Visual feedback
  - Color picker
    - Click to open picker
    - Hex input
    - HSV/RGB sliders
  - Dropdown (select from options)
    - Click to expand
    - Keyboard navigation
  - Checkbox (boolean)
    - Toggle on/off
    - Visual checkmark
  - Button (trigger action)
    - Click handler
    - Visual feedback (ripple?)
  - Text input
    - Single line
    - Validation
  - Vector input (x, y, z)
    - Three number inputs
    - Compact layout

**UI Structure:**
- Collapsible panels
  - Folders/sections
  - Expand/collapse
  - Remember state (localStorage)
- Parameter groups
  - Auto-generate from Params definitions
  - Group by object
  - Nested folders
- Search/filter
  - Search parameters by name
  - Filter by tag
  - Highlight matches

**Styling:**
- Match visualization aesthetic
  - Dark theme (default)
  - Light theme option
  - Customizable colors
- Responsive
  - Resize panels
  - Drag to reposition
  - Remember position
- Animations
  - Smooth transitions
  - Expand/collapse animations
  - Hover effects

**Keyboard Shortcuts:**
- H: Hide/show UI
  - Fullscreen mode
- Tab: Focus next parameter
- Enter: Confirm value
- Esc: Cancel editing
- Ctrl+F: Search parameters

**Integration with Params:**
- Auto-generate UI from definitions
  ```typescript
  this.params.define('radius', 1.0, {
    min: 0.1,
    max: 10,
    step: 0.1,
    label: 'Radius',
    folder: 'Geometry'
  });
  ```
  - Automatically creates slider
  - In "Geometry" folder
  - Label is "Radius"
  - Range 0.1 to 10

**Preset System:**
- Save current parameter state
  - Named presets
  - "Default", "Figure 1", "Close-up", etc.
- Quick preset switching
  - Dropdown of presets
  - Click to load
- Preset management
  - Create new
  - Delete
  - Rename
  - Export/import (JSON)

**Files to create:**
- `src/ui/` directory
- `src/ui/UI.ts` - main UI class
- `src/ui/components/Slider.ts`
- `src/ui/components/ColorPicker.ts`
- `src/ui/components/Dropdown.ts`
- `src/ui/components/Checkbox.ts`
- `src/ui/components/Button.ts`
- `src/ui/components/TextInput.ts`
- `src/ui/components/VectorInput.ts`
- `src/ui/Panel.ts` - collapsible panel
- `src/ui/styles.css`

**User will provide example from another project**
- Wait for user to share their existing UI
- Use as reference/starting point
- Adapt to our needs

---

## 📅 Week 8: Polish & Integration

### Days 1-2: UI Integration & Polish
**Deliverable:** UI fully integrated with all systems

- Connect UI to ParameterManager
  - Auto-generate UI from all registered params
  - Updates when objects added/removed
  - Selection → show object's params
- Connect UI to timeline
  - Playback controls in UI
  - Time scrubber
  - Speed control
  - Loop mode selector
- Connect UI to camera
  - Camera preset dropdown
  - Save/load camera buttons
  - FOV slider
- Connect UI to debug
  - Debug toggles in UI (optional, or keep keyboard-only)
  - Stats visibility toggle
- Connect UI to export
  - Screenshot button
  - Export dropdown (GLTF, OBJ, STL)
  - Video export dialog
- Keyboard shortcuts panel
  - Show all keyboard shortcuts
  - Customizable shortcuts?

---

### Days 3-4: Testing & Bug Fixes
**Deliverable:** Rock-solid, reliable system

- Test all infrastructure
  - Asset loading (textures, HDRIs, models, shaders)
  - Materials and shaders
  - Environment maps
  - Object picking and selection
  - Measurements
  - Groups and hierarchies
  - Colormaps (JS and GLSL)
  - Camera control and animation
  - Screenshots (regular and high-res)
  - Screenshots with metadata (save and load)
  - Export formats (GLTF, OBJ, STL, CSV)
  - Animation timeline (play, pause, scrub, speed)
  - Video export (PNG sequence)
  - Pathtracer rendering
  - Pathtracer animation
  - Debug overlay and tools
  - UI (all parameter types)
- Integration testing
  - Do all systems work together?
  - Edge cases
  - Error handling
- Performance testing
  - Complex scenes
  - Many objects
  - Large textures
  - Memory leaks
- Cross-browser testing
  - Chrome (primary)
  - Firefox
  - Safari (if needed)

---

### Day 5: Documentation & Examples
**Deliverable:** Clear docs and examples for using all infrastructure

- Update docs/
  - architecture.md (update for new systems)
  - API documentation
  - User guide for each system
  - Examples and recipes
- Code examples
  - How to load textures
  - How to use custom shaders
  - How to use colormaps
  - How to export screenshots
  - How to create pathtraced renders
  - How to export videos
- Demo scenes
  - Showcase all infrastructure
  - Textured surfaces
  - Custom shader materials
  - HDRI environments
  - Interactive selection
  - Animated cameras
  - Colormap visualizations

---

## 📋 Complete Feature Checklist

By end of Week 8, we will have:

### ✅ Asset Management
- [x] Load textures (PNG, JPG, EXR)
- [x] Load HDRI environment maps
- [x] Load GLTF/GLB models
- [x] Load shader files (.glsl)
- [x] Asset caching and cleanup
- [x] Progress tracking

### ✅ Materials & Shaders
- [x] Texture support on materials
- [x] Custom shader materials
- [x] Uniform management
- [x] Shader examples (curvature, normals)
- [x] Integration with Params

### ✅ Environments & Backgrounds
- [x] HDRI environment maps
- [x] Image-based lighting (IBL)
- [x] Background presets
- [x] Environment intensity control

### ✅ Interaction
- [x] Object picking (raycasting)
- [x] Click selection
- [x] Hover effects
- [x] Multi-selection
- [x] Integration with UI (show params)

### ✅ Scene Management
- [x] Hierarchical paths ('scene1/surfaces/obj')
- [x] Groups and subgroups
- [x] Tags/layers system
- [x] Bulk operations (show/hide subtrees)
- [x] Scene inspection

### ✅ Performance & Debug
- [x] FPS and stats panel
- [x] Debug toggles (wireframe, grid, axes)
- [x] Performance profiling
- [x] Keyboard shortcuts
- [x] Memory monitoring

### ✅ Colormaps
- [x] JS colormap utilities (viridis, plasma, etc.)
- [x] GLSL colormap functions
- [x] Value normalization
- [x] Color scales (linear, log)
- [x] Integration examples

### ✅ Measurements
- [x] Coordinate display
- [x] Distance measurement
- [x] 3D labels
- [x] Measurement mode

### ✅ Camera
- [x] Position/lookAt API
- [x] Camera presets (save/load)
- [x] Smooth transitions
- [x] Camera animation (keyframes)
- [x] Orthographic projection

### ✅ Screenshots
- [x] Basic screenshot (canvas size)
- [x] High-res screenshot (any size)
- [x] Transparent background
- [x] Metadata embedding
- [x] Load from screenshot
- [x] Multiple formats (PNG, JPG, WebP)

### ✅ Export Formats
- [x] GLTF/GLB export
- [x] OBJ export
- [x] STL export (3D printing)
- [x] CSV export (data)
- [x] JSON export (state)

### ✅ Animation Timeline
- [x] Play/pause/stop controls
- [x] Timeline scrubbing
- [x] Speed control (slow-mo, fast-forward)
- [x] Loop modes
- [x] Frame stepping
- [x] Time display

### ✅ Video Export
- [x] Frame-by-frame capture
- [x] PNG sequence export
- [x] Resolution control
- [x] Progress tracking
- [x] ffmpeg command generation

### ✅ Pathtracer
- [x] Renderer abstraction
- [x] three-gpu-pathtracer integration
- [x] Progressive rendering
- [x] Material conversion
- [x] Pathtracer controls (samples, bounces)
- [x] Pathtracer animation export

### ✅ UI
- [x] Custom styled UI (not lil-gui)
- [x] All parameter types (slider, color, dropdown, etc.)
- [x] Collapsible panels
- [x] Search/filter
- [x] Preset system
- [x] Keyboard shortcuts
- [x] Integration with all systems

---

## 🎯 Success Metrics

**Before Research Program:**
- ✅ No more "I wish I could..." moments
- ✅ Can load any asset (texture, HDRI, model)
- ✅ Can create custom shader materials
- ✅ Can click and interact with objects
- ✅ Can measure and annotate
- ✅ Can organize complex scenes
- ✅ Can color by mathematical data
- ✅ Can control camera programmatically
- ✅ Can export publication-quality screenshots
- ✅ Can export 3D models for external tools
- ✅ Can create videos of animations
- ✅ Can create pathtraced renders
- ✅ Beautiful, functional UI for everything
- ✅ Comprehensive debug tools
- ✅ System is robust and stable

**During Research Program:**
- 🎯 Focus 100% on mathematics
- 🎯 Infrastructure just works
- 🎯 Quickly prototype visualizations
- 🎯 Produce publication-quality output
- 🎯 No time wasted on technical details

---

## 📝 Notes

**Flexibility:**
- This timeline is aggressive but achievable
- Some days may take longer, that's okay
- Prioritize getting everything working over perfection
- Polish can happen after core functionality

**User Involvement:**
- User will provide UI example (Week 7)
- User will test and provide feedback throughout
- User knows their research needs best

**Future Enhancements (Post Week 8):**
- State serialization (when system is stable)
- Advanced measurement tools (curvature, arc length)
- Asset pipeline optimizations
- Math infrastructure decisions
- Undo/redo
- Collaboration features
- VR/AR support

**This is comprehensive - we're covering EVERYTHING! 🚀**
