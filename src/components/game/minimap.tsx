
import React from 'react';
import { DungeonTile } from './dungeon-generator';
import { cn } from '@/lib/utils';

interface InteractableObject {
    mesh: THREE.Mesh;
    id: number;
    // Add other relevant properties if needed, like position
}

interface MinimapProps {
    dungeon: DungeonTile[][];
    playerX: number; // Player's grid X coordinate
    playerZ: number; // Player's grid Z coordinate
    viewRadius: number; // How many tiles to show around the player
    tileSize: number; // World scale tile size (used for object positioning)
    interactableObjects: InteractableObject[]; // Pass interactable objects
}

const Minimap: React.FC<MinimapProps> = ({
    dungeon,
    playerX,
    playerZ,
    viewRadius,
    tileSize,
    interactableObjects
}) => {
    const mapSize = viewRadius * 2 + 1; // Diameter of the map view
    const minimapGrid: (DungeonTile | 'P' | 'O')[][] = Array.from({ length: mapSize }, () =>
        Array(mapSize).fill(DungeonTile.Wall) // Default to wall
    );

    // Populate the minimap grid based on the view radius
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const worldX = playerX - viewRadius + x;
            const worldZ = playerZ - viewRadius + y;

            // Check bounds of the main dungeon
            if (worldZ >= 0 && worldZ < dungeon.length && worldX >= 0 && worldX < dungeon[0].length) {
                minimapGrid[y][x] = dungeon[worldZ][worldX];
            } else {
                minimapGrid[y][x] = DungeonTile.Wall; // Out of bounds is treated as wall
            }

            // Check for interactable objects in this world tile
            const objectsInTile = interactableObjects.filter(obj => {
                 const objGridX = Math.floor(obj.mesh.position.x / tileSize + 0.5);
                 const objGridZ = Math.floor(obj.mesh.position.z / tileSize + 0.5);
                 return objGridX === worldX && objGridZ === worldZ;
            });

            if (objectsInTile.length > 0) {
                 minimapGrid[y][x] = 'O'; // Mark tile as containing an object
            }
        }
    }

    // Place the player marker at the center
    minimapGrid[viewRadius][viewRadius] = 'P';

    // Determine the Tailwind class for each tile
    const getTileClass = (tile: DungeonTile | 'P' | 'O'): string => {
        switch (tile) {
            case DungeonTile.Floor:
            case DungeonTile.Corridor:
                return 'bg-secondary/50'; // Floor/Corridor color (lighter sepia)
            case DungeonTile.Wall:
                return 'bg-primary/70'; // Wall color (darker brown)
            case 'P':
                return 'bg-green-500'; // Player marker color (adjust as needed)
            case 'O':
                return 'bg-yellow-500'; // Object marker color (adjust as needed)
            default:
                return 'bg-black'; // Default/unknown
        }
    };

    return (
        <div
            className="absolute top-4 right-4 p-2 bg-background/80 border border-primary rounded-md shadow-lg z-10" // Ensure minimap is above game canvas but below dialog
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${mapSize}, 10px)`, // Fixed size cells
                gridTemplateRows: `repeat(${mapSize}, 10px)`,
                gap: '1px', // Small gap between cells
            }}
        >
            {minimapGrid.map((row, y) =>
                row.map((tile, x) => (
                    <div
                        key={`${x}-${y}`}
                        className={cn(
                            'w-[10px] h-[10px]', // Fixed size
                            getTileClass(tile)
                        )}
                    />
                ))
            )}
        </div>
    );
};

export default Minimap;
