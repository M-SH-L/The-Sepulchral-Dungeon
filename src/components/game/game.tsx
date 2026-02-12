'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

import { useGameStore } from '@/lib/game/game-store';
import {
    TILE_SIZE,
    PLAYER_HEIGHT,
    DUNGEON_WIDTH,
    DUNGEON_HEIGHT,
    DUNGEON_MAX_ROOMS,
    DUNGEON_MIN_ROOM_SIZE,
    DUNGEON_MAX_ROOM_SIZE,
    MAX_LIGHT_DURATION,
} from '@/lib/game/constants';
import { getTileKey } from '@/lib/game/types';
import { generateDungeon, DungeonTile } from './dungeon-generator';
import { createRenderer, createCamera, createScene, createPlayerLight, setupResizeHandler, dispose } from '@/lib/game/renderer';
import { buildDungeon } from '@/lib/game/scene-builder';
import { spawnOrbs } from '@/lib/game/orb-manager';
import { setupInputListeners } from '@/lib/game/input-handler';
import { startGameLoop } from '@/lib/game/game-loop';

import ControlsDisplay from './controls-display';
import LightMeter from './light-meter';
import Minimap from './minimap';
import IntroScreen from './IntroScreen';
import GameOverOverlay from './GameOverOverlay';
import { useToast } from '@/hooks/use-toast';

function Game() {
    const mountRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    // Subscribe to store for reactive rendering
    const phase = useGameStore((s) => s.phase);
    const dungeon = useGameStore((s) => s.dungeon);
    const playerGridPos = useGameStore((s) => s.playerGridPos);
    const lightDuration = useGameStore((s) => s.lightDuration);
    const orbs = useGameStore((s) => s.orbs);
    const discoveredTiles = useGameStore((s) => s.discoveredTiles);

    const startGame = useCallback(() => {
        useGameStore.getState().resetGame();
    }, []);

    // Initialize scene and game loop
    useEffect(() => {
        if (!mountRef.current) return;

        const store = useGameStore.getState();

        // Generate dungeon
        const generatedDungeon = generateDungeon(
            DUNGEON_WIDTH,
            DUNGEON_HEIGHT,
            DUNGEON_MAX_ROOMS,
            DUNGEON_MIN_ROOM_SIZE,
            DUNGEON_MAX_ROOM_SIZE
        );
        store.setDungeon(generatedDungeon);

        // Find starting position
        let startX = -1, startZ = -1;
        for (let z = 0; z < DUNGEON_HEIGHT; z++) {
            for (let x = 0; x < DUNGEON_WIDTH; x++) {
                if (generatedDungeon[z][x] === DungeonTile.Floor || generatedDungeon[z][x] === DungeonTile.Corridor) {
                    startX = x;
                    startZ = z;
                    break;
                }
            }
            if (startX !== -1) break;
        }

        if (startX === -1) {
            startX = Math.floor(DUNGEON_WIDTH / 2);
            startZ = Math.floor(DUNGEON_HEIGHT / 2);
            if (startX > 0 && startX < DUNGEON_WIDTH - 1 && startZ > 0 && startZ < DUNGEON_HEIGHT - 1) {
                generatedDungeon[startZ][startX] = DungeonTile.Floor;
            } else {
                startX = 1;
                startZ = 1;
                if (generatedDungeon[startZ]?.[startX]) generatedDungeon[startZ][startX] = DungeonTile.Floor;
            }
        }

        const initialWorldX = startX * TILE_SIZE;
        const initialWorldZ = startZ * TILE_SIZE;
        store.setPlayerPosition(new THREE.Vector3(initialWorldX, PLAYER_HEIGHT / 2, initialWorldZ));
        store.setPlayerGridPos({ x: startX, z: startZ });
        store.discoverTiles([getTileKey(startX, startZ)]);

        // Three.js setup
        const scene = createScene();
        const camera = createCamera();
        const renderer = createRenderer(mountRef.current);
        const playerLight = createPlayerLight(initialWorldX, initialWorldZ);
        scene.add(playerLight);

        store.setThreeRefs({ scene, camera, renderer, playerLight });

        // Build dungeon geometry
        buildDungeon(scene, generatedDungeon);

        // Spawn orbs
        const orbData = spawnOrbs(scene, generatedDungeon);
        store.setOrbs(orbData);

        // Setup input
        const cleanupInput = setupInputListeners();

        // Setup resize
        const cleanupResize = setupResizeHandler(camera, renderer);

        // Start game loop
        const stopLoop = startGameLoop((opts) => toastRef.current(opts));

        return () => {
            stopLoop();
            cleanupInput();
            cleanupResize();
            mountRef.current?.removeChild(renderer.domElement);
            dispose(renderer, scene);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            {phase === 'intro' && <IntroScreen onStartGame={startGame} />}
            <div ref={mountRef} className="absolute top-0 left-0 h-full w-full" />
            {phase === 'playing' && (
                <>
                    <ControlsDisplay />
                    <Minimap
                        dungeon={dungeon}
                        playerX={playerGridPos.x}
                        playerZ={playerGridPos.z}
                        viewRadius={5}
                        tileSize={TILE_SIZE}
                        interactableObjects={orbs}
                        discoveredTiles={discoveredTiles}
                        getTileKey={getTileKey}
                        isPlayerLightOut={lightDuration <= 0}
                    />
                    <LightMeter
                        lightDuration={lightDuration}
                        maxLightDuration={MAX_LIGHT_DURATION}
                    />
                </>
            )}
            {phase === 'gameover' && <GameOverOverlay />}
        </div>
    );
}

export default Game;
