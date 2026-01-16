# DOF Implementation - Technical Debt

## Current Status: HACK (Working)

The Depth of Field implementation in `RenderManager.ts` currently uses a hack to directly manipulate internal path tracer uniforms.

## The Hack

```typescript
// In RenderManager.applyDOFSettings()
const pt = this.pathTracer as any;
const uniforms = pt._pathTracer?.material?.uniforms?.physicalCamera?.value;

if (uniforms) {
    uniforms.bokehSize = bokehSize;
    uniforms.focusDistance = focusDistance;
    uniforms.apertureBlades = apertureBlades;
}
```

### Why It's a Hack
- `_pathTracer` is a private/internal property (underscore prefix)
- Directly accessing `material.uniforms.physicalCamera.value` bypasses the library's public API
- Could break with any update to `three-gpu-pathtracer`

### Why We're Using It
The "proper" approach of setting properties on a PhysicalCamera and letting the path tracer read them via `updateFrom(camera)` wasn't working. The blur was either invisible or extremely faint.

## The Proper Solution (TODO)

The correct architecture should be:

1. **Use PhysicalCamera from three-gpu-pathtracer**
   ```typescript
   import { PhysicalCamera } from 'three-gpu-pathtracer';
   const camera = new PhysicalCamera(fov, aspect, near, far);
   ```

2. **Set DOF properties directly on the camera**
   ```typescript
   camera.fStop = 2.8;
   camera.focusDistance = 5.0;
   camera.apertureBlades = 6;
   ```

3. **Path tracer reads via updateFrom()**
   - During `renderSample()`, path tracer calls `updateFrom(camera)`
   - `PhysicalCameraUniform.updateFrom()` checks `camera instanceof PhysicalCamera`
   - If true, copies: `bokehSize`, `focusDistance`, `apertureBlades`, etc.

### Why It's Not Working (Investigation Needed)

Possible causes:
1. **Timing**: Properties set after path tracer already read them
2. **Camera instance mismatch**: Path tracer may cache its own camera reference from `setScene()`
3. **bokehSize calculation**: `bokehSize = focalLength / fStop` may produce values too small for visible blur (shader multiplies by `0.5 * 1e-3`)
4. **updateFrom() not being called**: The sync might not happen every frame

### To Fix Properly

1. Verify the camera passed to `render()` is the same PhysicalCamera instance
2. Check if `updateFrom()` is called during `renderSample()`
3. Investigate if `setScene()` needs to be called again when camera properties change
4. Test if calling `pathTracer.reset()` forces a re-read of camera properties
5. Consider if the bokehSize multiplier (`* 10`) should be applied via fStop manipulation instead

## Files Involved

- `src/app/RenderManager.ts` - DOF settings and hack location
- `demos/test/pathtracer/pathtracer-mesh-evolver.ts` - Demo using PhysicalCamera
- `node_modules/three-gpu-pathtracer/src/objects/PhysicalCamera.js` - Camera class
- `node_modules/three-gpu-pathtracer/src/uniforms/PhysicalCameraUniform.js` - Uniform sync logic

## Affected Demos

- `pathtracer-mesh-evolver` - Currently uses this DOF system

## Risk Assessment

- **Low risk** for now: The internal API structure is unlikely to change drastically
- **Medium risk** on library updates: Should test DOF after any `three-gpu-pathtracer` version bump
- **Mitigation**: The hack is isolated to one method (`applyDOFSettings`), easy to fix when proper solution is found
