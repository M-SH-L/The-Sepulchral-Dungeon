# Player Movement System

## Overview
First-person movement using WASD + arrow keys. The player exists as a position + rotation in world space, with the Three.js camera attached at eye level.

## Files
- Movement logic: `src/components/game/game.tsx` (to be extracted to `src/lib/game/player-controller.ts`)
- Input handling: inline in `game.tsx` (to be extracted to `src/lib/game/input-handler.ts`)
- Collision: inline in `game.tsx` (to be extracted to `src/lib/game/collision.ts`)

## Controls
| Key | Action |
|-----|--------|
| W | Move forward |
| S | Move backward |
| Arrow Left | Rotate left |
| Arrow Right | Rotate right |
| Enter | Interact (planned) |

Strafing (A/D) is commented out but scaffolded in the code.

## Movement Constants
```
PLAYER_HEIGHT = 1.7        // Player collision cylinder height
PLAYER_RADIUS = 0.3        // Player collision cylinder radius
CAMERA_EYE_LEVEL = 1.53    // PLAYER_HEIGHT * 0.9
MOVE_SPEED = 3.5            // Units per second
ROTATION_SPEED = PI/3       // Radians per second (~60 deg/s)
COLLECTION_DISTANCE = 1.5   // Distance to collect orbs
```

## Movement Logic (per frame)
1. Read input state from refs (`moveForward`, `moveBackward`, `rotateLeft`, `rotateRight`)
2. Get camera's world forward direction, project onto XZ plane, normalize
3. Calculate `nextPos = currentPos + direction * moveSpeed * delta`
4. Run collision check against dungeon grid
5. If no collision: update player position
6. If collision: discard movement, no light decay for this frame
7. Apply rotation: accumulate `playerRotationY` and set camera quaternion

## Collision Detection
```typescript
isWallCollision(position: Vector3, dungeonMap: DungeonTile[][]): boolean
```

### Algorithm
1. For each of the 8 neighboring grid directions (excluding center):
   - Offset the player position by `PLAYER_RADIUS` in that direction
   - Convert to grid coordinates: `Math.floor(worldPos / TILE_SIZE + 0.5)`
   - Check if out of bounds → collision
   - Check if tile is `DungeonTile.Wall` → AABB overlap test with player radius
2. Return `true` on first collision found

### Known Issues
- The grid coordinate conversion on line 471-472 uses a different formula than the rest of the code. The `Math.sign` offset is inconsistent and may cause edge-case collision misses near tile (0,0).
- Sliding along walls is not implemented — movement is binary (full or blocked). A wall-sliding system would project the movement vector along the wall normal.

## Camera Setup
- `PerspectiveCamera(75, aspect, 0.1, 1000)`
- Position tracks `playerPosition.x/z` at `CAMERA_EYE_LEVEL` height
- Rotation is quaternion-based, Y-axis only (no pitch/tilt)

## Light Interaction
- Movement distance is tracked per frame
- Light decays: `lightDuration -= distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED`
- If movement was blocked by collision, `distanceMoved = 0` (no light cost)

## Planned Improvements
1. Extract to `player-controller.ts` as a pure update function
2. Read all state from Zustand store instead of React state/refs
3. Add wall sliding (project movement along wall normal on collision)
4. Pause movement when lore popup is open (`activeLoreId !== null`)
