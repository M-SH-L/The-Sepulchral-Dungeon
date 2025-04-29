
import React from 'react';
import { DungeonTile } from './dungeon-generator';
import { cn } from '@/lib/utils';
import type * as THREE from 'three';

interface InteractableObjectData {
    mesh: THREE.Mesh;
    id: number;
}

interface MinimapProps {
    dungeon: DungeonTile[][];
    playerX: number; // Player's grid X coordinate
    playerZ: number; // Player's grid Z coordinate
    viewRadius: number; // How many tiles to show around the player
    tileSize: number; // World scale tile size
    interactableObjects: InteractableObjectData[];
    discoveredTiles: Set<string>; // Set of discovered tile keys ('x,z')
    getTileKey: (x: number, z: number) => string; // Function to generate tile keys
}

const Minimap: React.FC<MinimapProps> = ({
    dungeon,
    playerX,
    playerZ,
    viewRadius,
    tileSize,
    interactableObjects,
    discoveredTiles,
    getTileKey,
}) => {
    const mapSize = viewRadius * 2 + 1; // Diameter of the map view
    // Initialize with 'U' for Undiscovered
    const minimapGrid: (DungeonTile | 'P' | 'O' | 'U')[][] = Array.from({ length: mapSize }, () =>
        Array(mapSize).fill('U')
    );

    // Populate the minimap grid based on discovered tiles and view radius
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const worldX = playerX - viewRadius + x;
            const worldZ = playerZ - viewRadius + y;
            const tileKey = getTileKey(worldX, worldZ);

            // Only process tiles that have been discovered
            if (discoveredTiles.has(tileKey)) {
                 // Check bounds of the main dungeon
                 if (worldZ >= 0 && worldZ < dungeon.length && worldX >= 0 && worldX < dungeon[0].length) {
                    minimapGrid[y][x] = dungeon[worldZ][worldX]; // Assign the actual tile type

                    // Check for interactable objects in this *discovered* world tile
                    const objectsInTile = interactableObjects.filter(obj => {
                         const objGridX = Math.floor(obj.mesh.position.x / tileSize + 0.5);
                         const objGridZ = Math.floor(obj.mesh.position.z / tileSize + 0.5);
                         return objGridX === worldX && objGridZ === worldZ;
                    });

                    // Mark tile if an object is present, but only if it's discovered and not the player's tile
                    if (objectsInTile.length > 0 && !(y === viewRadius && x === viewRadius)) {
                         minimapGrid[y][x] = 'O';
                    }
                } else {
                    minimapGrid[y][x] = DungeonTile.Wall; // Treat out-of-bounds discovered as wall
                }
            } else {
                 minimapGrid[y][x] = 'U'; // Keep as Undiscovered
            }
        }
    }

    // Place the player marker at the center, overriding any object/tile marker
    // Ensure the player's tile itself is marked (even if technically undiscovered by radius logic)
    const playerTileKey = getTileKey(playerX, playerZ);
    if (discoveredTiles.has(playerTileKey) || true) { // Always show player
        minimapGrid[viewRadius][viewRadius] = 'P';
    }


    // Determine the Tailwind class for each tile
    const getTileClass = (tile: DungeonTile | 'P' | 'O' | 'U'): string => {
        switch (tile) {
            case DungeonTile.Floor:
                return 'bg-secondary/60 hover:bg-secondary/80'; // Discovered floor
            case DungeonTile.Corridor:
                return 'bg-muted/60 hover:bg-muted/80'; // Discovered corridor
            case DungeonTile.Wall:
                return 'bg-primary/70 hover:bg-primary/90'; // Discovered wall
            case 'P':
                return 'bg-green-500 border border-green-700 shadow-inner shadow-black/30'; // Player marker
            case 'O':
                return 'bg-yellow-500 border border-yellow-700 shadow-inner shadow-black/30'; // Object marker
            case 'U':
                 return 'bg-black/50'; // Undiscovered tile (dark gray/semi-transparent black)
            default:
                return 'bg-black'; // Unknown
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
                            'w-[10px] h-[10px] rounded-sm transition-colors duration-150', // Added transition
                            getTileClass(tile)
                        )}
                        title={tile === 'U' ? 'Undiscovered' : `Tile: ${tile} at (${playerX - viewRadius + x}, ${playerZ - viewRadius + y})`}
                    />
                ))
            )}
        </div>
    );
};

export default Minimap;
