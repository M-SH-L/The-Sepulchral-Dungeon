export enum DungeonTile {
    Wall = '#',
    Floor = '.',
    Corridor = ',',
}

export interface Room {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function generateDungeon(
    width: number,
    height: number,
    maxRooms: number,
    minRoomSize: number,
    maxRoomSize: number
): DungeonTile[][] {
    // Initialize grid with walls
    const dungeon: DungeonTile[][] = Array.from({ length: height }, () =>
        Array(width).fill(DungeonTile.Wall)
    );

    const rooms: Room[] = [];

    function carveRoom(room: Room): void {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                    dungeon[y][x] = DungeonTile.Floor;
                }
            }
        }
    }

     function carveHTunnel(x1: number, x2: number, y: number): void {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                 if (dungeon[y][x] === DungeonTile.Wall) { // Only carve if it's a wall
                     dungeon[y][x] = DungeonTile.Corridor;
                }
            }
        }
    }

    function carveVTunnel(y1: number, y2: number, x: number): void {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                 if (dungeon[y][x] === DungeonTile.Wall) { // Only carve if it's a wall
                     dungeon[y][x] = DungeonTile.Corridor;
                }
            }
        }
    }

    for (let i = 0; i < maxRooms; i++) {
        const w = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        const h = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        const x = Math.floor(Math.random() * (width - w - 1)) + 1; // Ensure rooms are within bounds
        const y = Math.floor(Math.random() * (height - h - 1)) + 1;

        const newRoom: Room = { x, y, width: w, height: h };

        // Check for overlaps
        let overlaps = false;
        for (const room of rooms) {
             if (
                newRoom.x <= room.x + room.width &&
                newRoom.x + newRoom.width >= room.x &&
                newRoom.y <= room.y + room.height &&
                newRoom.y + newRoom.height >= room.y
            ) {
                overlaps = true;
                break;
            }
        }

        if (!overlaps) {
            carveRoom(newRoom);

             if (rooms.length > 0) {
                const prevRoom = rooms[rooms.length - 1];
                const prevCenterX = Math.floor(prevRoom.x + prevRoom.width / 2);
                const prevCenterY = Math.floor(prevRoom.y + prevRoom.height / 2);
                const newCenterX = Math.floor(newRoom.x + newRoom.width / 2);
                const newCenterY = Math.floor(newRoom.y + newRoom.height / 2);

                // Randomly decide corridor carving order (H then V or V then H)
                 if (Math.random() > 0.5) {
                    carveHTunnel(prevCenterX, newCenterX, prevCenterY);
                    carveVTunnel(prevCenterY, newCenterY, newCenterX);
                } else {
                    carveVTunnel(prevCenterY, newCenterY, prevCenterX);
                    carveHTunnel(prevCenterX, newCenterX, newCenterY);
                }
            }

            rooms.push(newRoom);
        }
    }

     // Ensure the starting room (first room generated) has a floor tile
    if (rooms.length > 0) {
        const startRoom = rooms[0];
        dungeon[startRoom.y + Math.floor(startRoom.height / 2)][startRoom.x + Math.floor(startRoom.width / 2)] = DungeonTile.Floor;
    } else {
         // Fallback: place a floor tile if no rooms were generated
         const startX = Math.floor(width / 2);
         const startY = Math.floor(height / 2);
         if (startX > 0 && startX < width -1 && startY > 0 && startY < height - 1) {
              dungeon[startY][startX] = DungeonTile.Floor;
         }
    }


    return dungeon;
}
