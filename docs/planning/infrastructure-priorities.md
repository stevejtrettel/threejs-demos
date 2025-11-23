# Infrastructure Development Priorities

**Goal:** Production-ready research visualization framework before 2-month research program

**Timeline:** ~8 weeks

**Philosophy:** Get infrastructure rock-solid now, focus on math during research program

---

## 🔥 TIER 1: Critical Infrastructure (Do Now - Weeks 1-4)

### 1. Asset Management System
**Status:** Not started
**Priority:** Foundation for everything

**Requirements:**
- Load textures (PNG, JPG, EXR)
- Load HDRI environment maps (.hdr, .exr)
- Load GLTF/GLB models
- Load shader code (vertex/fragment .glsl files)
- Asset caching and lifecycle management
- Progress tracking for large assets
- Proper disposal when objects removed

**Architecture:**
- Centralized `AssetManager` class
- `app.assets.loadTexture(path)` → Promise<Texture>
- `app.assets.loadHDRI(path)` → Promise<Texture>
- `app.assets.loadShader(vert, frag)` → {vertex, fragment}

---

### 2. Material & Shader System
**Status:** Basic materials exist (Materials.ts)
**Priority:** Critical for custom visualizations

**Requirements:**
- Keep existing preset materials (plastic, metal, glass, ceramic, rubber)
- Add texture support to materials
- Custom shader materials (THREE.ShaderMaterial)
- Shader code management system
  - Where do .glsl files live? `src/shaders/`
  - How to load and compile
  - Uniform management (passing parameters to shaders)
- Texture binding to materials
- Material switching at runtime

**Architecture Questions:**
- How do custom shaders integrate with Params system?
- Should there be a `ShaderMaterial` wrapper class?
- Hot-reloading shaders during development?

**Examples Needed:**
- Curvature colormap shader (data-driven coloring in GLSL)
- Normal-based coloring
- Custom lighting models

---

### 3. Environment Maps & Professional Backgrounds
**Status:** Basic solid/gradient backgrounds exist
**Priority:** High (makes visualizations beautiful)

**Requirements:**
- HDRI environment map loading
- Image-based lighting (IBL) setup
- Custom skybox textures
- Background options:
  - Solid color ✓ (exists)
  - Gradient ✓ (exists)
  - HDRI environment
  - Custom texture background
  - Blurred/bokeh backgrounds
- Easy preset switching
- Environment intensity control

**Architecture:**
- Extend `BackgroundManager` with HDRI support
- Link environment to lighting system
- Support both background display and IBL

---

### 4. Object Picking & Selection System ⭐ CRUCIAL
**Status:** Not started
**Priority:** CRITICAL - needed for interaction

**Requirements:**
- **Raycasting:** Click on objects in 3D scene
- **Selection system:**
  - Click to select object
  - Highlight selected object
  - Show selected object's parameters in UI
  - Multi-selection? (Ctrl+click)
- **Hover effects:**
  - Highlight on hover
  - Show object name/type on hover
- **Click handlers:**
  - Objects can register onClick callbacks
  - Access to click position (world coordinates)
- **Integration with Params:**
  - When object selected → expose its params in UI

**Architecture:**
```typescript
// Usage
app.enablePicking();
app.on('click', (object, point) => { ... });
app.on('hover', (object, point) => { ... });

// In math objects
const surface = new ParametricSurface(...);
surface.onClick = (point) => {
  console.log('Clicked at', point);
};
```

---

### 5. Measurement & Annotation Tools
**Status:** Not started
**Priority:** High for research work

**Requirements:**
- **Coordinate display:** Show (x, y, z) on hover
- **Distance measurement:** Click two points → show distance
- **Arc length measurement:** Along curves
- **Curvature at point:** Click surface → show Gaussian/mean curvature
- **Text labels in 3D:**
  - Attach label to point in space
  - Billboard text (always faces camera)
  - Axis labels, point labels
- **Measurement mode toggle:** Enter measurement mode, take measurements, exit

**Architecture:**
```typescript
app.measurements.enable();
app.measurements.distance(point1, point2); // → number
app.measurements.addLabel('Origin', new Vector3(0,0,0));
app.measurements.clear();
```

---

### 6. Performance & Debug Overlay
**Status:** Not started
**Priority:** Essential for development

**Requirements:**
- **Stats panel:** FPS, frame time, draw calls, triangle count
  - Use `stats.js` library or custom implementation
- **Memory monitoring:** Geometries, textures in memory
- **Debug mode toggles:**
  - Show/hide wireframe overlay
  - Show/hide bounding boxes
  - Show/hide normals
  - Show/hide coordinate axes
  - Show/hide grid
  - Show/hide scene graph
- **Performance profiling:**
  - Time rebuild() calls
  - Time update() calls
  - Identify slow operations
- **Keyboard shortcuts for debug toggles**

**IMPORTANT:** This is SEPARATE from main UI (which is for parameters only)

**Architecture:**
```typescript
app.debug.showStats(true);
app.debug.toggleWireframe();
app.debug.showGrid(true);
app.debug.showAxes(true);
app.debug.profile('rebuild', () => surface.rebuild());
```

---

### 7. Colormap System (JS + GLSL)
**Status:** Have basic colormap utilities in algorithms/
**Priority:** High for data visualization

**Requirements:**

**JS Colormaps (for vertex colors):**
- Map scalar values → hex colors
- Presets: viridis, plasma, inferno, magma, turbo, jet, rainbow
- Custom gradients (multi-stop)
- Value normalization (auto min/max or manual range)
- Color scales: linear, logarithmic, custom
- Usage: `colormap.map(0.5, 'viridis')` → `0xff0000`

**GLSL Colormaps (for shaders):**
- Shader functions that map scalars → vec3 RGB
- Same colormap definitions as JS
- Usage in custom shaders: `vec3 color = viridis(curvature);`

**Shared Definitions:**
- JS and GLSL should use same colormap data
- Define colormaps once, generate both JS and GLSL code

**Examples:**
- Color surface by Gaussian curvature
- Color curve by arc length parameter
- Color particles in ODE system by speed

---

### 8. Scene Management & Groups
**Status:** App.add() exists, basic scene graph
**Priority:** High (organizational foundation)

**Requirements:**
- **Smart group management:**
  - Create named groups
  - Parent-child relationships
  - Hierarchical transforms
  - THREE.js Group patterns and best practices
- **Object organization:**
  - Layers (show/hide groups)
  - Object naming (`app.getObject('geodesic1')`)
  - Tags/categories
- **Bulk operations:**
  - Show/hide all in group
  - Apply transform to group
  - Clear group
- **Scene inspection:**
  - List all objects
  - Show scene graph structure
  - Find objects by name/type

**Pain Points to Address:**
- Creating many objects manually and grouping them
- Showing/hiding sets of objects together
- Applying coordinated transforms

**Want to Learn:**
- Better patterns for managing hierarchies
- When to use Groups vs manual management

**Architecture:**
```typescript
// Create group
const group = app.createGroup('geodesics');
app.add(geodesic1, { group: 'geodesics' });
app.add(geodesic2, { group: 'geodesics' });

// Operations on groups
app.groups.show('geodesics');
app.groups.hide('geodesics');
app.groups.applyTransform('geodesics', matrix);

// Access objects
const obj = app.getObject('surface1');
const objs = app.getObjectsByTag('curves');
```

---

### 9. Camera System
**Status:** Basic PerspectiveCamera + OrbitControls
**Priority:** High

**Requirements:**
- **Interactive mode:** OrbitControls ✓ (exists)
- **Programmatic control:**
  - Set position: `app.camera.setPosition(x, y, z)`
  - Look at point: `app.camera.lookAt(x, y, z)`
  - Set FOV, near, far planes
- **Animation mode:**
  - Camera as Animatable object
  - Keyframe animation (position, target, fov)
  - Smooth transitions between positions
  - Camera path following
- **Presets:**
  - Save named camera positions
  - Quick restore: `app.camera.loadPreset('front-view')`
- **Projection modes:**
  - Perspective ✓ (current)
  - Orthographic
- **Smooth transitions:**
  - Animate from current position to target
  - Easing functions

**Architecture Questions:**
- How to switch between interactive and animated?
- Disable OrbitControls during camera animation?
- CameraManager class?

---

### 10. Screenshot System with Metadata
**Status:** Not started
**Priority:** High for research output

**Requirements:**

**Basic Screenshots:**
- Capture current view at canvas resolution
- Download as PNG
- Keyboard shortcut (e.g., 'P' for screenshot)

**High-Resolution Rendering:**
- Render off-screen at any resolution (e.g., 4K, 8K)
- Doesn't affect canvas display
- Use `app.screenshot(4096, 2160)` → render at 4K

**Metadata Embedding:**
- Embed parameter state in PNG metadata
- Include:
  - All Params values
  - Camera position/rotation
  - Render settings
  - Timestamp
  - Git commit hash (if available)
- Ability to recreate exact scene from screenshot

**Formats:**
- PNG (default, supports metadata)
- JPG (lossy, smaller)
- EXR (HDR, for pathtracer output)

**Transparent Background:**
- Option to render with alpha channel
- Useful for compositing

**Architecture:**
```typescript
// Basic
app.screenshot(); // Downloads PNG

// High-res
app.screenshot({ width: 4096, height: 2160 });

// With options
app.screenshot({
  width: 3840,
  height: 2160,
  format: 'png',
  transparent: true,
  filename: 'geodesic-figure-3.png',
  embedMetadata: true
});

// From metadata
app.loadFromScreenshot('geodesic-figure-3.png'); // Restores scene
```

---

### 11. Export Formats (GLTF, OBJ, STL)
**Status:** Not started
**Priority:** Medium-High

**Requirements:**
- **GLTF/GLB export:** Standard 3D format, preserves materials
  - Export entire scene
  - Export selected objects
  - Viewable in many tools
- **OBJ export:** Simple mesh format
  - Good for external tools (Blender, MeshLab)
  - Materials via .mtl file
- **STL export:** For 3D printing
  - Binary STL (compact)
  - ASCII STL (readable)
- **Data export:**
  - CSV: Export curve/surface points
  - JSON: Export parameter state

**Architecture:**
```typescript
app.export.gltf('scene.glb');
app.export.obj('surface.obj');
app.export.stl('model.stl');
app.export.csv(curve.points, 'curve-data.csv');
```

---

## ⚡ TIER 2: Advanced Features (Do Soon - Weeks 5-6)

### 12. Rendering Backend Architecture
**Status:** Currently only standard WebGLRenderer
**Priority:** High (but needs foundation first)

**Requirements:**
- **Support multiple rendering backends:**
  - Standard (THREE.WebGLRenderer) - real-time, interactive ✓
  - Pathtracer (three-gpu-pathtracer) - high-quality offline
- **Backend switching:**
  - `app.setRenderer('pathtracer')` - seamless switch
  - Objects don't know/care which renderer is active
- **Renderer abstraction:**
  - Common interface for both backends
  - Progressive rendering for pathtracer
  - Convergence detection

**Architecture:**
```typescript
interface Renderer {
  render(scene, camera): void;
  setSize(w, h): void;
  screenshot(): Promise<Blob>;
}

class StandardRenderer implements Renderer { ... }
class PathtracerRenderer implements Renderer { ... }

app.setRenderer('pathtracer');
app.renderSettings({ samples: 1000 });
```

**Challenges:**
- Material translation (standard → pathtracer compatible)
- Scene graph compatibility
- Pathtracer-specific features

---

### 13. Pathtracer Integration (three-gpu-pathtracer)
**Status:** Not started
**Priority:** High for final output quality

**Requirements:**
- Integrate `three-gpu-pathtracer` library
- Convert scene to pathtracer-compatible format
- Progressive rendering (samples accumulate)
- Convergence indicator (when to stop)
- Pathtracer-specific materials
- Denoise options (if available)

**Architecture:**
```typescript
app.setRenderer('pathtracer');
app.pathtracer.setSamples(1000);
app.pathtracer.onProgress((samples) => {
  console.log(`Rendered ${samples} samples`);
});
app.pathtracer.render(); // Returns promise when converged
```

---

### 14. Video Export System
**Status:** Not started
**Priority:** Medium-High

**Requirements:**

**Frame-by-Frame Capture:**
- Control animation manually (not real-time)
- Render each frame at specified FPS
- Export PNG sequence
- Options:
  - Resolution (width, height)
  - FPS (24, 30, 60)
  - Duration or frame count
  - Frame padding (001, 002, ...)

**Animation Control:**
- Set time explicitly: `app.setTime(0.5)` → render at t=0.5s
- Step through frames: `app.stepFrame()`
- Playback speed doesn't matter (not real-time)

**External Encoding:**
- Export PNG sequence → user runs ffmpeg
- Provide ffmpeg command in console
- Alternative: Client-side encoding with WASM ffmpeg?

**Architecture:**
```typescript
app.video.export({
  duration: 10,      // seconds
  fps: 60,
  width: 1920,
  height: 1080,
  filename: 'animation'
}); // Downloads frames: animation_001.png, animation_002.png, ...

// Manual control
for (let t = 0; t <= 10; t += 1/60) {
  app.setTime(t);
  await app.screenshot({ filename: `frame_${i}.png` });
}
```

---

### 15. Pathtracer Animation Rendering
**Status:** Not started
**Priority:** Medium (extension of video export)

**Requirements:**
- **Per-frame pathtracing:** Render each frame with pathtracer
- **Long renders:** Each frame might take minutes
- **Convergence control:** Samples per frame or quality threshold
- **Progress tracking:**
  - Current frame number
  - Samples per frame
  - Estimated time remaining
- **Resume capability:** Save state, resume if interrupted
- **Quality settings:** Balance quality vs render time

**This is the ultimate output quality - use for final paper/presentation videos**

**Architecture:**
```typescript
app.video.exportPathtraced({
  duration: 10,
  fps: 30,
  samplesPerFrame: 2000,
  width: 1920,
  height: 1080,
  onProgress: (frame, samples) => {
    console.log(`Frame ${frame}, ${samples} samples`);
  }
});
// This could take hours/days for high quality!
```

---

### 16. Animation Timeline System
**Status:** Basic animate() callbacks exist
**Priority:** Medium

**Requirements:**
- **Playback controls:**
  - Play, pause, stop
  - Reset to start
  - Loop modes (once, loop, ping-pong)
- **Timeline scrubbing:**
  - Drag timeline to any time
  - Click to jump to time
- **Time controls:**
  - Playback speed (0.1x to 10x)
  - Reverse playback
  - Frame-accurate stepping (next frame, prev frame)
- **Time display:**
  - Current time
  - Total duration
  - Frame counter
- **Global clock:**
  - All animatables share same time
  - Can pause time but still move camera

**Architecture:**
```typescript
app.timeline.play();
app.timeline.pause();
app.timeline.setTime(5.0);
app.timeline.setSpeed(0.5); // Slow motion
app.timeline.loop('ping-pong');
app.timeline.step(1); // Step forward 1 frame
```

---

### 17. Beautiful Custom UI
**Status:** Not started
**Priority:** Medium (functional first, beautiful later)

**Requirements:**
- **NOT lil-gui/dat.gui** (too basic/ugly)
- Custom styled, matches visualization aesthetic
- Works with Params system (auto-generates from definitions)
- Responsive, collapsible panels
- Keyboard shortcuts
- Parameter types:
  - Slider (number with min/max)
  - Color picker
  - Dropdown (select from options)
  - Checkbox (boolean)
  - Button (trigger action)
  - Text input
  - Vector input (x, y, z)
- Features:
  - Folders/sections
  - Search parameters
  - Preset saving/loading
  - Hide/show UI (fullscreen mode)
  - Drag to resize
  - Remember position/state

**Technology:**
- Start with custom HTML/CSS/JS
- Can upgrade to React/Svelte later if needed
- Keep it lightweight

**User will provide example UI from another project to copy**

---

## 📋 TIER 3: Future Infrastructure (Later - Weeks 7-8+)

### 18. State Serialization System
**Status:** Not started
**Priority:** Design when system is mature

**Requirements:**
- Save all parameter state to JSON
- Restore exact scene configuration
- Save to file (download JSON)
- Load from file (drag & drop or file picker)
- LocalStorage auto-save
- URL state (parameters in query string)
- Preset system (named configurations)

**Wait until:** We know what needs to be serialized (design when stable)

---

### 19. Asset Pipeline Optimizations
**Status:** Not started
**Priority:** Future optimization

**Ideas to document for later:**
- Texture compression (KTX2)
- Automatic mipmap generation
- Mesh decimation/optimization
- LOD generation
- Asset bundling vs lazy loading
- CDN support

**Wait until:** We have performance issues with assets

---

### 20. Math Infrastructure Decisions
**Status:** Document questions, decide during research
**Priority:** Future (user will handle during research program)

**Questions to document:**
- Coordinate system: Y-up or Z-up? (THREE.js default is Y-up)
- Handedness: Right-handed or left-handed?
- Units: Unit-less or specific units?
- Precision: When to use Float64 vs Float32?
- Tolerance for floating-point comparisons
- Numerical stability strategies

**These are important but user wants to think about them during research**

---

## 🚫 NOT DOING / DEFERRED

### TypeScript Strict Mode
- User explicitly doesn't want this
- Keep types but not strict

### Live Code Editing
- Not needed for workflow
- User edits code in VS Code

### Template Generators
- `npm run create-demo` etc.
- Not needed, manual is fine

### Hot Module Replacement (Beyond Basic)
- Basic Vite HMR is fine
- Don't need fancy stuff

### Social Sharing Features
- Open Graph tags
- Twitter cards
- Embed mode
- Not needed now, maybe future

### Undo/Redo System
- Nice to have but not critical
- Parameter history
- Maybe future

---

## 🎯 Concrete 2-Week Action Plan

### Week 1: Foundation & Interaction

**Days 1-2: Asset Management**
- Create AssetManager class
- Texture loading (wrapper around TextureLoader)
- HDRI loading (RGBELoader, EXRLoader)
- Shader file loading (.glsl)
- Caching system

**Days 3-4: Object Picking & Selection ⭐**
- Raycasting setup
- Click/hover detection
- Selection highlight
- onClick/onHover callbacks
- Integration with UI (show selected params)

**Day 5: Performance/Debug Overlay**
- Stats panel (FPS, draw calls, triangles)
- Debug toggles (wireframe, axes, grid)
- Keyboard shortcuts

---

### Week 2: Scene Management & Colormaps

**Days 6-7: Scene Management & Groups**
- Group utilities (create, manage)
- Object naming/tagging
- Scene inspection
- Better patterns for hierarchies
- Bulk operations (show/hide groups)

**Days 8-9: Colormap System**
- JS colormap utilities (viridis, plasma, etc.)
- GLSL colormap functions (shader code)
- Shared colormap definitions
- Examples: curvature coloring

**Day 10: Measurement Tools**
- Coordinate display on hover
- Distance measurement
- 3D text labels
- Arc length along curves

---

## 📊 Progress Tracking

**Week 1 Deliverables:**
- ✅ Can load textures and HDRIs
- ✅ Can click to select objects
- ✅ Can see FPS and debug info
- ✅ Can toggle wireframe/grid

**Week 2 Deliverables:**
- ✅ Can organize objects in groups
- ✅ Can color surfaces by data (curvature)
- ✅ Can measure distances
- ✅ Can annotate with 3D labels

**Week 3-4:** Camera system, screenshots with metadata, export formats
**Week 5-6:** Pathtracer integration, video export, timeline
**Week 7-8:** Beautiful UI, polish, testing

---

## 🤔 Open Questions to Resolve

### Colormaps
- Should JS and GLSL share exact same definitions?
- How to handle colormap in both vertex colors and shaders?

### Groups
- What are current pain points with THREE.Group usage?
- Specific examples of clunky patterns to improve?

### Measurements
- What specific measurements are most important?
- Arc length? Curvature? Coordinates? Distance?

### Rendering Backend
- Use renderer abstraction or just switch renderers directly?
- How to handle material conversion for pathtracer?

### Video Export
- Client-side encoding (WASM ffmpeg) or just PNG sequence?
- Max resolution? Max frame count?

---

## 💡 Success Criteria

**Before Research Program (2 months):**
- ✅ Can load any texture/HDRI and apply to surfaces
- ✅ Can click on objects and interact with them
- ✅ Can measure distances and curvatures
- ✅ Can organize complex scenes with groups
- ✅ Can color surfaces by mathematical data
- ✅ Can export high-quality screenshots with metadata
- ✅ Can export GLTF models for external tools
- ✅ Can create pathtraced renders for publication
- ✅ Can export video animations
- ✅ Have beautiful, functional UI for all parameters
- ✅ Have comprehensive debug/performance tools
- ✅ System is robust and rarely crashes

**During Research Program:**
- Focus 100% on mathematics
- Infrastructure just works
- No time wasted on boring technical details
- Can quickly prototype new visualizations
- Can produce publication-quality output

**That's the goal! 🎯**
