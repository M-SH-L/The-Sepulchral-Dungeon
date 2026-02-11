# Light System

## Overview
The core survival mechanic. The player carries a light source that decays as they move. Collecting light orbs restores it. At 0% light, the game ends.

## Files
- Light logic: `src/components/game/game.tsx` lines 576-632 (to be extracted to `src/lib/game/light-system.ts`)
- Light meter UI: `src/components/game/light-meter.tsx`
- Orb management: inline in `game.tsx` (to be extracted to `src/lib/game/orb-manager.ts`)

## Constants
```
MAX_LIGHT_DURATION = 100              // 100% = full light
LIGHT_DECAY_PER_UNIT_MOVED = 0.5     // Light lost per unit of distance traveled

// Player light properties
INITIAL_PLAYER_LIGHT_INTENSITY = 1.5
MAX_PLAYER_LIGHT_INTENSITY = 3.5
MIN_PLAYER_LIGHT_INTENSITY = 0
INITIAL_PLAYER_LIGHT_DISTANCE = 25.0  // 5.0 * TILE_SIZE
MAX_PLAYER_LIGHT_DISTANCE = 35.0      // 7.0 * TILE_SIZE
MIN_PLAYER_LIGHT_DISTANCE = 0
```

## Light Decay Formula
```
lightDuration = max(0, lightDuration - distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED)
```
- Only decays when the player actually moves (collision-blocked movement costs nothing)
- At `MOVE_SPEED = 3.5` units/sec, the player loses ~1.75 light/sec while moving continuously
- Full depletion from 100% takes ~57 seconds of non-stop movement

## Intensity/Distance Scaling
```typescript
const lightRatio = lightDuration / MAX_LIGHT_DURATION;           // 0.0 to 1.0
const easedRatio = Math.pow(lightRatio, 1.5);                    // Non-linear falloff
const intensity = lerp(MIN_INTENSITY, MAX_INTENSITY, easedRatio); // 0 to 3.5
const distance = lerp(MIN_DISTANCE, MAX_DISTANCE, easedRatio);   // 0 to 35
```

The `pow(ratio, 1.5)` exponent means:
- At 50% light: effective ratio = 0.354 (noticeably dimmer than linear)
- At 25% light: effective ratio = 0.125 (very dim)
- At 10% light: effective ratio = 0.032 (nearly dark)

This creates increasing urgency as light drops.

## Player Light (Three.js)
- `THREE.PointLight(0xffeedd, intensity, distance)` — warm white
- Positioned slightly above camera eye level (+0.1 units)
- Casts shadows: `shadowMap 1024x1024`, `PCFSoftShadowMap`
- Shadow far plane: `MAX_PLAYER_LIGHT_DISTANCE * 1.2`

## Light Orbs

### Sizes and Values
| Size | Radius | Light Restored | Spawn Weight |
|------|--------|---------------|--------------|
| Small | 0.15 | +15% | Equal (1/3) |
| Medium | 0.25 | +30% | Equal (1/3) |
| Large | 0.35 | +50% | Equal (1/3) |

### Spawning
- 15% chance per floor/corridor tile to contain an orb
- On a 30x30 grid with ~40% walkable area (~360 tiles), expect ~54 orbs
- Random size selection (uniform distribution)
- Spawn height: `PLAYER_HEIGHT * 0.7 = 1.19` units (near eye level)

### Orb Visuals
- `SphereGeometry` with warm yellow material (`color: 0xffcc66, emissive: 0xffaa00`)
- Individual `PointLight(0xffaa00, 0.8, 7.5)` per orb (performance concern — planned removal)
- Pulsing intensity: `baseIntensity + sin(time * 1.5 + id) * 0.3`
- Hovering: `baseY + sin(time * 0.4 + id * 0.5) * 0.1`

### Collection
- Trigger distance: `1.5` units from player to orb center
- On collection: `lightDuration = min(100, lightDuration + orbLightValue)`
- Orb mesh and light are hidden (`visible = false`)
- Toast notification shows amount collected and new percentage

### Orb Behavior When Light Is Out
- Orb point lights become invisible (`light.visible = false`)
- Orb mesh emissive intensity drops from 0.5 to 0.05 (very faint glow)
- Minimap orb indicators dim to 50% opacity

## Game Over
- Triggers when `lightDuration <= 0`
- Toast: "Engulfed by Darkness" / "Your light has faded completely."
- After 3 seconds, returns to intro screen

## Light Meter HUD
- 20 vertical segments (bottom to top)
- Filled segments use `bg-primary` (sepia brown)
- Empty segments use `bg-black/60`
- Shows "Darkness..." text with pulse animation at 0%
- Positioned: top-right corner, below minimap

## Planned Optimizations
1. Remove individual orb `PointLight` instances — use emissive-only materials
2. Extract light math to pure functions for unit testing
3. Add ambient light (`0x111111`) so orbs are faintly visible even without player light
