# State Management

## Overview
Transitioning from scattered React `useState`/`useRef` to a centralized Zustand store. This solves stale closure bugs in the animation loop, reduces unnecessary re-renders, and provides a clean API for all game systems.

## Current State (Problems)

### Scattered State in `game.tsx`
```typescript
// React state (causes re-renders, stale in animation loop)
const [dungeon, setDungeon] = useState<DungeonTile[][]>([]);
const [interactableObjects, setInteractableObjects] = useState<InteractableObjectData[]>([]);
const [lightDurationHud, setLightDurationHud] = useState(MAX_LIGHT_DURATION);
const [isGameOver, setIsGameOver] = useState(false);
const [showIntro, setShowIntro] = useState(true);
const [discoveredTiles, setDiscoveredTiles] = useState<Set<string>>(new Set());
const [playerGridPos, setPlayerGridPos] = useState({ x: 0, z: 0 });

// Refs (avoid re-renders, but scattered and hard to test)
const playerPositionRef = useRef<THREE.Vector3>(...);
const playerRotationY = useRef(0);
const lightDurationRef = useRef(MAX_LIGHT_DURATION);
const isGameOverRef = useRef(false);
const showIntroRef = useRef(true);
const moveForward = useRef(false);
// ... many more
```

### Problems This Causes
1. **Stale closures:** Animation loop captures state values at creation time. Even with refs, the dual state+ref pattern is error-prone.
2. **Excessive re-renders:** `setPlayerPosition` triggers re-render every frame, cascading to all children.
3. **Untestable:** Game logic is tangled with React hooks, impossible to unit test.
4. **Dual bookkeeping:** Every value needs both a ref (for animation loop) and state (for HUD), kept in sync manually.

## Planned: Zustand Store

### File
`src/lib/game/game-store.ts`

### Store Shape
```typescript
interface GameStore {
    // Game lifecycle
    phase: 'intro' | 'playing' | 'gameover' | 'win';
    setPhase: (phase: GameStore['phase']) => void;

    // Dungeon
    dungeon: DungeonTile[][];
    rooms: Room[];
    setDungeon: (dungeon: DungeonTile[][], rooms: Room[]) => void;

    // Player
    playerPosition: THREE.Vector3;
    playerRotationY: number;
    setPlayerPosition: (pos: THREE.Vector3) => void;
    setPlayerRotationY: (rot: number) => void;

    // Light
    lightDuration: number;
    adjustLight: (delta: number) => void;  // Clamps to [0, MAX]

    // Orbs
    orbs: OrbData[];
    setOrbs: (orbs: OrbData[]) => void;
    collectOrb: (id: number) => void;

    // Lore
    loreObjects: LoreObjectData[];
    setLoreObjects: (lore: LoreObjectData[]) => void;
    activeLoreId: number | null;
    setActiveLore: (id: number | null) => void;
    markLoreRead: (id: number) => void;

    // Fog of war
    discoveredTiles: Set<string>;
    discoverTiles: (keys: string[]) => void;

    // Input
    keys: Record<string, boolean>;
    setKey: (key: string, pressed: boolean) => void;

    // Stats
    orbsCollected: number;
    startTime: number | null;
    elapsedTime: number;

    // Reset
    resetGame: () => void;
}
```

### Why Zustand

| Feature | useState/useRef | React Context | Zustand |
|---------|----------------|---------------|---------|
| Stale closures | Broken | Broken | Solved (`getState()`) |
| Selective re-render | No | No | Yes (selectors) |
| No provider needed | Yes | No | Yes |
| Testable outside React | No | No | Yes |
| Bundle size | 0 | 0 | ~1KB |

### Usage Patterns

#### In the game loop (non-reactive, no re-renders)
```typescript
// game-loop.ts
import { useGameStore } from './game-store';

function update(delta: number) {
    const state = useGameStore.getState(); // Synchronous, always current
    const pos = state.playerPosition;
    const light = state.lightDuration;
    // ... update logic ...
    state.adjustLight(-distanceMoved * DECAY_RATE);
}
```

#### In HUD components (reactive, selective re-renders)
```typescript
// light-meter.tsx
function LightMeter() {
    const lightDuration = useGameStore(s => s.lightDuration);
    const maxLight = MAX_LIGHT_DURATION; // from constants
    // Only re-renders when lightDuration changes
}
```

#### In tests (direct store manipulation)
```typescript
// collision.test.ts
import { useGameStore } from './game-store';

test('player cannot walk through walls', () => {
    const store = useGameStore.getState();
    store.setDungeon(testDungeon, testRooms);
    store.setPlayerPosition(new Vector3(10, 0.85, 10));
    // ... test collision ...
});
```

### Migration Strategy
1. Create the Zustand store with all fields
2. Wire the animation loop to use `getState()` instead of refs
3. Wire HUD components to use selectors instead of props
4. Remove all `useState`/`useRef` game state from `Game.tsx`
5. `Game.tsx` becomes a thin shell that initializes the store and renders HUD
