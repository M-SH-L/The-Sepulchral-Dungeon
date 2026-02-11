# Sepia Dungeon Explorer - Implementation Guide

Step-by-step build order. Each phase must be verified before moving to the next.

---

## Phase 1: Bug Fixes

### Step 1.1: Fix light-meter.tsx syntax error
**File:** `src/components/game/light-meter.tsx`
- Remove the stray markdown backticks (```) on line 62 (after `export default LightMeter;`)
- **Verify:** File ends cleanly after the export statement

### Step 1.2: Add missing `cn` import
**File:** `src/components/game/game.tsx`
- Add `import { cn } from '@/lib/utils';` to the import block (after line 4)
- **Verify:** `cn()` call in `IntroScreen` component resolves correctly

### Step 1.3: Fix keyboard listener memory leak
**File:** `src/components/game/game.tsx`
- Move `handleKeyDown`/`handleKeyUp` function definitions into the main setup `useEffect` (the one starting at line 172)
- Add `window.removeEventListener` calls for both in the cleanup return
- Simplify `startGame()` callback to only toggle phase state (no listener setup)
- **Verify:** Opening DevTools > Performance > Event Listeners shows no accumulating keydown/keyup handlers after multiple game starts

### Step 1.4: Fix stale closure on playerPosition
**File:** `src/components/game/game.tsx`
- Convert `playerPosition` from `useState` to `useRef<THREE.Vector3>`
- Add a separate `playerPositionRef` for the animation loop
- Add throttled state updates for HUD components (playerGridPos for minimap)
- **Verify:** Player movement works correctly — position updates each frame, not stuck at initial position

### Step 1.5: Fix animation loop dependency array
**File:** `src/components/game/game.tsx`
- Change the animation `useEffect` dependency array to `[]`
- Read all values from refs instead of closures
- Keep a single `THREE.Clock` instance that doesn't get recreated
- **Verify:** No console warnings about missing deps; smooth 60fps; no jittering from loop recreation

### Step 1.6: Full verification
```bash
npm run build    # Must pass with zero errors
npm run dev      # Game loads, intro shows, Enter starts, movement works
```

---

## Phase 2: Dependency Cleanup

### Step 2.1: Remove unused npm packages
```bash
npm uninstall @genkit-ai/googleai @genkit-ai/next genkit firebase \
  @tanstack-query-firebase/react @tanstack/react-query \
  @hookform/resolvers react-hook-form zod \
  recharts react-day-picker date-fns patch-package lucide-react \
  @radix-ui/react-accordion @radix-ui/react-alert-dialog \
  @radix-ui/react-avatar @radix-ui/react-checkbox \
  @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-menubar @radix-ui/react-popover \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slider \
  @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip

npm uninstall -D genkit-cli
```

### Step 2.2: Delete unused source files
- Delete `src/ai/` directory entirely
- Delete unused shadcn UI component files from `src/components/ui/`:
  - Keep: `button.tsx`, `toast.tsx`, `toaster.tsx`, `dialog.tsx`
  - Delete all others (accordion, alert-dialog, alert, avatar, badge, calendar, card, chart, checkbox, dropdown-menu, form, input, label, menubar, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, tooltip)

### Step 2.3: Clean up package.json scripts
- Remove `genkit:dev` and `genkit:watch` scripts

### Step 2.4: Add new dependencies
```bash
npm install zustand
npm install -D vitest @testing-library/react jsdom @playwright/test
```

### Step 2.5: Verify
```bash
npm run build   # Must still pass
npm run dev     # Game still works identically
```

---

## Phase 3: Refactor - Module Extraction

### Step 3.1: Create constants and types
**Create:** `src/lib/game/constants.ts`
- Move all `const` declarations from `game.tsx` (PLAYER_HEIGHT, MOVE_SPEED, TILE_SIZE, etc.)
- Export everything as named exports

**Create:** `src/lib/game/types.ts`
- Define and export: `OrbData`, `LoreObjectData`, `GamePhase`, `OrbSize`
- Re-export `DungeonTile`, `Room` from dungeon-generator

### Step 3.2: Create Zustand store
**Create:** `src/lib/game/game-store.ts`
- Implement the full `GameStore` interface (see `docs/game-systems/state-management.md`)
- Export `useGameStore` hook and direct store access

### Step 3.3: Extract collision system
**Create:** `src/lib/game/collision.ts`
- Extract `isWallCollision(position, dungeonMap)` as a pure function
- Import constants from `constants.ts`
- **Test:** Write `collision.test.ts` immediately (pure function, easy to test)

### Step 3.4: Extract input handler
**Create:** `src/lib/game/input-handler.ts`
- `setupInputListeners(): () => void` (returns cleanup function)
- Reads keypresses, writes to Zustand store `keys` field
- Handles movement refs (forward, backward, rotate)

### Step 3.5: Extract light system
**Create:** `src/lib/game/light-system.ts`
- `calculateLightProperties(lightDuration, maxDuration) => { intensity, distance }`
- `calculateLightDecay(distanceMoved, decayRate) => number`
- Pure math functions, no Three.js dependency

### Step 3.6: Extract fog of war
**Create:** `src/lib/game/fog-of-war.ts`
- `discoverNearbyTiles(gridX, gridZ, radius, discovered) => string[]`
- Returns array of new tile keys to add
- Pure function, no side effects

### Step 3.7: Extract scene builder
**Create:** `src/lib/game/scene-builder.ts`
- `buildDungeon(scene, dungeon)` — creates batched wall/floor/ceiling geometry
- Uses `BufferGeometryUtils.mergeGeometries()` for batching
- Returns references needed for cleanup

### Step 3.8: Extract orb manager
**Create:** `src/lib/game/orb-manager.ts`
- `spawnOrbs(scene, dungeon)` — creates orb meshes with emissive materials (no point lights)
- `animateOrbs(orbs, time)` — pulse and hover animation
- `tryCollectOrbs(playerPos, orbs, distance)` — collection detection

### Step 3.9: Extract player controller
**Create:** `src/lib/game/player-controller.ts`
- `updatePlayer(delta, camera, store)` — reads input, calculates movement, checks collision, updates store

### Step 3.10: Extract renderer
**Create:** `src/lib/game/renderer.ts`
- `createRenderer(container)`, `createCamera()`, `createScene()`
- `setupResizeHandler(camera, renderer)` — returns cleanup
- `dispose(renderer, scene)`

### Step 3.11: Extract game loop
**Create:** `src/lib/game/game-loop.ts`
- `startGameLoop(renderer, scene, camera) => () => void` (returns stop function)
- Calls all per-frame systems: player controller, light system, orb animation, fog of war, interaction checks, sound ambient update, render

### Step 3.12: Rewrite Game.tsx
**Rewrite:** `src/components/game/Game.tsx`
- Thin shell: one `useEffect` to init renderer + game loop
- JSX: mount div + HUD overlays (minimap, light meter, controls, popups)
- Target: ~100 lines

### Step 3.13: Extract UI components
**Create:** `src/components/game/IntroScreen.tsx` — extracted from inline component
**Create:** `src/components/game/GameOverOverlay.tsx` — extracted from inline JSX

### Step 3.14: Verify
```bash
npm run build
npm run dev     # Game must play identically to pre-refactor
```

---

## Phase 4: Performance Optimizations

### Step 4.1: Geometry batching
- Implement in `scene-builder.ts` (done during Step 3.7)
- Merge wall geometries into single mesh
- Merge floor geometries into single mesh
- **Verify:** Open DevTools > Three.js inspector (or log `renderer.info.render.calls`), confirm ~2-10 draw calls

### Step 4.2: Remove orb point lights
- In `orb-manager.ts`, create orbs with emissive-only materials
- Remove all `new THREE.PointLight()` for orbs
- Add one `THREE.AmbientLight(0x111111)` to scene
- **Verify:** Orbs still visually glow; scene lighting looks correct; frame rate improves

### Step 4.3: Verify performance
- Test on a 30x30 dungeon with ~54 orbs
- Target: stable 60fps on mid-range hardware
- Check memory usage: no growing allocations over time

---

## Phase 5: New Features

### Step 5.1: Dungeon exit
1. Update `dungeon-generator.ts`:
   - Add `DungeonTile.Exit = 'E'`
   - Return `{ grid, rooms }` object
   - Place exit in farthest room from room[0]
2. Update `scene-builder.ts`:
   - Build exit visual (glowing archway) at exit tile
3. Update `game-loop.ts`:
   - Check player grid position against exit each frame
   - Transition to 'win' phase on match
4. Create `WinScreen.tsx`:
   - Victory message, stats (time, orbs collected), Play Again button
5. Update `minimap.tsx`:
   - Add `'X'` tile type with gold pulsing style
6. **Verify:** Generate dungeon, navigate to exit, win screen appears

### Step 5.2: Lore objects
1. Create `lore-manager.ts`:
   - Define 10-15 lore entries
   - `spawnLoreObjects(scene, rooms, dungeon)` — places pedestals in rooms
2. Create `interaction-system.ts`:
   - Per-frame proximity check for lore objects
   - Enter key handler for opening/closing popups
3. Create `ScrollPopup.tsx`:
   - Parchment-styled overlay with lore title + text
   - Enter/Escape to close
4. Update `input-handler.ts`:
   - Skip movement keys when `activeLoreId !== null`
   - Handle Enter key for interaction
5. Update `controls-display.tsx`:
   - Add Enter and Escape key descriptions
6. Update `minimap.tsx`:
   - Add lore object tile type
7. **Verify:** Find a lore pedestal, press Enter, popup shows, Escape closes, movement resumes

### Step 5.3: Sound system
1. Create `sound-manager.ts`:
   - Implement `SoundManager` interface (see `docs/game-systems/sound-system.md`)
   - Procedural audio generation for all sounds
2. Wire triggers:
   - `player-controller.ts` → `playFootstep()` (throttled)
   - `orb-manager.ts` → `playOrbCollect(size)`
   - `interaction-system.ts` → `playLoreOpen()` / `playLoreClose()`
   - `game-loop.ts` → `playGameOver()` / `playWin()`
   - `game-loop.ts` → `setAmbientVolume(lightRatio)` each frame
3. Init in `Game.tsx` → `startGame()` callback
4. **Verify:** All sounds play at correct triggers; ambient volume changes with light

---

## Phase 6: Testing

### Step 6.1: Configure Vitest
**Create:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
```
Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Step 6.2: Write unit tests
Create test files alongside source files in `src/lib/game/`:
1. `dungeon-generator.test.ts`
2. `collision.test.ts`
3. `light-system.test.ts`
4. `fog-of-war.test.ts`
5. `interaction-system.test.ts`
6. `player-controller.test.ts`
7. `game-store.test.ts`
8. `sound-manager.test.ts`

See `docs/game-systems/` files for specific test scenarios per module.

### Step 6.3: Set up Playwright E2E
```bash
npx playwright install
```
**Create:** `e2e/game-flow.spec.ts`
- Expose `window.__gameStore` in dev mode
- Test all 8 scenarios (see master plan Phase 6.2)

### Step 6.4: Generate test log
**Create:** `test-results/game-test-log.md`
- Auto-generated from test runner output
- Add npm script: `"test:log": "vitest run --reporter=verbose 2>&1 | tee test-results/game-test-log.md"`

### Step 6.5: Verify
```bash
npx vitest run          # All unit tests pass
npx playwright test     # All E2E scenarios pass
```

---

## Phase 7: Documentation & Polish

### Step 7.1: Game system docs
Already created in `docs/game-systems/` (8 files). Update any that changed during implementation.

### Step 7.2: Update README
Replace the generic Firebase Studio readme with actual game documentation:
- Game description and screenshot
- How to run (`npm run dev`)
- Controls
- Architecture overview
- How to test

### Step 7.3: Update checklist
Update `docs/CHECKLIST.md` with final status of all items.

### Step 7.4: Final play-through
- Play the full game start to finish
- Verify all mechanics work together
- Check for visual glitches, sound timing, edge cases
