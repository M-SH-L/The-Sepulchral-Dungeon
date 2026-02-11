# Sound System

## Overview
Procedurally generated audio using the Web Audio API. No external audio files or libraries. All sounds are synthesized at runtime from oscillators, noise generators, and filters.

## File
Planned: `src/lib/game/sound-manager.ts`

## Architecture

### SoundManager Interface
```typescript
interface SoundManager {
    init(): Promise<void>;              // Create AudioContext (requires user gesture)
    playFootstep(): void;               // Randomized step sound
    playOrbCollect(size: OrbSize): void; // Chime, pitch varies by size
    playLoreOpen(): void;               // Paper unrolling
    playLoreClose(): void;              // Paper rolling
    playGameOver(): void;               // Low extinguish drone
    playWin(): void;                    // Triumphant chord
    startAmbient(): void;               // Looping cave atmosphere
    stopAmbient(): void;
    setAmbientVolume(v: number): void;  // 0.0 to 1.0, tied to light level
    setMasterVolume(v: number): void;   // Global volume control
    dispose(): void;                    // Clean up AudioContext
}
```

### AudioContext Initialization
- Must be created after a user gesture (browser policy)
- Called in `startGame()` when the player presses Enter on the intro screen
- Single `AudioContext` instance for the entire game session
- Master gain node for global volume control

## Sound Designs

### Footsteps
- **Trigger:** Player moves (throttled to every ~0.4 seconds)
- **Method:** Short burst of brown noise (lowpass-filtered white noise)
- **Variation:** 3-4 pitch/filter randomizations per step
- **Parameters:**
  - Duration: 80-120ms
  - Lowpass filter: 200-400Hz (randomized)
  - Gain envelope: quick attack (5ms), fast decay (100ms)

### Orb Collection
- **Trigger:** Player collects a light orb
- **Method:** Sine wave with quick frequency sweep upward
- **Size variation:**
  - Small: start 400Hz, end 800Hz
  - Medium: start 500Hz, end 1200Hz
  - Large: start 600Hz, end 1600Hz, add harmonics
- **Parameters:**
  - Duration: 200-400ms
  - Gain envelope: instant attack, slow decay
  - Optional: add second oscillator at 5th interval for richness

### Lore Open
- **Trigger:** Player opens a scroll popup
- **Method:** Filtered noise burst simulating paper unrolling
- **Parameters:**
  - Duration: 300ms
  - Bandpass filter sweep: 1000Hz → 3000Hz
  - Gain: moderate, quick fade-in

### Lore Close
- **Trigger:** Player closes a scroll popup
- **Method:** Reverse of open — filter sweep downward
- **Parameters:**
  - Duration: 200ms
  - Bandpass filter sweep: 3000Hz → 800Hz
  - Gain: quick fade-out

### Game Over
- **Trigger:** Light reaches 0%
- **Method:** Low sine wave with descending pitch
- **Parameters:**
  - Start frequency: 200Hz
  - End frequency: 40Hz
  - Duration: 2000ms
  - Gain: slow fade-out over full duration
  - Optional: add distortion/waveshaping for menace

### Win
- **Trigger:** Player reaches the exit
- **Method:** Major chord — three sine waves at harmonic intervals
- **Parameters:**
  - Root: 440Hz (A4)
  - Major third: 554Hz (C#5)
  - Fifth: 659Hz (E5)
  - Duration: 1500ms
  - Gain envelope: instant attack, slow sustain, gentle release
  - Optional: add slight detune for warmth

### Ambient
- **Trigger:** Game starts playing
- **Method:** Layered low-frequency oscillators with slow LFO modulation
- **Layers:**
  1. Deep drone: sine wave at 55Hz, very low volume
  2. Wind: filtered brown noise, bandpass 100-400Hz, slow volume LFO
  3. Drips: occasional random high-frequency clicks (Poisson-distributed)
- **Volume modulation:** `setAmbientVolume(lightDuration / maxLightDuration)`
  - Full light = full ambient (0.3 master)
  - Low light = quiet ambient, creating eerie silence
  - Zero light = near-silent (0.05), emphasizing the darkness

## Integration Points

| System | Sound | Trigger Location |
|--------|-------|-----------------|
| `player-controller.ts` | `playFootstep()` | On successful movement (throttled) |
| `orb-manager.ts` | `playOrbCollect(size)` | On orb collection |
| `interaction-system.ts` | `playLoreOpen()` | On popup open |
| `interaction-system.ts` | `playLoreClose()` | On popup close |
| `game-loop.ts` | `playGameOver()` | On `phase` → `gameover` |
| `game-loop.ts` | `playWin()` | On `phase` → `win` |
| `Game.tsx` | `init()` | In `startGame()` callback |
| `game-loop.ts` | `setAmbientVolume()` | Each frame, based on light ratio |
| `Game.tsx` | `dispose()` | On component unmount |

## Performance Notes
- All sounds use shared AudioContext (single thread)
- Footstep throttling prevents audio spam
- Ambient uses minimal oscillator count (2-3 nodes)
- No audio file loading = zero network overhead
- Procedural generation means infinite variation with zero storage
