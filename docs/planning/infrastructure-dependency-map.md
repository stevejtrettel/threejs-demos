# Infrastructure Dependency Map

**Organized by what depends on what, not arbitrary weeks**

All infrastructure from original requirements, grouped so we build foundations before things that depend on them.

---

## 🏗️ Layer 1: Foundation (No Dependencies)

These can be built independently and are needed by everything else.

### Asset Management System
**Dependencies:** None
**Needed by:** Materials, Shaders, Environments, Export

- Load textures (PNG, JPG, EXR)
- Load HDRI environment maps
- Load GLTF/GLB models
- Load shader files (.glsl)
- Asset caching and cleanup
- Progress tracking

**Files:** `src/app/AssetManager.ts`

---

### Performance & Debug Overlay
**Dependencies:** None (separate system)
**Needed by:** Development workflow

- FPS and stats panel (stats.js or custom)
- Debug toggles (wireframe, grid, axes, normals, bboxes)
- Performance profiling (time function calls)
- Keyboard shortcuts
- Memory monitoring

**Files:** `src/app/DebugManager.ts`

**IMPORTANT:** This is SEPARATE from main UI (ParameterManager)

---

## 🎨 Layer 2: Visual Systems (Depends on Assets)

These need AssetManager but are independent of each other.

### Material & Shader System
**Dependencies:** AssetManager
**Needed by:** All visual objects, Colormaps

- Texture support on materials (UV maps, normal maps, etc.)
- Custom shader materials
  - Load .glsl files via AssetManager
  - Uniform management
  - Integration with Params
- Shader examples:
  - Curvature colormap shader
  - Normal-based coloring
  - Data-driven vertex coloring

**Files:**
- Update `src/materials/Materials.ts`
- `src/shaders/` directory
- `src/shaders/curvature.vert.glsl`
- `src/shaders/curvature.frag.glsl`

---

### Environment Maps & Backgrounds
**Dependencies:** AssetManager
**Needed by:** Beautiful renders

- HDRI environment loading (via AssetManager)
- Image-based lighting (IBL) setup
- Background options:
  - Solid color ✓
  - Gradient ✓
  - HDRI environment
  - Custom texture
- Environment intensity/rotation control

**Files:** Update `src/app/BackgroundManager.ts`

---

### Colormap System
**Dependencies:** None (pure algorithms)
**Needed by:** Shaders, Data visualization

**Two implementations (separate but visually consistent):**

**JS Colormaps:**
- Map scalar → hex color
- Presets: viridis, plasma, inferno, magma, turbo, jet, rainbow
- Value normalization (auto or manual range)
- Color scales (linear, log, custom)
- Multi-stop gradients

**GLSL Colormaps:**
- Shader functions: `vec3 viridis(float t)`
- Same visual output as JS
- For data-driven coloring in shaders

**Files:**
- `src/algorithms/colormaps.ts` (or enhance existing)
- `src/shaders/colormaps.glsl`

---

## 🖱️ Layer 3: Interaction Systems (Independent)

These don't depend on visual systems, can be built in parallel.

### Object Picking & Selection ⭐ CRUCIAL
**Dependencies:** None (just raycasting)
**Needed by:** Measurements, UI integration

- Raycasting system (THREE.Raycaster)
- Click detection → select object
- Hover detection → highlight
- Multi-selection (Ctrl+click)
- Selection highlighting (outline or emissive)
- Callbacks: `object.onClick(point)`, `object.onHover(point)`
- Integration with UI (show selected object's params)

**Files:** `src/app/InteractionManager.ts`

---

### Scene Management & Groups
**Dependencies:** None (organizational system)
**Needed by:** Complex scenes

**Hierarchical Naming:**
- Path-based: `app.add(obj, { path: 'scene1/surfaces/torus' })`
- Access: `app.getObject('scene1/surfaces/torus')`

**Tags/Layers:**
- Cross-hierarchy: `app.add(obj, { tags: ['animated', 'geodesic'] })`
- Get by tag: `app.getByTag('animated')`

**Operations:**
- `app.showSubtree('scene1/surfaces')` - all descendants
- `app.hideSubtree('scene1')`
- `app.transformSubtree('scene1', matrix)`

**Scene Inspection:**
- `app.listObjects()`
- `app.printSceneGraph()`

**Files:** Enhance `src/app/App.ts` or create `src/app/SceneManager.ts`

---

### Measurement Tools (Basic)
**Dependencies:** Picking system (to select points)
**Needed by:** Research workflow

- Coordinate display on hover
- Distance between two clicked points
- 3D text labels (billboard text)
- Measurement mode toggle

**Future (later):**
- Arc length along curves
- Curvature at point
- Angle measurement

**Files:** `src/app/MeasurementManager.ts`

---

## 📷 Layer 4: Camera & Capture (Independent)

These are self-contained systems.

### Camera System
**Dependencies:** None
**Needed by:** Screenshots, Video

**Positioning API:**
- `app.camera.setPosition(x, y, z)`
- `app.camera.lookAt(x, y, z)`
- `app.camera.setFOV(degrees)`

**Presets:**
- Save/load named positions
- Built-in: 'top', 'front', 'side', 'isometric'

**Animation:**
- Smooth transitions: `await app.camera.flyTo(pos, target, duration)`
- Keyframe animation (camera as Animatable)
- Integration with timeline

**Modes:**
- Interactive (OrbitControls) ✓
- Programmatic (controls disabled)
- Perspective / Orthographic

**Files:** `src/app/CameraManager.ts`

---

### Screenshot System with Metadata ⭐
**Dependencies:** Camera (to get state for metadata)
**Needed by:** Publication workflow

**Basic:**
- `app.screenshot()` → downloads PNG
- Keyboard shortcut (P)
- Formats: PNG, JPEG, WebP

**High-Resolution:**
- Off-screen rendering at any resolution
- `app.screenshot({ width: 4096, height: 2160 })`
- Doesn't affect visible canvas

**Transparent Background:**
- `app.screenshot({ transparent: true })`

**Metadata Embedding:**
- Embed all Params in PNG metadata (tEXt chunk)
- Include camera state, timestamp, git hash
- `app.loadFromScreenshot(file)` → restore exact scene

**Files:** Enhance `src/app/App.ts` or create `src/app/ScreenshotManager.ts`

---

## 📦 Layer 5: Export Systems (Depends on Scene)

### Export Formats (GLTF, OBJ, STL, CSV)
**Dependencies:** Scene graph
**Needed by:** External tools, 3D printing

- **GLTF/GLB:** `app.export.gltf('model.glb')`
  - Preserves materials, textures, hierarchy
  - Three.js GLTFExporter
- **OBJ:** `app.export.obj('model.obj')`
  - With .mtl for materials
  - Three.js OBJExporter
- **STL:** `app.export.stl('model.stl')`
  - For 3D printing
  - Binary or ASCII
  - Three.js STLExporter
- **CSV:** `app.export.csv(data, 'points.csv')`
  - For curve/surface data
- **JSON:** Parameter state, scene graph

**Files:** `src/app/ExportManager.ts`

---

## 🎬 Layer 6: Animation & Time (Depends on Camera)

### Animation Timeline System
**Dependencies:** None (but integrates with camera)
**Needed by:** Video export

**Playback:**
- Play/pause/stop
- Loop modes (once, loop, ping-pong)
- Speed control (-10x to +10x, including reverse)
- Keyboard: Space = play/pause

**Scrubbing:**
- `app.timeline.setTime(5.0)` - jump to time
- Frame stepping (arrow keys)
- Scrub bar (drag to time)

**Display:**
- Time / duration
- Frame counter
- Progress bar

**Global Clock:**
- All animatables share same time
- Freeze time but allow camera movement

**Files:** `src/app/TimelineManager.ts`

---

### Video Export (PNG Sequence)
**Dependencies:** Timeline, Screenshot
**Needed by:** Animation output

**Frame-by-Frame:**
- Manual time control (not real-time)
- `app.video.export({ duration: 10, fps: 60 })`
- Downloads: frame_001.png, frame_002.png, ...

**Options:**
- Resolution, FPS, start/end times
- Progress tracking
- Cancel ability

**Post-Processing:**
- Provide ffmpeg command for MP4 encoding
- Optional: WASM ffmpeg (client-side encoding)

**Files:** `src/app/VideoExportManager.ts`

---

## 🌟 Layer 7: Advanced Rendering (Complex Dependencies)

### Rendering Backend Architecture
**Dependencies:** All visual systems (scene, materials, lights)
**Needed by:** Pathtracer

**Renderer Abstraction:**
```typescript
interface Renderer {
  render(scene, camera): void;
  setSize(w, h): void;
  screenshot(): Promise<Blob>;
}
```

**Implementations:**
- StandardRenderer (wrap current WebGLRenderer)
- PathtracerRenderer (three-gpu-pathtracer)

**Switching:**
- `app.setRenderer('standard' | 'pathtracer')`
- Seamless transition
- Material/light translation if needed

**Files:**
- `src/rendering/Renderer.ts` (interface)
- `src/rendering/StandardRenderer.ts`
- `src/rendering/PathtracerRenderer.ts`

---

### Pathtracer Integration
**Dependencies:** Renderer abstraction, Materials
**Needed by:** High-quality renders

- Install three-gpu-pathtracer
- Initialize pathtracer
- Progressive rendering (sample accumulation)
- Convergence detection
- Material conversion (standard → pathtracer)

**Controls:**
- Samples (100 = preview, 2000+ = production)
- Bounces (light bounces, 3-8 typical)
- Resolution

**Files:** Implement `src/rendering/PathtracerRenderer.ts`

---

### Pathtracer Animation
**Dependencies:** Pathtracer, Video Export, Timeline
**Needed by:** Publication-quality animations

**Per-Frame Pathtracing:**
- Render each frame to convergence
- High samples per frame (slow!)
- Progress: overall + per-frame
- Resume capability (save state)

**Warning:** Can take hours/days for high quality

**Files:** Enhance `src/app/VideoExportManager.ts`

---

## 🎨 Layer 8: User Interface (Depends on Everything)

### Custom UI System
**Dependencies:** ParameterManager, Timeline, Camera, Export, Debug
**Needed by:** User interaction

**NOT lil-gui - custom HTML/CSS/JS**

**Components:**
- Slider (number with min/max)
- Color picker
- Dropdown (select)
- Checkbox (boolean)
- Button (action)
- Text input
- Vector input (x, y, z)

**Structure:**
- Collapsible panels/folders
- Auto-generate from Params
- Search/filter parameters
- Responsive, resizable

**Integration:**
- Auto-generate from all registered Params
- Selection → show object's params
- Timeline controls
- Camera presets
- Export buttons
- Debug toggles (optional)

**Presets:**
- Save/load parameter state
- Named presets
- Export/import JSON

**Keyboard Shortcuts:**
- H: Hide/show UI
- Tab/Enter/Esc: Navigation
- Ctrl+F: Search

**Files:**
- `src/ui/` directory
- `src/ui/UI.ts`
- `src/ui/components/*.ts`
- `src/ui/styles.css`

**User will provide example UI to copy/adapt**

---

## 📊 Dependency Graph

```
Layer 1 (Foundation):
  AssetManager ────────┐
  DebugManager         │
                       │
Layer 2 (Visual):      │
  Materials ←──────────┘
  Environments ←───────┘
  Colormaps

Layer 3 (Interaction):
  Picking ──────────┐
  Groups            │
  Measurements ←────┘

Layer 4 (Camera):
  Camera ────────┐
  Screenshots ←──┘

Layer 5 (Export):
  Formats (GLTF/OBJ/STL)

Layer 6 (Animation):
  Timeline ──────┐
  Video ←────────┴─────← Screenshots

Layer 7 (Advanced):
  Renderer Abstraction ←── Materials
  Pathtracer ←─────────────┘
  Pathtracer Animation ←─── Timeline + Video + Pathtracer

Layer 8 (UI):
  Custom UI ←─── Everything
```

---

## 🎯 Build Order Recommendation

**Phase 1: Core Infrastructure**
1. AssetManager
2. DebugManager
3. Materials & Shaders
4. Environments
5. Colormaps

**Phase 2: Interaction**
6. Picking & Selection ⭐
7. Groups & Hierarchies
8. Basic Measurements

**Phase 3: Capture & Export**
9. Camera System
10. Screenshots with Metadata
11. Export Formats (GLTF/OBJ/STL)

**Phase 4: Animation**
12. Timeline System
13. Video Export

**Phase 5: Advanced Rendering**
14. Renderer Abstraction
15. Pathtracer Integration
16. Pathtracer Animation

**Phase 6: Polish**
17. Custom UI (integrate everything)
18. Testing & Bug Fixes
19. Documentation & Examples

---

## ✅ Complete Feature List

Everything from original requirements:

### Assets & Loading
- ✓ Load textures (UV maps)
- ✓ Load HDRIs
- ✓ Load models (GLTF/GLB)
- ✓ Load shaders (.glsl files)

### Materials & Rendering
- ✓ Custom shader materials
- ✓ Texture support
- ✓ Uniform management
- ✓ HDRI environments
- ✓ Environmental lighting (IBL)
- ✓ Beautiful backgrounds

### Interaction
- ✓ Object picking (click/hover)
- ✓ Selection system
- ✓ Measurement tools

### Organization
- ✓ Hierarchical groups
- ✓ Path-based access
- ✓ Tags/layers
- ✓ Scene management

### Data Visualization
- ✓ Colormap system (JS + GLSL)
- ✓ Data-driven coloring

### Camera & Capture
- ✓ Camera control (position, animate)
- ✓ Camera presets
- ✓ Screenshots (regular + high-res)
- ✓ Screenshot metadata (save/load state)
- ✓ Transparent backgrounds

### Export
- ✓ GLTF/GLB export
- ✓ OBJ export
- ✓ STL export (3D printing)
- ✓ CSV/JSON export

### Animation
- ✓ Timeline controls
- ✓ Playback (play/pause/scrub)
- ✓ Speed control
- ✓ Video export (frame sequence)

### Advanced Rendering
- ✓ Pathtracer integration (three-gpu-pathtracer)
- ✓ Dual rendering backends
- ✓ Pathtracer animation (frame-by-frame)

### Development
- ✓ Performance overlay (FPS, stats)
- ✓ Debug tools (wireframe, grid, etc.)
- ✓ Keyboard shortcuts

### UI
- ✓ Beautiful custom UI (not lil-gui)
- ✓ All parameter types
- ✓ Integration with all systems
- ✓ Preset system

### Extension System
- ? Maybe organize as core + extensions
- ? Or just good module organization
- Decision: Start with modules, add plugins if needed

---

## 🚀 Ready to Start?

We have:
- ✅ All requirements captured
- ✅ Dependencies mapped
- ✅ Build order clear
- ✅ No rigid timeline, just logical grouping

**Start with Phase 1 (Core Infrastructure)?**
- AssetManager first (foundation)
- Then Materials/Shaders
- Then Environments
- Then Colormaps

**Or jump to Phase 2 (Interaction)?**
- Picking is CRUCIAL
- Can build independently
- Get user interaction working early

**Your call!**
