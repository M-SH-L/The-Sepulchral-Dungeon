# Interaction System

## Overview
Allows the player to approach objects in the dungeon and interact with them via the Enter key. Currently only light orbs exist (auto-collected on proximity). The planned lore object system adds manual Enter-key interaction with scroll popup UI.

## Files
- Planned: `src/lib/game/interaction-system.ts`
- Planned: `src/lib/game/lore-manager.ts`
- Planned: `src/components/game/ScrollPopup.tsx`

## Current State
- Light orbs are auto-collected when within `COLLECTION_DISTANCE = 1.5` units
- No Enter-key interaction exists yet
- Blueprint specifies: "detect when the player approaches placeholder objects and display relevant text information in a scroll pop-up on the screen when the enter key is pressed"

## Planned: Lore Object System

### Lore Data Model
```typescript
interface LoreEntry {
    id: number;
    title: string;      // e.g., "Fragment of the Builder's Journal"
    text: string;        // Multi-paragraph lore text
}

interface LoreObjectData {
    id: number;
    entry: LoreEntry;
    mesh: THREE.Group;   // Pedestal + scroll meshes
    light: THREE.PointLight;
    gridX: number;
    gridZ: number;
    read: boolean;       // Has the player read this already?
}
```

### Lore Content
10-15 static entries themed around dungeon lore:
- Builder's journal fragments (who built this place and why)
- Warning inscriptions (dangers ahead)
- Poems/riddles (atmospheric flavor)
- Explorer's notes (previous adventurers)
- Historical records (what happened here)

### Placement Rules
- One lore object per room maximum
- 30% chance for each room to contain one
- Placed at the room's center tile (or nearest floor tile)
- Never placed in corridors
- Lore entries assigned randomly without replacement

### Visual Design
- **Pedestal:** `CylinderGeometry(0.3, 0.3, 0.8)` with dark stone material
- **Scroll:** `BoxGeometry(0.4, 0.1, 0.2)` on top with parchment-colored emissive material
- **Light:** Dim `PointLight(0xddccaa, 0.3, TILE_SIZE)` — subtler than orbs
- No hover/pulse animation (static, dignified)

### Interaction Flow
1. **Detection (per frame):** Find all lore objects within 2.0 units of player
2. **Prompt:** If any in range and none currently open, show HUD text: "Press [Enter] to read"
3. **Open:** On Enter keypress with a lore object in range:
   - Set `activeLoreId` in game store
   - Pause player movement (input handler skips movement keys when popup open)
   - Play lore-open sound
4. **Display:** `ScrollPopup.tsx` renders the lore entry
5. **Close:** On Enter or Escape keypress while popup is open:
   - Clear `activeLoreId`
   - Mark lore object as `read: true`
   - Resume player movement
   - Play lore-close sound

### ScrollPopup.tsx Design
- Full-screen overlay with semi-transparent backdrop
- Centered content panel styled as aged parchment:
  - Background gradient: warm beige/tan
  - Border: decorative double border in dark brown
  - Drop shadow for depth
- Title in bold serif-style font
- Body text with comfortable line-height
- Footer: "Press Enter or Escape to close"
- Fade-in/fade-out animation

### Minimap Integration
- Lore objects shown as distinct tile type on minimap
- Unread: bright indicator with subtle glow
- Read: dimmed indicator
- Not shown if not yet discovered (fog of war)

### Controls Display Update
Add to the controls list:
```
[ Enter ] : Interact / Read
[ Esc ]   : Close Popup
```
