import { getTileKey } from './types';

export function discoverNearbyTiles(
    gridX: number,
    gridZ: number,
    radius: number,
    discovered: Set<string>
): string[] {
    const newKeys: string[] = [];
    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const key = getTileKey(gridX + dx, gridZ + dz);
            if (!discovered.has(key)) {
                newKeys.push(key);
            }
        }
    }
    return newKeys;
}
