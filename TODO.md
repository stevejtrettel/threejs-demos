# Project TODOs

Active development tasks and future enhancements for the Three.js framework.

---

## BackgroundManager

### Future Enhancements

- [ ] **Disposal tracking** - Track all generated envMaps for proper cleanup
  - Currently `createEnvironmentFromScene()` doesn't track generated textures
  - Could lead to memory leaks if generating many environments
  - Solution: Add `disposeEnvironment(envMap)` method or auto-disposal

- [ ] **Dynamic environment updates** - Update scene-based environments without full regeneration
  - Add `updateEnvironmentFromScene(envScene, existingEnvMap, options)` method
  - Reuses existing texture to avoid allocation churn
  - Useful for animated/dynamic environments

- [ ] **Convenience API** - Add `backgroundBlurriness` option to other methods
  - Currently only in `createEnvironmentFromScene()` and standalone `setBackgroundBlurriness()`
  - Consider adding to `loadHDR()`, `setSky()`, etc. for convenience
  - Low priority - `setBackgroundBlurriness()` already works for all backgrounds

---

## SelectionManager

### Future Enhancements

- [ ] **Multi-selection** - Ctrl+click to select multiple objects
  - Add to selection set instead of replacing
  - Highlight all selected objects
  - Bulk operations on selection

- [ ] **Dragging system** - Click and drag objects with position parameters
  - Drag along camera plane (screen-space 2D drag)
  - Constrain to specific axis (X, Y, Z)
  - Constrain to custom planes
  - Snap to grid option
  - Integration with Params (update position parameters)

- [ ] **Better highlighting** - More advanced visual feedback
  - Outline shader (post-processing)
  - Emissive glow effect
  - Configurable highlight colors
  - Different styles for hover vs selection

- [ ] **Keyboard shortcuts** - Quick selection controls
  - Escape to deselect
  - Delete/Backspace to remove selected object
  - Arrow keys to cycle through objects
  - Tab to select next object

- [ ] **Transform gizmos** - Visual manipulation tools
  - Position gizmo (translate)
  - Rotation gizmo
  - Scale gizmo
  - Integration with Params for undo/redo

- [ ] **Params integration** - Auto-expose selected object parameters
  - When object selected, show its params in UI
  - Two-way binding (UI changes update object)
  - Save/load parameter presets per object type

---

## DebugManager

### Future Enhancements

- [ ] **Custom stats panel position** - Allow positioning stats panel (top-left, top-right, bottom-left, bottom-right)
  - Currently fixed at top-left
  - Add `app.debug.setStatsPosition('top-right')`

- [ ] **GPU stats** - Add GPU memory and shader compilation info
  - Shader programs count
  - GPU memory usage (if WebGL extension available)
  - Texture memory breakdown by resolution

- [ ] **Frame time graph** - Visual graph of frame times over last 2 seconds
  - Like Chrome DevTools performance graph
  - Shows FPS spikes and drops visually
  - Color-coded: green (60fps), yellow (30-60fps), red (<30fps)

- [ ] **Helper size controls** - Adjust helper sizes after creation
  - `app.debug.setNormalSize(0.5)` to resize existing normal helpers
  - `app.debug.setGridSize(20)` to resize grid
  - `app.debug.setAxesSize(10)` to resize axes

- [ ] **Selective helpers** - Apply helpers to specific objects only
  - `app.debug.showNormals(specificMesh)` instead of all meshes
  - `app.debug.showBoundingBox(specificObject)`
  - Useful for debugging single objects in complex scenes

- [ ] **Custom colors** - Configurable helper colors
  - Wireframe color (currently green)
  - Normal helper color (currently green)
  - Bounding box color (currently yellow)

- [ ] **Performance history** - Track stats over time
  - Store FPS history for longer than 2 seconds
  - Export performance data to CSV
  - Detect performance regressions

---

## GroupManager

### Future Enhancements

- [ ] **Layer system** - THREE.js layers integration for selective rendering
  - `app.groups.setLayer('group1', 5)` sets layer for all objects in group
  - Camera can render only specific layers
  - Useful for multi-pass rendering, post-processing effects

- [ ] **Group templates** - Save and load group configurations
  - `app.groups.saveTemplate('visualization', 'myTemplate')`
  - `app.groups.loadTemplate('myTemplate')` recreates group structure
  - Useful for complex scenes with standard layouts

- [ ] **Bulk material operations** - Apply materials to entire groups
  - `app.groups.setMaterial('group1', newMaterial)`
  - `app.groups.setWireframe('group1', true)`
  - `app.groups.setOpacity('group1', 0.5)`

- [ ] **Animation helpers** - Animate group properties
  - `app.groups.animatePosition('group1', targetPos, duration)`
  - `app.groups.animateRotation('group1', targetRot, duration)`
  - Integration with animation system (when built)

- [ ] **Query system** - Advanced object queries
  - `app.groups.query({ type: 'Mesh', material: { color: 0xff0000 } })`
  - `app.groups.query({ tags: ['parametric', 'minimal'] })` (AND logic)
  - `app.groups.queryOr({ tags: ['surface', 'curve'] })` (OR logic)

- [ ] **Group cloning** - Duplicate entire groups
  - `app.groups.clone('original', 'copy')`
  - Clones all objects in group (deep copy)
  - Useful for symmetry, repetition patterns

- [ ] **Bounding box helpers** - Get bounds for entire group
  - `const box = app.groups.getBoundingBox('group1')`
  - Useful for camera framing, collision detection

---

## Other Systems

*(Add sections for other systems as we work on them)*
