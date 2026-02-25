# Math Library Demos

Demonstrations of the mathematical visualization library (`src/math/`).

## Demos

### 1. `surface-demo.ts` - Parametric Surfaces

**What it demonstrates:**
- Creating a `Torus` primitive with reactive parameters
- Wrapping it in a `SurfaceMesh` component
- Automatic reactivity: changing surface parameters rebuilds the mesh
- Visual parameters (color, roughness, segments)

**Key concepts:**
- Primitives: Pure mathematical objects (Torus)
- Components: Scene objects (SurfaceMesh)
- Reactive parameters: Changes propagate automatically

**Run it:**
```bash
npm run dev demos/math/surface-demo.ts
```

**What you'll see:**
- A torus that smoothly morphs as parameters animate
- Color cycles through the spectrum
- Mesh automatically rebuilds when torus shape changes

---

### 2. `geodesics-demo.ts` - Geodesics on Surfaces

**What it demonstrates:**
- Geodesic integration on a curved surface
- Multiple geodesics flowing from a single point
- How "straight lines" behave on curved surfaces

**Key concepts:**
- Geodesics: The "straightest possible" paths on surfaces
- Geodesic equation integration using RK4
- Christoffel symbols computed from surface metric

**Run it:**
```bash
npm run dev demos/math/geodesics-demo.ts
```

**What you'll see:**
- 8 geodesics launching from a point in different directions
- Semi-transparent torus surface
- Geodesics flow along the surface following curved paths
- Trails reset every 20 seconds

**Mathematical note:**
Geodesics never "turn" from their own perspective - they're locally straight.
But from our external viewpoint in 3D space, they appear to curve because
the surface itself is curved!

---

## Code Structure

Both demos follow a simple pattern:

```typescript
import { App } from '@/app/App';
import { Torus, SurfaceMesh, GeodesicTrail } from '@/math';

// Create app
const app = new App({ antialias: true, debug: true });

// Set up scene
app.camera.position.set(0, 4, 10);
app.lights.set('three-point');

// Create mathematical objects
const torus = new Torus({ R: 2, r: 1 });
const mesh = new SurfaceMesh(torus, { color: 0x4488ff });
app.scene.add(mesh);

// Animate
app.addAnimateCallback((time, delta) => {
  // Animation logic
});

// Start
app.start();
```

---

## Customization Ideas

**Surface demo:**
- Try different surfaces (implement `Helicoid`, `Sphere`, etc.)
- Add UI controls for parameters
- Experiment with different materials (wireframe, glass, metal)
- Add normal vector visualization

**Geodesics demo:**
- Change starting point and velocities
- Try different surfaces (geodesics on sphere, helicoid, etc.)
- Adjust integration step size for accuracy vs. performance
- Add more geodesics or change colors
- Implement geodesic "respawn" at random points

---

## Next Steps

These demos showcase the core math library. To extend:

1. **Add more surfaces:** Implement `Helicoid`, `Sphere`, `Catenoid`, etc.
2. **Add curves:** Create the curves domain with helices, Lissajous curves
3. **Add helpers:** Implement `withNormals`, `withBoundary` decorators
4. **Add materials:** Create curvature visualization shaders
5. **Interactive demos:** Add UI panels for real-time parameter control

See `src/math/README.md` for the full architecture and implementation guide.
