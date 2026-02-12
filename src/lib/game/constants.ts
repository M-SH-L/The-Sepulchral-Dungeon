export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.3;
export const COLLECTION_DISTANCE = 1.5;
export const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9;
export const MOVE_SPEED = 3.5;
export const ROTATION_SPEED = Math.PI / 3;
export const TILE_SIZE = 5;
export const WALL_HEIGHT = 3.5;
export const CEILING_HEIGHT = WALL_HEIGHT;

export const MAX_LIGHT_DURATION = 100;
export const LIGHT_DECAY_PER_UNIT_MOVED = 0.5;

export const INITIAL_PLAYER_LIGHT_INTENSITY = 1.5;
export const MAX_PLAYER_LIGHT_INTENSITY = 3.5;
export const MIN_PLAYER_LIGHT_INTENSITY = 0;
export const INITIAL_PLAYER_LIGHT_DISTANCE = 5.0 * TILE_SIZE;
export const MAX_PLAYER_LIGHT_DISTANCE = 7.0 * TILE_SIZE;
export const MIN_PLAYER_LIGHT_DISTANCE = 0;

export const ORB_BASE_INTENSITY = 0.8;
export const ORB_PULSE_AMOUNT = 0.3;
export const ORB_PULSE_SPEED = 1.5;
export const ORB_HOVER_SPEED = 0.4;
export const ORB_HOVER_AMOUNT = 0.1;
export const ORB_SPAWN_HEIGHT = PLAYER_HEIGHT * 0.7;

export const ORB_SIZES = {
    small: { radius: 0.15, lightValue: 15 },
    medium: { radius: 0.25, lightValue: 30 },
    large: { radius: 0.35, lightValue: 50 },
} as const;

export const DUNGEON_WIDTH = 30;
export const DUNGEON_HEIGHT = 30;
export const DUNGEON_MAX_ROOMS = 15;
export const DUNGEON_MIN_ROOM_SIZE = 4;
export const DUNGEON_MAX_ROOM_SIZE = 8;
