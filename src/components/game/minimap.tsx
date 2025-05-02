
import React from 'react';
import { DungeonTile } from './dungeon-generator';
import { cn } from '@/lib/utils';
import type * as THREE from 'three';

type OrbSize = 'small' | 'medium' | 'large';

interface InteractableObjectData {
    mesh: THREE.Mesh;
    id: number;
    size: OrbSize; // Keep size property
    used?: boolean; // Optional, depending on where filtering occurs
    visible?: boolean; // Optional
}

interface MinimapProps {
    dungeon: DungeonTile[][];
    playerX: number; // Player's grid X coordinate
    playerZ: number; // Player's grid Z coordinate
    viewRadius: number; // How many tiles to show around the player
    tileSize: number; // World scale tile size
    interactableObjects: InteractableObjectData[]; // List might include used/hidden objects
    discoveredTiles: Set<string>; // Set of discovered tile keys ('x,z')
    getTileKey: (x: number, z: number) => string; // Function to generate tile keys
    isPlayerLightOut: boolean; // New prop to indicate if player light is zero
}

const Minimap: React.FC<MinimapProps> = ({
    dungeon,
    playerX,
    playerZ,
    viewRadius,
    tileSize,
    interactableObjects, // Might contain used objects now
    discoveredTiles,
    getTileKey,
    isPlayerLightOut, // Use the new prop
}) => {
    const mapSize = viewRadius * 2 + 1;
    // Represents the tile type or 'P' (Player), 'Os', 'Om', 'Ol' (Object sizes), 'U' (Undiscovered)
    type MinimapTileContent = DungeonTile | 'P' | 'Os' | 'Om' | 'Ol' | 'U';
    const minimapGrid: MinimapTileContent[][] = Array.from({ length: mapSize }, () =>
        Array(mapSize).fill('U')
    );

    // Populate the minimap grid
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const worldX = playerX - viewRadius + x;
            const worldZ = playerZ - viewRadius + y;
            const tileKey = getTileKey(worldX, worldZ);

            if (discoveredTiles.has(tileKey)) {
                if (worldZ >= 0 && worldZ < dungeon.length && worldX >= 0 && worldX < dungeon[0].length) {
                    const baseTile = dungeon[worldZ][worldX];
                    minimapGrid[y][x] = baseTile; // Assign the base tile type first

                    // Check for *visible and unused* interactable objects in this tile
                    // Dim orbs if player light is out
                    const objectsInTile = interactableObjects.filter(obj => {
                        // Ensure object is not used and its mesh is visible
                        if (obj.used || !obj.mesh.visible) return false;

                        const objGridX = Math.floor(obj.mesh.position.x / tileSize + 0.5);
                        const objGridZ = Math.floor(obj.mesh.position.z / tileSize + 0.5);
                        return objGridX === worldX && objGridZ === worldZ;
                    });

                    // Mark tile based on the largest object found (if any)
                    if (objectsInTile.length > 0 && !(y === viewRadius && x === viewRadius)) { // Exclude player tile
                        let largestSize: OrbSize | null = null;
                        objectsInTile.forEach(obj => {
                            if (!largestSize || obj.size === 'large' || (obj.size === 'medium' && largestSize === 'small')) {
                                largestSize = obj.size;
                            }
                        });

                        if (largestSize === 'large') minimapGrid[y][x] = 'Ol';
                        else if (largestSize === 'medium') minimapGrid[y][x] = 'Om';
                        else minimapGrid[y][x] = 'Os';
                    }
                } else {
                    minimapGrid[y][x] = DungeonTile.Wall; // Out-of-bounds discovered is wall
                }
            } else {
                minimapGrid[y][x] = 'U'; // Undiscovered
            }
        }
    }

    // Place the player marker, overriding others
    minimapGrid[viewRadius][viewRadius] = 'P';

    // Determine the Tailwind class for each tile type
    const getTileClass = (tile: MinimapTileContent): string => {
        const orbBaseClass = 'shadow-inner shadow-black/30';
        const orbPulseClass = !isPlayerLightOut ? 'animate-pulse' : ''; // Only pulse if light is on
        const orbOpacityClass = isPlayerLightOut ? 'opacity-50' : ''; // Dim orbs if light is out

        switch (tile) {
            case DungeonTile.Floor: return 'bg-secondary/60 hover:bg-secondary/80';
            case DungeonTile.Corridor: return 'bg-muted/60 hover:bg-muted/80';
            case DungeonTile.Wall: return 'bg-primary/70 hover:bg-primary/90';
            case 'P': return cn(
                'border border-green-700 shadow-inner shadow-black/30',
                 isPlayerLightOut ? 'bg-green-900 opacity-60' : 'bg-green-500 animate-pulse' // Dim player if light out
                 );
            // Update orb colors for better distinction and handle light out state
            case 'Os': return cn(orbBaseClass, orbPulseClass, orbOpacityClass, 'bg-yellow-200 border border-yellow-400'); // Lighter Yellow
            case 'Om': return cn(orbBaseClass, orbPulseClass, orbOpacityClass, 'bg-yellow-400 border border-yellow-600'); // Mid Yellow
            case 'Ol': return cn(orbBaseClass, orbPulseClass, orbOpacityClass, 'bg-orange-400 border border-orange-600'); // Orange for Large
            case 'U': return 'bg-black/50'; // Undiscovered
            default: return 'bg-black';
        }
    };

    const getTileTitle = (tile: MinimapTileContent, x: number, y: number): string => {
         const worldX = playerX - viewRadius + x;
         const worldZ = playerZ - viewRadius + y;
         switch (tile) {
             case 'P': return `Player at (${playerX}, ${playerZ})${isPlayerLightOut ? ' (Light Out)' : ''}`;
             case 'Os': return `Small Light Source at (${worldX}, ${worldZ})${isPlayerLightOut ? ' (Dimmed)' : ''}`;
             case 'Om': return `Medium Light Source at (${worldX}, ${worldZ})${isPlayerLightOut ? ' (Dimmed)' : ''}`;
             case 'Ol': return `Large Light Source at (${worldX}, ${worldZ})${isPlayerLightOut ? ' (Dimmed)' : ''}`;
             case 'U': return 'Undiscovered';
             case DungeonTile.Floor: return `Floor at (${worldX}, ${worldZ})`;
             case DungeonTile.Corridor: return `Corridor at (${worldX}, ${worldZ})`;
             case DungeonTile.Wall: return `Wall at (${worldX}, ${worldZ})`;
             default: return `Tile: ${tile} at (${worldX}, ${worldZ})`;
         }
    };

    return (
        <div
            className="absolute top-4 right-4 p-2 bg-background/80 border border-primary rounded-md shadow-lg z-10 grid"
            style={{
                gridTemplateColumns: `repeat(${mapSize}, 10px)`,
                gridTemplateRows: `repeat(${mapSize}, 10px)`,
                gap: '1px',
            }}
        >
            {minimapGrid.map((row, y) =>
                row.map((tile, x) => (
                    <div
                        key={`${x}-${y}`}
                        className={cn(
                            'w-[10px] h-[10px] rounded-sm transition-colors duration-150',
                            getTileClass(tile)
                        )}
                        title={getTileTitle(tile, x, y)}
                    />
                ))
            )}
        </div>
    );
};

export default Minimap;
