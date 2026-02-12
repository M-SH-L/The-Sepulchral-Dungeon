# Sepia Dungeon Explorer - Progress Checklist

## Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Phase 1: Bug Fixes
- [x] 1.1 Fix `light-meter.tsx` stray backticks (line 62)
- [x] 1.2 Add missing `cn` import to `game.tsx`
- [x] 1.3 Fix keyboard listener memory leak (moved to useEffect scope)
- [x] 1.4 Fix stale closure on `playerPosition` (converted to useRef)
- [x] 1.5 Fix animation loop dependency array (use refs instead of state)
- [x] 1.6 Full build + runtime verification

## Phase 2: Dependency Cleanup
- [x] 2.1 Remove unused npm packages (~20 packages)
- [x] 2.2 Delete `src/ai/` directory
- [x] 2.3 Delete unused shadcn UI components
- [x] 2.4 Remove unused package.json scripts
- [x] 2.5 Install new dependencies (zustand, vitest, playwright)
- [x] 2.6 Verify build passes after cleanup

## Phase 3: Refactor - Module Extraction
- [x] 3.1 Create `src/lib/game/constants.ts`
- [x] 3.2 Create `src/lib/game/types.ts`
- [x] 3.3 Create `src/lib/game/game-store.ts` (Zustand)
- [x] 3.4 Extract `src/lib/game/collision.ts`
- [x] 3.5 Extract `src/lib/game/input-handler.ts`
- [x] 3.6 Extract `src/lib/game/light-system.ts`
- [x] 3.7 Extract `src/lib/game/fog-of-war.ts`
- [x] 3.8 Extract `src/lib/game/scene-builder.ts` (with batching)
- [x] 3.9 Extract `src/lib/game/orb-manager.ts`
- [x] 3.10 Extract `src/lib/game/player-controller.ts`
- [x] 3.11 Extract `src/lib/game/renderer.ts`
- [x] 3.12 Extract `src/lib/game/game-loop.ts`
- [x] 3.13 Rewrite `Game.tsx` as thin shell
- [x] 3.14 Extract `IntroScreen.tsx`
- [x] 3.15 Extract `GameOverOverlay.tsx`
- [x] 3.16 Verify game plays identically post-refactor

## Phase 4: Performance Optimizations
- [ ] 4.1 Geometry batching (walls + floors merged)
- [ ] 4.2 Remove orb point lights (emissive-only)
- [ ] 4.3 Add ambient light
- [ ] 4.4 Verify 60fps on 30x30 dungeon

## Phase 5: New Features

### 5.1 Dungeon Exit / Win Condition
- [ ] Update dungeon-generator to return rooms + place exit
- [ ] Add `DungeonTile.Exit` enum value
- [ ] Exit placement: farthest room from start
- [ ] Exit visual: glowing archway in scene-builder
- [ ] Win detection in game loop
- [ ] Create `WinScreen.tsx` (stats + play again)
- [ ] Add exit tile to minimap

### 5.2 Lore Objects + Scroll Popup
- [ ] Create lore content (10-15 entries)
- [ ] Create `lore-manager.ts` (spawning + data)
- [ ] Lore object visuals (pedestal + scroll meshes)
- [ ] Create `interaction-system.ts` (proximity + Enter key)
- [ ] Create `ScrollPopup.tsx` (parchment UI)
- [ ] HUD prompt: "Press [Enter] to read"
- [ ] Pause movement during popup
- [ ] Update controls-display with Enter/Escape
- [ ] Add lore objects to minimap

### 5.3 Sound System
- [ ] Create `sound-manager.ts` (Web Audio API)
- [ ] Footstep sounds (brown noise, throttled)
- [ ] Orb collection chime (frequency sweep)
- [ ] Lore open/close sounds (filtered noise)
- [ ] Game over sound (descending drone)
- [ ] Win sound (major chord)
- [ ] Ambient cave atmosphere (looping oscillators)
- [ ] Ambient volume tied to light level
- [ ] Wire all trigger points

## Phase 6: Testing

### 6.1 Test Infrastructure
- [ ] Configure Vitest (`vitest.config.ts`)
- [ ] Add test scripts to package.json
- [ ] Set up Playwright

### 6.2 Unit Tests
- [ ] `dungeon-generator.test.ts`
- [ ] `collision.test.ts`
- [ ] `light-system.test.ts`
- [ ] `fog-of-war.test.ts`
- [ ] `interaction-system.test.ts`
- [ ] `player-controller.test.ts`
- [ ] `game-store.test.ts`
- [ ] `sound-manager.test.ts`

### 6.3 E2E Tests
- [ ] Expose `window.__gameStore` in dev builds
- [ ] Game start flow test
- [ ] Movement test
- [ ] Collision test
- [ ] Light decay test
- [ ] Orb collection test
- [ ] Game over test
- [ ] Win condition test
- [ ] Lore interaction test

### 6.4 Test Log
- [ ] Auto-generated `test-results/game-test-log.md`

## Phase 7: Documentation
- [x] `docs/game-systems/dungeon-generation.md`
- [x] `docs/game-systems/player-movement.md`
- [x] `docs/game-systems/light-system.md`
- [x] `docs/game-systems/interaction-system.md`
- [x] `docs/game-systems/sound-system.md`
- [x] `docs/game-systems/minimap.md`
- [x] `docs/game-systems/state-management.md`
- [x] `docs/game-systems/rendering.md`
- [x] `docs/IMPLEMENTATION-GUIDE.md`
- [x] `docs/CHECKLIST.md`
- [ ] Update README.md with game documentation
