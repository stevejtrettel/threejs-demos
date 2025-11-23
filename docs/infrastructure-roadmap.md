# Infrastructure Roadmap

**Goal:** Production-ready research visualization framework for mathematical objects

**Timeline:** ~2 months until research program

**Priority:** Rock-solid infrastructure over mathematical features

---

## 🎯 Core Systems Overview

### 1. Asset Management System
**Purpose:** Load and manage textures, HDRIs, models, shaders

**Features:**
- Texture loading (PNG, JPG, EXR)
- HDRI environment map loading
- GLTF/GLB model loading
- Shader code loading (vertex/fragment)
- Asset caching and lifecycle
- Progress tracking for large assets

**Architecture Questions:**
- Centralized AssetManager vs per-object loading?
- Preload all vs lazy load on demand?
- How to handle asset disposal when objects removed?

**Dependencies:** None (foundational)

---

### 2. Material & Shader System
**Purpose:** Support both preset materials and custom shaders

**Features:**
- Current Materials.ts presets (plastic, metal, glass, etc.)
- Custom shader materials (THREE.ShaderMaterial)
- Shader code management (where do .glsl files live?)
- Uniform management (passing parameters to shaders)
- Texture binding to materials
- Material switching at runtime

**Architecture Questions:**
- How do custom shaders integrate with parameter system?
- Should shaders be "math objects" or "materials"?
- Hot-reloading shaders during development?

**Dependencies:** Asset Management (for texture/shader loading)

---

### 3. Rendering Architecture
**Purpose:** Support multiple rendering backends seamlessly

**Backends:**
1. **Standard** (THREE.WebGLRenderer) - real-time, interactive
2. **Pathtracer** (three-gpu-pathtracer) - high-quality offline

**Key Challenge:** Objects shouldn't know/care which renderer is active

**Features:**
- Backend switching (standard ↔ pathtracer)
- Render settings per backend
- Progressive pathtracer rendering
- Convergence detection for pathtracer

**Architecture Questions:**
- Does App.renderer become an abstraction?
- How do we handle pathtracer-specific materials?
- Can we use same scene graph for both?

**Dependencies:** Asset Management, Material System

---

### 4. Environment & Background System
**Purpose:** Professional backgrounds and lighting environments

**Features:**
- Solid colors (current)
- Gradients (current)
- HDRI environment maps
- Image-based lighting (IBL)
- Custom skybox textures
- Background blur/bokeh effects

**Architecture:**
- Extend BackgroundManager with environment support
- Link to rendering system (IBL needs proper setup)

**Dependencies:** Asset Management (HDRI loading), Rendering Architecture

---

### 5. Camera System
**Purpose:** Flexible camera control - manual and animated

**Features:**
- **Interactive mode:** OrbitControls (current)
- **Programmatic mode:** Set position, lookAt, fov
- **Animation mode:** Camera as Animatable object
  - Keyframe animation
  - Path following
  - Smooth transitions
- **Presets:** Save/restore camera positions
- **Projection modes:** Perspective (current), Orthographic

**Architecture Questions:**
- How do we switch between interactive and animated?
- Should there be a CameraManager?
- How do keyframes work with parameter system?

**Dependencies:** None (relatively independent)

---

### 6. Screenshot & Export System
**Purpose:** Save images and videos of visualizations

**Features:**

**Screenshots:**
- Capture current view (canvas resolution)
- High-resolution render (off-screen, any resolution)
- Transparent background option
- Format: PNG, JPG, EXR (HDR)

**Video:**
- Frame-by-frame capture during animation
- Configurable FPS, resolution, duration
- Format: PNG sequence → ffmpeg → MP4
- Progress indicator

**Pathtracer Export:**
- Per-frame pathtracing (long renders)
- Convergence threshold per frame
- Resume interrupted renders

**Architecture Questions:**
- Should export be part of App or separate module?
- How do we render off-screen at higher resolution?
- Client-side video encoding or PNG sequence export?

**Dependencies:** Rendering Architecture (needs to work with both backends)

---

### 7. UI System
**Purpose:** Beautiful, professional interface for parameters and controls

**Requirements:**
- NOT lil-gui/dat.gui (too basic)
- Custom styled, matches visualization aesthetic
- Works with Params system
- Responsive, collapsible panels
- Keyboard shortcuts

**Technology Options:**
1. **Custom HTML/CSS/JS** - full control, integrates with Params
2. **React** - component-based, lots of libraries
3. **Svelte** - lightweight, reactive
4. **Vue** - middle ground

**Features:**
- Auto-generate UI from Params definitions
- Folders/sections
- Parameter types: slider, color, dropdown, checkbox, button
- Real-time preview
- Preset saving/loading
- Hide/show UI (fullscreen mode)

**Architecture Questions:**
- Should UI be in same package or separate?
- How tightly coupled to Params system?
- Build system implications (bundling)?

**Dependencies:** None for basic version, everything for full version

---

### 8. Extension/Plugin System
**Purpose:** Keep core clean, allow optional features

**Question:** Do we actually need this, or just good module organization?

**Arguments FOR:**
- Pathtracer is huge dependency, not everyone needs it
- Different researchers need different features
- Keeps bundle size manageable

**Arguments AGAINST:**
- Adds complexity
- User is primary developer (not a library for others yet)
- Can just use ES modules and tree-shaking

**Recommendation:** Start with good module organization, add plugin system later if needed

**Structure:**
```
src/
  core/          # Always included
  extensions/    # Optional features
    pathtracer/
    video-export/
    advanced-ui/
```

**Dependencies:** All systems (this is meta-architecture)

---

## 📋 Implementation Priority

### Phase 1: Asset & Rendering Foundation (Week 1-2)
**Goal:** Load textures, HDRIs, support custom shaders

1. **Asset Management**
   - Create AssetManager class
   - Texture loading (TextureLoader wrapper)
   - HDRI loading (RGBELoader, EXRLoader)
   - Asset caching

2. **Material System Enhancement**
   - Texture support in Materials.ts
   - Custom shader material utilities
   - Shader file loading system

3. **Environment System**
   - HDRI environment maps
   - Image-based lighting setup
   - Background from environment

**Deliverable:** Can load and apply textures, use HDRI lighting

---

### Phase 2: Camera & Export (Week 3)
**Goal:** Camera control and screenshot export

1. **Camera System**
   - CameraManager (positions, presets)
   - Animation support (camera as Animatable)
   - Smooth transitions

2. **Screenshot Export**
   - Basic screenshot (current resolution)
   - High-res off-screen rendering
   - Transparent background support

**Deliverable:** Can position camera, save high-res images

---

### Phase 3: Rendering Architecture (Week 4-5)
**Goal:** Integrate pathtracer, dual rendering backend

1. **Rendering Abstraction**
   - Design renderer interface
   - Implement standard backend (current)
   - Implement pathtracer backend (three-gpu-pathtracer)

2. **Backend Switching**
   - Seamless scene translation
   - Material translation (standard → pathtracer)
   - Progressive rendering for pathtracer

**Deliverable:** Can switch between real-time and pathtraced rendering

---

### Phase 4: Advanced Export (Week 6)
**Goal:** Video export, pathtracer animation

1. **Video Export**
   - Frame-by-frame capture
   - Animation timeline control
   - PNG sequence export

2. **Pathtracer Animation**
   - Per-frame pathtracing
   - Convergence control
   - Progress tracking

**Deliverable:** Can export animated videos, pathtraced animations

---

### Phase 5: UI & Polish (Week 7-8)
**Goal:** Professional UI, final touches

1. **UI System**
   - Choose technology (custom vs framework)
   - Design aesthetic
   - Implement parameter controls
   - Keyboard shortcuts

2. **Integration & Testing**
   - Ensure all systems work together
   - Performance profiling
   - Documentation
   - Example demos

**Deliverable:** Production-ready framework

---

## 🔧 Technical Architecture Decisions Needed

### Decision 1: Asset Management Architecture

**Option A: Centralized AssetManager**
```typescript
const assets = app.assets;
const texture = await assets.loadTexture('path/to/texture.png');
const hdri = await assets.loadHDRI('path/to/env.hdr');
```

**Option B: Per-Object Loading**
```typescript
const surface = new ParametricSurface(fn, {
  texture: 'path/to/texture.png'  // Loaded automatically
});
```

**Recommendation:** Option A for explicit control, with Option B as syntactic sugar

---

### Decision 2: Rendering Backend Architecture

**Option A: Renderer Abstraction**
```typescript
interface Renderer {
  render(scene, camera): void;
  setSize(w, h): void;
  screenshot(): Promise<Blob>;
}

class StandardRenderer implements Renderer { ... }
class PathtracerRenderer implements Renderer { ... }

app.setRenderer('pathtracer');  // Switch backends
```

**Option B: Dual Renderer**
```typescript
app.standardRenderer = new THREE.WebGLRenderer(...);
app.pathtracerRenderer = new WebGLPathTracer(...);

app.renderWith('pathtracer');  // Use specific renderer
```

**Recommendation:** Option A for clean abstraction

---

### Decision 3: UI Technology

**Option A: Custom HTML/CSS/JS** (like three.js examples)
- Pros: Lightweight, full control, no build complexity
- Cons: More code to write, no component system

**Option B: React** (modern, popular)
- Pros: Component-based, rich ecosystem, easy state management
- Cons: Build setup, larger bundle, framework lock-in

**Option C: Vanilla Web Components** (standards-based)
- Pros: No framework, native, reusable
- Cons: More verbose, less tooling

**Recommendation:** Start with Option A (custom), can always upgrade to framework later

---

### Decision 4: Shader Management

**Where do shader files live?**

**Option A: src/shaders/ directory**
```
src/
  shaders/
    vertex/
      basic.vert.glsl
    fragment/
      toon.frag.glsl
```

**Option B: Inline strings** (current THREE.js approach)
```typescript
const vertexShader = `
  varying vec3 vNormal;
  void main() { ... }
`;
```

**Option C: Shader objects**
```typescript
const shader = new Shader({
  vertex: 'shaders/custom.vert',
  fragment: 'shaders/custom.frag',
  uniforms: { ... }
});
```

**Recommendation:** Option C (using Option A for file organization)

---

## 🚀 Next Steps

1. **Review this roadmap** - does this match your vision?
2. **Make architecture decisions** - choose options for each decision point
3. **Start Phase 1** - implement asset management and material system
4. **Iterate** - adjust plan as we learn

**Timeline Check:**
- 8 weeks of infrastructure work
- 2 months until research program
- Perfect timing if we start now!

---

## 📝 Open Questions

1. **Build system:** Are we using Vite? Does it support .glsl imports?
2. **Path tracer fork:** Use three-gpu-pathtracer as-is or fork/customize?
3. **Video encoding:** Client-side (WASM ffmpeg) or export frames for external encoding?
4. **Deployment:** Is this local-only or will it be web-hosted?
5. **Browser support:** Target latest Chrome only or broader compatibility?

---

## 💡 Future Considerations (Post-Research Program)

- Collaborative features (share scenes, parameters)
- VR/AR support (THREE.js has WebXR)
- GPU compute for math (custom shaders for simulation)
- Real-time collaboration (multiplayer parameter tweaking)
- Publishing platform (gallery of visualizations)

But these are nice-to-haves, not blockers for research!
