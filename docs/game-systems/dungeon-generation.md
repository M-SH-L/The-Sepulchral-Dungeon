# Dungeon Generation System

## Overview
Procedural dungeon generation using a room-placement algorithm with corridor carving. Produces a 2D tile grid that drives both 3D scene construction and minimap rendering.

## File
`src/components/game/dungeon-generator.ts`

## Tile Types
```typescript
enum DungeonTile {
    Wall = '#',   // Solid, impassable
    Floor = '.',  // Room interior
    Corridor = ',', // Passageway between rooms
    Exit = 'E',  // (Planned) Dungeon exit tile
}
```

## Algorithm

### 1. Grid Initialization
- Create a `height x width` 2D array filled with `DungeonTile.Wall`
- Default size: 30x30 tiles

### 2. Room Placement
- Attempt to place up to `maxRooms` (default: 15) rooms
- Each room has random dimensions between `minRoomSize` (4) and `maxRoomSize` (8)
- Room position is randomized within grid bounds (leaving a 1-tile border)
- Overlap check: if the new room's bounding box intersects any existing room, it is discarded
- Valid rooms are carved by setting their tiles to `DungeonTile.Floor`

### 3. Corridor Carving
- Each new room is connected to the previously placed room via an L-shaped corridor
- Two corridor segments per connection:
  - Horizontal tunnel (`carveHTunnel`): carves along a row from one room center to the other's X coordinate
  - Vertical tunnel (`carveVTunnel`): carves along a column from one Y to the other
- The order (H-then-V or V-then-H) is randomized 50/50
- Corridor tiles are marked as `DungeonTile.Corridor` (only if the tile is currently a wall)

### 4. Start Position
- The center of the first room placed is guaranteed to be a `Floor` tile
- The player spawns at the first floor tile found scanning top-left to bottom-right

## Room Data Structure
```typescript
interface Room {
    x: number;      // Top-left grid X
    y: number;      // Top-left grid Y
    width: number;  // Room width in tiles
    height: number; // Room height in tiles
}
```

## Current Return Value
```typescript
function generateDungeon(width, height, maxRooms, minRoomSize, maxRoomSize): DungeonTile[][]
```

## Planned Changes
1. **Return rooms array**: Change return to `{ grid: DungeonTile[][], rooms: Room[] }` so other systems can reference room positions
2. **Exit placement**: After all rooms are generated, find the room farthest from room[0] (Manhattan distance between centers) and place `DungeonTile.Exit` at its center
3. **Lore object placement**: 30% chance per room to contain a lore pedestal, placed at the room center or a random floor tile within the room

## World Space Conversion
- Grid position `(gx, gz)` maps to world position `(gx * TILE_SIZE, 0, gz * TILE_SIZE)`
- `TILE_SIZE = 5` world units per tile
- Walls are `BoxGeometry(5, 3.5, 5)` centered at `(gx*5, 1.75, gz*5)`
- Floors are `PlaneGeometry(5, 5)` at Y=0

## Edge Cases
- If no rooms are generated (extremely unlikely), a single floor tile is placed at grid center
- Rooms cannot touch the grid border (1-tile wall buffer on all sides)
- Corridors only carve through walls, preserving existing floor tiles
