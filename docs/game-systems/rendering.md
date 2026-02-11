# Rendering System

## Overview
Three.js WebGL rendering of the 3D dungeon environment. Handles scene setup, geometry construction, lighting, shadow mapping, and the render loop.

## Files
- Current: `src/components/game/game.tsx` lines 230-306, 350-358 (to be extracted to `src/lib/game/renderer.ts` and `src/lib/game/scene-builder.ts`)

## Three.js Setup

### Renderer
```typescript
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### Camera
```typescript
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.y = CAMERA_EYE_LEVEL; // 1.53
```
- FOV: 75 degrees
- First-person: camera position tracks player X/Z
- Y-axis rotation only (no pitch)

### Scene
- Background: `0x000000` (pure black — creates the "consumed by darkness" effect)
- No fog currently (could add distance fog for atmosphere)

## Geometry Construction

### Current Approach (Unoptimized)
```typescript
dungeon.forEach((row, z) => {
    row.forEach((tile, x) => {
        if (tile === Wall) {
            const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
            wallMesh.position.set(x * TILE_SIZE, WALL_HEIGHT / 2, z * TILE_SIZE);
            scene.add(wallMesh);
        } else {
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.position.set(x * TILE_SIZE, 0, z * TILE_SIZE);
            scene.add(floorMesh);
        }
    });
});
```

**Problem:** 900 tiles = 900 individual meshes = 900 draw calls. GPU state changes dominate render time.

### Planned: Geometry Batching
```typescript
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collect all wall geometries with their transforms
const wallGeometries: THREE.BufferGeometry[] = [];
dungeon.forEach((row, z) => {
    row.forEach((tile, x) => {
        if (tile === Wall) {
            const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
            geo.translate(x * TILE_SIZE, WALL_HEIGHT / 2, z * TILE_SIZE);
            wallGeometries.push(geo);
        }
    });
});

const mergedWalls = mergeGeometries(wallGeometries);
const wallMesh = new THREE.Mesh(mergedWalls, wallMaterial);
wallMesh.castShadow = true;
wallMesh.receiveShadow = true;
scene.add(wallMesh);
// Dispose individual geometries after merge
wallGeometries.forEach(g => g.dispose());
```

**Result:** ~2 draw calls (walls + floors) instead of ~900. Massive GPU performance improvement.

### Materials
| Surface | Color | Type |
|---------|-------|------|
| Walls | `0x6c5d53` | MeshStandardMaterial (receives light + shadow) |
| Floors | `0x8b7e75` | MeshStandardMaterial (lighter sepia) |
| Ceiling | `0x5a4d41` | MeshStandardMaterial (DoubleSide) |

### Ceiling
- Single large `PlaneGeometry(width * TILE_SIZE, height * TILE_SIZE)`
- Rotated horizontal, positioned at `WALL_HEIGHT = 3.5`
- Centered over the dungeon grid

## Lighting

### Current (Unoptimized)
- 1 player `PointLight` (shadow-casting)
- ~54-135 orb `PointLight` instances (non-shadow-casting)
- No ambient light

**Problem:** WebGL forward rendering handles ~8 point lights efficiently. 135+ lights cause significant frame drops.

### Planned (Optimized)
- 1 player `PointLight` (shadow-casting) — unchanged
- 1 exit portal `PointLight` (non-shadow-casting) — new
- 1 `AmbientLight(0x111111)` — prevents pure-black dead zones
- 0 orb lights — replaced with emissive-only materials
- ~5 lore object `PointLight` instances (very dim, non-shadow-casting)
- **Total: ~8 lights** (within optimal range)

### Shadow Configuration
```
Player light shadow:
  - mapSize: 1024 x 1024
  - near: 0.5
  - far: MAX_PLAYER_LIGHT_DISTANCE * 1.2
  - bias: -0.005
  - type: PCFSoftShadowMap
```

## Resize Handling
```typescript
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## Render Loop Integration
- Called once per `requestAnimationFrame` tick
- `renderer.render(scene, camera)` at the end of each frame
- Scene renders even during intro/gameover (shows the dungeon behind overlays)

## Planned Module Split

### `renderer.ts`
- `createRenderer(container: HTMLElement): THREE.WebGLRenderer`
- `createCamera(): THREE.PerspectiveCamera`
- `createScene(): THREE.Scene`
- `setupResizeHandler(camera, renderer): () => void` (returns cleanup)
- `dispose(renderer, scene): void`

### `scene-builder.ts`
- `buildDungeon(scene, dungeon): void` — walls, floors, ceiling (batched)
- `buildExit(scene, exitX, exitZ): THREE.Group` — exit portal visual
- `buildLoreObject(scene, x, z): THREE.Group` — pedestal + scroll

## Performance Targets
| Metric | Current | Target |
|--------|---------|--------|
| Draw calls | ~900 | ~10 |
| Point lights | ~135 | ~8 |
| Shadow maps | 1 | 1 |
| Frame rate | Variable | Stable 60fps |
