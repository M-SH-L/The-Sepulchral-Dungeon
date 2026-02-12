import * as THREE from 'three';
import { TILE_SIZE, PLAYER_RADIUS } from './constants';
import { DungeonTile } from './types';

export function isWallCollision(position: THREE.Vector3, dungeonMap: DungeonTile[][]): boolean {
    const checkRadius = PLAYER_RADIUS;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) continue;

            const checkX = position.x + dx * checkRadius;
            const checkZ = position.z + dz * checkRadius;

            const checkGridX = Math.floor(checkX / TILE_SIZE + 0.5);
            const checkGridZ = Math.floor(checkZ / TILE_SIZE + 0.5);

            if (checkGridZ < 0 || checkGridZ >= dungeonMap.length || checkGridX < 0 || checkGridX >= dungeonMap[0].length) {
                return true;
            }
            if (dungeonMap[checkGridZ]?.[checkGridX] === DungeonTile.Wall) {
                const wallMinX = checkGridX * TILE_SIZE - TILE_SIZE / 2;
                const wallMaxX = checkGridX * TILE_SIZE + TILE_SIZE / 2;
                const wallMinZ = checkGridZ * TILE_SIZE - TILE_SIZE / 2;
                const wallMaxZ = checkGridZ * TILE_SIZE + TILE_SIZE / 2;

                if (
                    position.x + PLAYER_RADIUS > wallMinX &&
                    position.x - PLAYER_RADIUS < wallMaxX &&
                    position.z + PLAYER_RADIUS > wallMinZ &&
                    position.z - PLAYER_RADIUS < wallMaxZ
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}
