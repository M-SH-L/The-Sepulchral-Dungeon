import * as THREE from 'three';
import {
    TILE_SIZE,
    ORB_SPAWN_HEIGHT,
    ORB_SIZES,
    ORB_BASE_INTENSITY,
    ORB_PULSE_AMOUNT,
    ORB_PULSE_SPEED,
    ORB_HOVER_SPEED,
    ORB_HOVER_AMOUNT,
    COLLECTION_DISTANCE,
    MIN_PLAYER_LIGHT_INTENSITY,
} from './constants';
import type { OrbData, OrbSize } from './types';
import { DungeonTile } from './types';

export function spawnOrbs(scene: THREE.Scene, dungeon: DungeonTile[][]): OrbData[] {
    const orbs: OrbData[] = [];
    let orbId = 0;

    const orbMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcc66,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5,
    });

    dungeon.forEach((row, z) => {
        row.forEach((tile, x) => {
            if ((tile === DungeonTile.Floor || tile === DungeonTile.Corridor) && Math.random() < 0.15) {
                const worldX = x * TILE_SIZE;
                const worldZ = z * TILE_SIZE;
                const baseY = ORB_SPAWN_HEIGHT;

                const sizeKeys = Object.keys(ORB_SIZES) as OrbSize[];
                const size = sizeKeys[Math.floor(Math.random() * sizeKeys.length)];
                const orbData = ORB_SIZES[size];

                const orbGeometry = new THREE.SphereGeometry(orbData.radius, 16, 16);
                const orbMesh = new THREE.Mesh(orbGeometry, orbMaterial.clone());
                orbMesh.position.set(worldX, baseY, worldZ);
                orbMesh.castShadow = true;

                const orbLight = new THREE.PointLight(0xffaa00, ORB_BASE_INTENSITY, TILE_SIZE * 1.5);
                orbLight.position.copy(orbMesh.position);
                orbLight.castShadow = false;

                scene.add(orbMesh);
                scene.add(orbLight);

                orbs.push({ mesh: orbMesh, id: orbId++, light: orbLight, baseY, size });
            }
        });
    });

    return orbs;
}

export function animateOrbs(orbs: OrbData[], time: number): void {
    orbs.forEach((obj) => {
        if (!obj.used && obj.mesh.visible) {
            if (obj.light) {
                obj.light.intensity = ORB_BASE_INTENSITY + Math.sin(time * ORB_PULSE_SPEED + obj.id) * ORB_PULSE_AMOUNT;
            }
            obj.mesh.position.y = obj.baseY + Math.sin(time * ORB_HOVER_SPEED + obj.id * 0.5) * ORB_HOVER_AMOUNT;
            if (obj.light) {
                obj.light.position.y = obj.mesh.position.y;
            }
        }
    });
}

export function tryCollectOrbs(
    playerPos: THREE.Vector3,
    orbs: OrbData[]
): { collectedOrb: OrbData; lightValue: number } | null {
    for (const obj of orbs) {
        if (!obj.used && obj.mesh.visible && playerPos.distanceTo(obj.mesh.position) < COLLECTION_DISTANCE) {
            const lightValue = ORB_SIZES[obj.size].lightValue;
            obj.used = true;
            obj.mesh.visible = false;
            if (obj.light) obj.light.visible = false;
            return { collectedOrb: obj, lightValue };
        }
    }
    return null;
}

export function updateOrbVisibility(orbs: OrbData[], lightIntensity: number): void {
    orbs.forEach((obj) => {
        if (obj.light) {
            obj.light.visible = lightIntensity > MIN_PLAYER_LIGHT_INTENSITY;
        }
        if (obj.mesh) {
            const orbMat = obj.mesh.material as THREE.MeshStandardMaterial;
            orbMat.emissiveIntensity = lightIntensity > MIN_PLAYER_LIGHT_INTENSITY ? 0.5 : 0.05;
        }
    });
}
