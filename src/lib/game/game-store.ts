import { create } from 'zustand';
import * as THREE from 'three';
import { MAX_LIGHT_DURATION } from './constants';
import type { GamePhase, OrbData } from './types';
import type { DungeonTile } from '@/components/game/dungeon-generator';

interface GameStore {
    // Game lifecycle
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;

    // Dungeon
    dungeon: DungeonTile[][];
    setDungeon: (dungeon: DungeonTile[][]) => void;

    // Player
    playerPosition: THREE.Vector3;
    playerRotationY: number;
    setPlayerPosition: (pos: THREE.Vector3) => void;
    setPlayerRotationY: (rot: number) => void;

    // Player grid position (for minimap)
    playerGridPos: { x: number; z: number };
    setPlayerGridPos: (pos: { x: number; z: number }) => void;

    // Light
    lightDuration: number;
    adjustLight: (delta: number) => void;
    setLightDuration: (value: number) => void;

    // Orbs
    orbs: OrbData[];
    setOrbs: (orbs: OrbData[]) => void;
    collectOrb: (id: number) => void;

    // Fog of war
    discoveredTiles: Set<string>;
    discoverTiles: (keys: string[]) => void;

    // Input
    keys: Record<string, boolean>;
    setKey: (key: string, pressed: boolean) => void;

    // Three.js refs (not reactive, accessed via getState())
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    playerLight: THREE.PointLight | null;
    setThreeRefs: (refs: {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
        playerLight: THREE.PointLight;
    }) => void;

    // Stats
    orbsCollected: number;

    // Reset
    resetGame: () => void;
}

const initialState = {
    phase: 'intro' as GamePhase,
    dungeon: [] as DungeonTile[][],
    playerPosition: new THREE.Vector3(0, 0, 0),
    playerRotationY: 0,
    playerGridPos: { x: 0, z: 0 },
    lightDuration: MAX_LIGHT_DURATION,
    orbs: [] as OrbData[],
    discoveredTiles: new Set<string>(),
    keys: {} as Record<string, boolean>,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    playerLight: null as THREE.PointLight | null,
    orbsCollected: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),

    setDungeon: (dungeon) => set({ dungeon }),

    setPlayerPosition: (pos) => set({ playerPosition: pos }),
    setPlayerRotationY: (rot) => set({ playerRotationY: rot }),

    setPlayerGridPos: (pos) => set({ playerGridPos: pos }),

    adjustLight: (delta) =>
        set((state) => ({
            lightDuration: Math.max(0, Math.min(MAX_LIGHT_DURATION, state.lightDuration + delta)),
        })),

    setLightDuration: (value) => set({ lightDuration: Math.max(0, Math.min(MAX_LIGHT_DURATION, value)) }),

    setOrbs: (orbs) => set({ orbs }),

    collectOrb: (id) =>
        set((state) => {
            const orbs = state.orbs.map((orb) =>
                orb.id === id ? { ...orb, used: true } : orb
            );
            return { orbs, orbsCollected: state.orbsCollected + 1 };
        }),

    discoverTiles: (keys) =>
        set((state) => {
            const next = new Set(state.discoveredTiles);
            let changed = false;
            for (const key of keys) {
                if (!next.has(key)) {
                    next.add(key);
                    changed = true;
                }
            }
            return changed ? { discoveredTiles: next } : {};
        }),

    setKey: (key, pressed) =>
        set((state) => ({
            keys: { ...state.keys, [key]: pressed },
        })),

    setThreeRefs: (refs) => set(refs),

    resetGame: () =>
        set({
            phase: 'playing',
            lightDuration: MAX_LIGHT_DURATION,
            playerRotationY: 0,
            orbsCollected: 0,
            keys: {},
        }),
}));
