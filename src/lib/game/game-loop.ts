import * as THREE from 'three';
import { CAMERA_EYE_LEVEL, TILE_SIZE, ORB_SIZES } from './constants';
import { getTileKey } from './types';
import { useGameStore } from './game-store';
import { updatePlayer } from './player-controller';
import { calculateLightProperties } from './light-system';
import { animateOrbs, tryCollectOrbs, updateOrbVisibility } from './orb-manager';
import { discoverNearbyTiles } from './fog-of-war';

export type ToastFn = (opts: { title: string; description: string; variant?: string }) => void;

export function startGameLoop(toastFn: ToastFn): () => void {
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let lastGridX = -1;
    let lastGridZ = -1;

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const state = useGameStore.getState();
        const { phase, renderer, scene, camera, playerLight, orbs } = state;

        // Always render (shows dungeon behind overlays)
        if (renderer && scene && camera) {
            if (phase !== 'playing') {
                renderer.render(scene, camera);
                return;
            }
        } else {
            return;
        }

        const delta = clock.getDelta();

        // Update player movement
        updatePlayer(delta);

        // Re-read state after player update
        const pos = useGameStore.getState().playerPosition;
        const lightDuration = useGameStore.getState().lightDuration;

        // Update camera and light position
        if (camera && playerLight) {
            camera.position.x = pos.x;
            camera.position.z = pos.z;
            camera.position.y = CAMERA_EYE_LEVEL;

            playerLight.position.x = pos.x;
            playerLight.position.z = pos.z;
            playerLight.position.y = CAMERA_EYE_LEVEL + 0.1;
        }

        // Update player grid position for minimap
        const currentGridX = Math.floor(pos.x / TILE_SIZE + 0.5);
        const currentGridZ = Math.floor(pos.z / TILE_SIZE + 0.5);
        if (currentGridX !== lastGridX || currentGridZ !== lastGridZ) {
            lastGridX = currentGridX;
            lastGridZ = currentGridZ;
            state.setPlayerGridPos({ x: currentGridX, z: currentGridZ });

            // Discover tiles
            const discovered = useGameStore.getState().discoveredTiles;
            const newTiles = discoverNearbyTiles(currentGridX, currentGridZ, 2, discovered);
            if (newTiles.length > 0) {
                state.discoverTiles(newTiles);
            }
        }

        // Update light properties
        if (playerLight) {
            const { intensity, distance } = calculateLightProperties(lightDuration);
            playerLight.intensity = intensity;
            playerLight.distance = distance;
            updateOrbVisibility(orbs, intensity);
        }

        // Check game over
        if (lightDuration <= 0 && phase === 'playing') {
            state.setPhase('gameover');
            toastFn({
                title: 'Engulfed by Darkness',
                description: 'Your light has faded completely.',
                variant: 'destructive',
            });
            setTimeout(() => {
                useGameStore.getState().setPhase('intro');
            }, 3000);
        }

        // Orb collection
        const collectResult = tryCollectOrbs(pos, orbs);
        if (collectResult) {
            const { lightValue } = collectResult;
            state.adjustLight(lightValue);
            toastFn({
                title: `Light Orb Collected! (+${lightValue})`,
                description: `Your light meter is now ${useGameStore.getState().lightDuration.toFixed(0)}%`,
            });
        }

        // Animate orbs
        const time = clock.getElapsedTime();
        animateOrbs(orbs, time);

        // Render
        renderer.render(scene, camera);
    };

    animate();

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
}
