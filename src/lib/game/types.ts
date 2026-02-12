import type * as THREE from 'three';
import { ORB_SIZES } from './constants';

export { DungeonTile } from '@/components/game/dungeon-generator';
export type { Room } from '@/components/game/dungeon-generator';

export type OrbSize = keyof typeof ORB_SIZES;

export type GamePhase = 'intro' | 'playing' | 'gameover' | 'win';

export interface OrbData {
    mesh: THREE.Mesh;
    id: number;
    light: THREE.PointLight;
    baseY: number;
    size: OrbSize;
    used?: boolean;
}

export const getTileKey = (x: number, z: number) => `${x},${z}`;
