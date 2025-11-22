# Safe Rebuild Pattern

## The Problem

When rebuilding geometry or materials in response to parameter changes, the order of operations matters.

### ❌ **Unsafe Pattern**

```typescript
private rebuild(): void {
  const newGeometry = this.buildGeometry();
  this.mesh.geometry.dispose();  // ❌ Dispose BEFORE swap
  this.mesh.geometry = newGeometry;
}
```

**Why this is dangerous:**

1. **If `buildGeometry()` throws an error**, you've already disposed the old geometry
2. **The mesh is now in a broken state** with no geometry
3. **No way to recover** - the old geometry is gone
4. **Race conditions** - if render happens between dispose and assign, mesh is broken

### ✅ **Safe Pattern**

```typescript
private rebuild(): void {
  const newGeometry = this.buildGeometry();
  const oldGeometry = this.mesh.geometry;
  this.mesh.geometry = newGeometry;  // ✅ Swap FIRST
  oldGeometry.dispose();             // ✅ Dispose AFTER
}
```

**Why this is safe:**

1. ✅ Build new geometry first (can fail safely)
2. ✅ If build succeeds, swap immediately (atomic operation)
3. ✅ Only dispose old geometry after successful swap
4. ✅ Mesh is never in a broken state
5. ✅ No race conditions

---

## General Rule

**"Swap first, dispose after"**

Always follow this order:
1. Create/build new resource
2. Store reference to old resource
3. Swap in new resource
4. Dispose old resource

---

## Examples

### Geometry Rebuild

```typescript
class ParametricSurface {
  private rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.mesh.geometry;
    this.mesh.geometry = newGeometry;
    oldGeometry.dispose();
  }
}
```

### Material Swap

```typescript
class CustomMesh {
  changeMaterial(newMaterialOptions: MaterialOptions): void {
    const newMaterial = this.buildMaterial(newMaterialOptions);
    const oldMaterial = this.mesh.material;
    this.mesh.material = newMaterial;
    oldMaterial.dispose();
  }
}
```

### Texture Update

```typescript
class TexturedObject {
  updateTexture(url: string): void {
    const loader = new THREE.TextureLoader();
    loader.load(url, (newTexture) => {
      const oldTexture = this.material.map;
      this.material.map = newTexture;
      this.material.needsUpdate = true;
      oldTexture?.dispose();
    });
  }
}
```

---

## Error Handling

The safe pattern also makes error handling cleaner:

```typescript
private rebuild(): void {
  let newGeometry: THREE.BufferGeometry;

  try {
    newGeometry = this.buildGeometry();
  } catch (error) {
    console.error('Failed to rebuild geometry:', error);
    return;  // ✅ Old geometry still intact
  }

  // Only swap if build succeeded
  const oldGeometry = this.mesh.geometry;
  this.mesh.geometry = newGeometry;
  oldGeometry.dispose();
}
```

With the unsafe pattern, you'd have to rebuild the old geometry if the new one failed - much more complex!

---

## When to Use This Pattern

Use "swap first, dispose after" whenever:
- ✅ Rebuilding geometry in response to parameter changes
- ✅ Swapping materials dynamically
- ✅ Updating textures
- ✅ Any operation where a resource is being replaced

**Don't worry about it for:**
- ❌ Final cleanup (dispose() method at end of life)
- ❌ Removing objects entirely (not replacing)

---

## Performance Consideration

**Question:** "Won't there be a brief moment with both geometries in memory?"

**Answer:** Yes, but:
1. It's extremely brief (nanoseconds)
2. Modern GC handles this fine
3. The alternative (broken mesh) is far worse
4. This is standard practice in resource management

---

## Real-World Scenario

Imagine a user rapidly changing a slider:

```typescript
helix.segments = 100;  // User moves slider
helix.segments = 200;  // Keeps moving
helix.segments = 150;  // And moving
```

### Unsafe Pattern:
```
segments = 100 → dispose old → build new (100) → assign ✓
segments = 200 → dispose old → build new (200) → assign ✓
segments = 150 → dispose old → build new (150) FAILS → ❌ NO GEOMETRY!
```

### Safe Pattern:
```
segments = 100 → build new (100) → swap → dispose old ✓
segments = 200 → build new (200) → swap → dispose old ✓
segments = 150 → build new (150) FAILS → ✓ Still have old geometry!
```

---

## Checklist

When writing a rebuild method:

- [ ] Build new resource first
- [ ] Store reference to old resource
- [ ] Swap new resource into place
- [ ] Dispose old resource last
- [ ] Consider error handling
- [ ] Test with rapid parameter changes

---

## See Also

- **ParametricCurve.ts** - Reference implementation
- **Component Lifecycle** - When rebuilds happen
- **Three.js Memory Management** - When to dispose
