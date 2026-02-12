import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE_SIZE, WALL_HEIGHT, CEILING_HEIGHT } from './constants';
import { DungeonTile } from './types';

export function buildDungeon(scene: THREE.Scene, dungeon: DungeonTile[][]): void {
    const height = dungeon.length;
    const width = dungeon[0].length;

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6c5d53 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7e75 });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4d41, side: THREE.DoubleSide });

    // Collect geometries for batching
    const wallGeometries: THREE.BufferGeometry[] = [];
    const floorGeometries: THREE.BufferGeometry[] = [];

    dungeon.forEach((row, z) => {
        row.forEach((tile, x) => {
            const worldX = x * TILE_SIZE;
            const worldZ = z * TILE_SIZE;

            if (tile === DungeonTile.Wall) {
                const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
                geo.translate(worldX, WALL_HEIGHT / 2, worldZ);
                wallGeometries.push(geo);
            } else {
                const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
                geo.rotateX(-Math.PI / 2);
                geo.translate(worldX, 0, worldZ);
                floorGeometries.push(geo);
            }
        });
    });

    // Merge and add walls
    if (wallGeometries.length > 0) {
        const mergedWalls = mergeGeometries(wallGeometries);
        if (mergedWalls) {
            const wallMesh = new THREE.Mesh(mergedWalls, wallMaterial);
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            scene.add(wallMesh);
        }
        wallGeometries.forEach((g) => g.dispose());
    }

    // Merge and add floors
    if (floorGeometries.length > 0) {
        const mergedFloors = mergeGeometries(floorGeometries);
        if (mergedFloors) {
            const floorMesh = new THREE.Mesh(mergedFloors, floorMaterial);
            floorMesh.receiveShadow = true;
            scene.add(floorMesh);
        }
        floorGeometries.forEach((g) => g.dispose());
    }

    // Ceiling as a single plane
    const ceilingGeometry = new THREE.PlaneGeometry(width * TILE_SIZE, height * TILE_SIZE);
    const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(
        (width / 2) * TILE_SIZE - TILE_SIZE / 2,
        CEILING_HEIGHT,
        (height / 2) * TILE_SIZE - TILE_SIZE / 2
    );
    ceilingMesh.receiveShadow = true;
    scene.add(ceilingMesh);
}
