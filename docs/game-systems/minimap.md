# Minimap System

## Overview
An 11x11 tile grid HUD element in the top-right corner showing the dungeon layout around the player. Uses fog-of-war to hide unexplored areas.

## File
`src/components/game/minimap.tsx` (159 lines)

## Props
```typescript
interface MinimapProps {
    dungeon: DungeonTile[][];
    playerX: number;              // Player grid X coordinate
    playerZ: number;              // Player grid Z coordinate
    viewRadius: number;           // Tiles shown around player (default: 5)
    tileSize: number;             // World tile size (for orb grid conversion)
    interactableObjects: InteractableObjectData[];
    discoveredTiles: Set<string>; // Set of "x,z" keys
    getTileKey: (x: number, z: number) => string;
    isPlayerLightOut: boolean;    // Light at 0%
}
```

## Grid Construction

### Viewport
- `mapSize = viewRadius * 2 + 1 = 11` tiles
- Centered on the player's current grid position
- Shows a sliding window over the full dungeon

### Tile Content Types
```typescript
type MinimapTileContent =
    | DungeonTile.Wall     // Brown
    | DungeonTile.Floor    // Light sepia
    | DungeonTile.Corridor // Muted sepia
    | 'P'                  // Player (green)
    | 'Os'                 // Small orb (light yellow)
    | 'Om'                 // Medium orb (yellow)
    | 'Ol'                 // Large orb (orange)
    | 'U'                  // Undiscovered (black)
```

### Population Algorithm
1. For each cell in the 11x11 grid:
   - Calculate the corresponding world grid position
   - If not in `discoveredTiles` → mark as `'U'`
   - If discovered and in bounds → use the dungeon tile type
   - If discovered and out of bounds → treat as Wall
2. Overlay interactable objects:
   - Filter to visible, unused orbs at matching grid position
   - Mark tile with largest orb size found (`'Os'`, `'Om'`, `'Ol'`)
   - Skip the player's tile (player marker takes priority)
3. Place player marker `'P'` at grid center `[viewRadius][viewRadius]`

## Fog of War

### Discovery
- Managed in the animation loop (to be extracted to `fog-of-war.ts`)
- Discovery radius: 2 tiles around the player
- When player enters a new grid tile, all tiles within radius are added to `discoveredTiles`
- `discoveredTiles` is a `Set<string>` using keys like `"5,12"`
- Once discovered, tiles remain visible permanently (no re-fogging)

### getTileKey Function
```typescript
const getTileKey = (x: number, z: number) => `${x},${z}`;
```

## Visual Styling

### Tile Colors
| Tile | Class | Description |
|------|-------|-------------|
| Floor | `bg-secondary/60` | Light sepia, hover brightens |
| Corridor | `bg-muted/60` | Muted sepia, hover brightens |
| Wall | `bg-primary/70` | Dark brown, hover brightens |
| Player | `bg-green-500 animate-pulse` | Green with pulse animation |
| Small Orb | `bg-yellow-200 border-yellow-400` | Light yellow |
| Medium Orb | `bg-yellow-400 border-yellow-600` | Medium yellow |
| Large Orb | `bg-orange-400 border-orange-600` | Orange |
| Undiscovered | `bg-black/50` | Semi-transparent black |

### Light-Out State
When `isPlayerLightOut = true`:
- Player marker: `bg-green-900 opacity-60` (dimmed, no pulse)
- Orb indicators: `opacity-50`, no pulse animation
- Other tiles unchanged (already discovered)

### Layout
- CSS Grid: `repeat(11, 10px)` columns and rows, 1px gap
- Each tile: `10px x 10px`, `rounded-sm`
- Container: `absolute top-4 right-4`, semi-transparent background, border, shadow
- `z-10` to sit above the 3D canvas
- `pointer-events: auto` (has hover tooltips)

### Tooltips
Each tile has a `title` attribute showing:
- Player: `"Player at (x, z)"` + light status
- Orbs: `"Small/Medium/Large Light Source at (x, z)"` + dimmed status
- Terrain: `"Floor/Corridor/Wall at (x, z)"`
- Undiscovered: `"Undiscovered"`

## Planned Changes
1. Add exit tile type `'X'` — gold with pulse animation, always visible once discovered
2. Add lore object tile type — distinct icon/color, dim when read
3. Optimize: avoid creating new Set on every discovery (use Zustand with immer or direct mutation)
4. Consider scaling minimap on mobile (responsive tile size)
