
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { generateDungeon, DungeonTile } from './dungeon-generator';
import { useToast } from '@/hooks/use-toast';
import Minimap from './minimap';
import { Geist_Mono } from 'next/font/google';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Define light orb sizes and their properties
type OrbSize = 'small' | 'medium' | 'large';
const ORB_SIZES: Record<OrbSize, { scale: number; lightValue: number; probability: number; color: number; emissiveIntensity: number }> = {
    // Make scale differences more pronounced visually
    small:  { scale: 0.18, lightValue: 15, probability: 0.60, color: 0xFFFFE0, emissiveIntensity: 0.7 },
    medium: { scale: 0.30, lightValue: 35, probability: 0.30, color: 0xFFF0C0, emissiveIntensity: 1.0 },
    large:  { scale: 0.45, lightValue: 60, probability: 0.10, color: 0xFFE0A0, emissiveIntensity: 1.4 },
};
// Recalculate cumulative probability in case values change
const CUMULATIVE_ORB_PROBABILITY = Object.values(ORB_SIZES).reduce((sum, size) => sum + size.probability, 0);

interface InteractableObject {
    mesh: THREE.Mesh;
    info: string; // Keep info for potential future use or debugging
    id: number;
    used: boolean; // Track if the object has been used
    size: OrbSize;
    lightValue: number; // How much light this orb gives
}

interface TorchData {
    group: THREE.Group;
    light: THREE.PointLight;
    // Flame mesh is removed as per request
}

// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const COLLECTION_DISTANCE = 1.5; // Increased distance for automatic collection
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9;
const MOVE_SPEED = 3.5;
const ROTATION_SPEED = Math.PI * 0.6; // Radians per second for turning
const DUNGEON_SIZE_WIDTH = 30;
const DUNGEON_SIZE_HEIGHT = 30;
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0;
const ROOM_TORCH_PROBABILITY = 0.04;
const CORRIDOR_TORCH_PROBABILITY = 0.12;
const OBJECT_PROBABILITY = 0.06; // Slightly increased chance for objects
const OBJECT_HEIGHT = PLAYER_HEIGHT * 0.7; // Keep objects at eye level
const BASE_TORCH_LIGHT_INTENSITY = 1.8;
const TORCH_LIGHT_DISTANCE = 6.0;
const TORCH_LIGHT_COLOR = 0xffa54a;
const TORCH_WALL_OFFSET = 0.05;
const TORCH_HEIGHT_OFFSET = 1.5;
const FLICKER_SPEED = 4.0;
const FLICKER_INTENSITY_VARIATION = 0.6;
const PLAYER_GLOW_COLOR = 0xffffff;
const MIN_PLAYER_GLOW_INTENSITY = 0.5;
const MAX_PLAYER_GLOW_INTENSITY = 2.5;
const MIN_PLAYER_GLOW_DISTANCE = 2.0;
const MAX_PLAYER_GLOW_DISTANCE = 6.0;
const MINIMAP_VIEW_RADIUS = 5;
const PLAYER_DISCOVERY_RADIUS = 1;
const INITIAL_LIGHT_DURATION = 60; // Starting light amount (like seconds, but decreases with movement)
const MAX_LIGHT_DURATION = 120; // Max light amount player can hold
const LIGHT_DECAY_PER_UNIT_MOVED = 2.5; // Amount of light duration lost per unit distance moved
const ZERO_LIGHT_INTENSITY = 0.1; // Player glow intensity when light is out
const ZERO_LIGHT_DISTANCE = 0.5; // Player glow distance when light is out
const ZERO_LIGHT_FOG_NEAR = 0.1;
const ZERO_LIGHT_FOG_FAR = 1.5; // Reduced fog visibility when light is out
const ZERO_LIGHT_FOG_COLOR = 0x100804; // Darker fog when light is out
const NORMAL_FOG_NEAR = 1;
const NORMAL_FOG_FAR = 10;
const NORMAL_FOG_COLOR = 0x2a1a10; // Default fog color

// Function to create a torch light source embedded in the wall - Unchanged
const createTorch = (position: THREE.Vector3): TorchData => {
    const torchGroup = new THREE.Group();
    const pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, BASE_TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
    pointLight.position.set(0, TORCH_HEIGHT_OFFSET, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 256;
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.bias = -0.01;
    pointLight.name = "torchLight";
    torchGroup.add(pointLight);
    torchGroup.position.copy(position);
    return { group: torchGroup, light: pointLight };
};

// HUD Component - Unchanged
interface GameHUDProps {
    lightDuration: number;
    maxLightDuration: number;
}
const GameHUD: React.FC<GameHUDProps> = ({ lightDuration, maxLightDuration }) => {
    const lightPercentage = Math.max(0, Math.min(100, (lightDuration / maxLightDuration) * 100));

    return (
        <div className="absolute top-4 left-4 p-4 bg-background/80 text-foreground rounded-md shadow-lg text-sm border border-primary pointer-events-none z-10 w-64">
            <h3 className="font-bold mb-2 text-base border-b border-primary/50 pb-1">Controls</h3>
            <ul className="list-none space-y-1 text-xs mb-3">
                <li><span className="font-semibold">[ W, A, S, D ]:</span> Move</li>
                <li><span className="font-semibold">[ Arrow ← / → ]:</span> Look</li>
            </ul>
             <h3 className="font-bold mb-1 text-base border-b border-primary/50 pb-1">Light Remaining</h3>
             <Progress value={lightPercentage} className="w-full h-3 mt-2 bg-secondary border border-input" />
             <p className="text-xs text-center mt-1">{Math.ceil(lightPercentage)}%</p>
             {lightPercentage <= 0 && (
                <p className="text-xs text-center mt-1 text-destructive font-semibold animate-pulse">Darkness consumes...</p>
             )}
        </div>
    );
};


// Intro Screen Component - Unchanged
interface IntroScreenProps {
    onStartGame: () => void;
}
const IntroScreen: React.FC<IntroScreenProps> = ({ onStartGame }) => {
     useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                onStartGame();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onStartGame]);

    return (
        // Apply dark theme and specific font class
        <div className={`w-screen h-screen flex items-center justify-center bg-background dark ${geistMono.variable} intro-screen-font`}>
            <Card className="w-[500px] shadow-2xl border-primary/50 bg-card text-card-foreground">
                <CardHeader className="bg-primary/80 p-6 rounded-t-lg border-b border-primary">
                    <CardTitle className="text-primary-foreground text-3xl text-center tracking-wider font-bold">
                        Echoes in Sepia
                    </CardTitle>
                    <CardDescription className="text-primary-foreground/70 text-center pt-2 text-sm">
                        The stones whisper tales of forgotten dread...
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6 text-center">
                    <p className="text-foreground/90 leading-relaxed">
                        Descend into the dust-choked labyrinth. Your light fades as you move... Navigate using <span className="font-semibold text-primary-foreground/80">[W/A/S/D]</span> and glance left/right with <span className="font-semibold text-primary-foreground/80">[Arrow Keys]</span>. Collect floating light artifacts automatically by approaching them to stave off the encroaching darkness.
                    </p>
                    <Button
                        onClick={onStartGame}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6 shadow-md hover:shadow-lg transition-shadow duration-300 border border-primary-foreground/30"
                    >
                        Dare to Explore (or press Enter)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

// Helper function to get a random orb size based on probabilities - Unchanged
const getRandomOrbSize = (): OrbSize => {
    let rand = Math.random() * CUMULATIVE_ORB_PROBABILITY;
    let cumulative = 0;
    for (const size in ORB_SIZES) {
        cumulative += ORB_SIZES[size as OrbSize].probability;
        if (rand <= cumulative) {
            return size as OrbSize;
        }
    }
    return 'small'; // Fallback
};


const Game: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<THREE.Group>(new THREE.Group());
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const playerGlowLightRef = useRef<THREE.PointLight>();
    const dungeonGroupRef = useRef<THREE.Group>(new THREE.Group());
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const torchesRef = useRef<TorchData[]>([]);
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    // nearbyObjectRef is no longer needed for explicit interaction
    const [gameStarted, setGameStarted] = useState(false);
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeftStrafe = useRef(false);
    const moveRightStrafe = useRef(false);
    const rotateLeft = useRef(false);
    const rotateRight = useRef(false);
    const playerRotationY = useRef(0);
    const { toast } = useToast();
    const clock = useRef(new THREE.Clock());
    const cleanupFunctions = useRef<(() => void)[]>([]);
    const [discoveredTiles, setDiscoveredTiles] = useState<Set<string>>(new Set());
    const [lightDuration, setLightDuration] = useState(INITIAL_LIGHT_DURATION);
    const lastPlayerPosition = useRef<THREE.Vector3>(new THREE.Vector3());


    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 15, 5, 9), []);

    // Function to get tile key for discovery set - Unchanged
    const getTileKey = (x: number, z: number): string => `${x},${z}`;

     // Update discovered tiles based on player position - Unchanged
    const updateDiscovery = useCallback((playerGridX: number, playerGridZ: number) => {
        setDiscoveredTiles(prevDiscovered => {
            const newDiscovered = new Set(prevDiscovered);
            for (let dx = -PLAYER_DISCOVERY_RADIUS; dx <= PLAYER_DISCOVERY_RADIUS; dx++) {
                for (let dz = -PLAYER_DISCOVERY_RADIUS; dz <= PLAYER_DISCOVERY_RADIUS; dz++) {
                    const checkX = playerGridX + dx;
                    const checkZ = playerGridZ + dz;
                     if (checkX >= 0 && checkX < DUNGEON_SIZE_WIDTH && checkZ >= 0 && checkZ < DUNGEON_SIZE_HEIGHT) {
                        newDiscovered.add(getTileKey(checkX, checkZ));
                     }
                }
            }
             newDiscovered.add(getTileKey(playerGridX, playerGridZ)); // Ensure current tile is discovered
            return newDiscovered;
        });
    }, []);

    // Automatic Light Collection Logic - Replaces handleInteraction
    const collectNearbyLight = useCallback(() => {
        if (!playerRef.current) return; // Ensure player ref exists
        const playerPos = playerRef.current.position;

        interactableObjectsRef.current.forEach((obj, index) => { // Added index
            if (!obj.used && obj.mesh.visible) {
                const distanceSq = playerPos.distanceToSquared(obj.mesh.position);
                 if (distanceSq < COLLECTION_DISTANCE * COLLECTION_DISTANCE) {
                     // Increase light duration
                     setLightDuration(currentDuration => Math.min(MAX_LIGHT_DURATION, currentDuration + obj.lightValue));

                     // Mark object as used and hide it
                     obj.used = true;
                     obj.mesh.visible = false;
                     // We don't need to remove from array, just filter in minimap

                     // Provide feedback
                     toast({
                         title: `${obj.size.charAt(0).toUpperCase() + obj.size.slice(1)} Light Collected!`,
                         description: `Light replenished by ${obj.lightValue}.`, // Provide more info
                         variant: "default",
                         duration: 2000,
                     });

                 }
            }
        });

        // Filter interactableObjectsRef to remove used objects for efficiency if needed (optional)
        // interactableObjectsRef.current = interactableObjectsRef.current.filter(obj => !obj.used);

    }, [toast]); // Added toast dependency


    // Collision Detection - Unchanged
    const isPositionValid = useCallback((newPosition: THREE.Vector3): boolean => {
        const corners = [
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS),
        ];
        for (const corner of corners) {
            const gridX = Math.floor(corner.x / TILE_SIZE + 0.5);
            const gridZ = Math.floor(corner.z / TILE_SIZE + 0.5);
            if (gridX < 0 || gridX >= DUNGEON_SIZE_WIDTH || gridZ < 0 || gridZ >= DUNGEON_SIZE_HEIGHT) return false;
            const tile = dungeonData[gridZ]?.[gridX];
            if (tile === undefined || tile === DungeonTile.Wall) return false;
        }
        return true;
    }, [dungeonData]);

    // Start Game Function - Unchanged
    const startGame = useCallback(() => {
        setGameStarted(true);
        if (playerRef.current) {
            lastPlayerPosition.current.copy(playerRef.current.position);
        }
    }, []);

     // Check for adjacent walls (helper function) - Unchanged
    const isAdjacentToWall = (x: number, z: number, dungeon: DungeonTile[][]): boolean => {
         return dungeon[z + 1]?.[x] === DungeonTile.Wall ||
                dungeon[z - 1]?.[x] === DungeonTile.Wall ||
                dungeon[z]?.[x + 1] === DungeonTile.Wall ||
                dungeon[z]?.[x - 1] === DungeonTile.Wall;
    };

    // Find a suitable wall position for a torch - Unchanged
    const findTorchWallPosition = (x: number, z: number, dungeon: DungeonTile[][]): { position: THREE.Vector3, normal: THREE.Vector3 } | null => {
         const tileCenterX = x * TILE_SIZE;
         const tileCenterZ = z * TILE_SIZE;
         let torchPos = new THREE.Vector3(tileCenterX, TORCH_HEIGHT_OFFSET, tileCenterZ);
         let wallNormal = new THREE.Vector3(0, 0, 0);
         let foundWall = false;

         if (dungeon[z]?.[x + 1] === DungeonTile.Wall) { // Wall to the East
             torchPos.x += TILE_SIZE / 2 - TORCH_WALL_OFFSET;
             wallNormal.set(-1, 0, 0); foundWall = true;
         } else if (dungeon[z]?.[x - 1] === DungeonTile.Wall) { // Wall to the West
             torchPos.x -= TILE_SIZE / 2 - TORCH_WALL_OFFSET;
             wallNormal.set(1, 0, 0); foundWall = true;
         } else if (dungeon[z + 1]?.[x] === DungeonTile.Wall) { // Wall to the South
             torchPos.z += TILE_SIZE / 2 - TORCH_WALL_OFFSET;
             wallNormal.set(0, 0, -1); foundWall = true;
         } else if (dungeon[z - 1]?.[x] === DungeonTile.Wall) { // Wall to the North
             torchPos.z -= TILE_SIZE / 2 - TORCH_WALL_OFFSET;
             wallNormal.set(0, 0, 1); foundWall = true;
         }

         return foundWall ? { position: torchPos, normal: wallNormal } : null;
    }


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return;

        cleanupFunctions.current.forEach(cleanup => cleanup());
        cleanupFunctions.current = [];
        const currentMount = mountRef.current;

        // Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(NORMAL_FOG_COLOR); // Match fog color
        scene.fog = new THREE.Fog(NORMAL_FOG_COLOR, NORMAL_FOG_NEAR, NORMAL_FOG_FAR);

        // Camera Setup
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        cameraRef.current = camera;
        camera.position.y = CAMERA_EYE_LEVEL;
        camera.lookAt(0, CAMERA_EYE_LEVEL, -1);

        // Renderer Setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.7;

        // Lighting Setup
        const ambientLight = new THREE.AmbientLight(0x403020, 0.15); // Keep a dim ambient light
        scene.add(ambientLight);

        // Player Setup
        const player = playerRef.current;
        player.position.y = 0;
        player.add(camera);
        scene.add(player);

        // Player Glow Light
        const playerGlowLight = new THREE.PointLight(PLAYER_GLOW_COLOR, MAX_PLAYER_GLOW_INTENSITY, MAX_PLAYER_GLOW_DISTANCE);
        playerGlowLight.position.set(0, PLAYER_HEIGHT * 0.5, 0);
        playerGlowLight.castShadow = false;
        player.add(playerGlowLight);
        playerGlowLightRef.current = playerGlowLight;

        // Find starting position and initialize discovered tiles - Unchanged logic
         let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
         let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
         let foundStart = false;
         outerLoop: for (let z = 1; z < dungeonData.length - 1; z++) {
             for (let x = 1; x < dungeonData[z].length - 1; x++) {
                  if (dungeonData[z][x] === DungeonTile.Floor) {
                      startX = x; startZ = z; foundStart = true; break outerLoop;
                  } else if (!foundStart && dungeonData[z][x] === DungeonTile.Corridor) {
                     startX = x; startZ = z;
                  }
             }
         }
          if (!foundStart && dungeonData[startZ]?.[startX] === DungeonTile.Wall) {
               outerLoopFallback: for (let z = 1; z < dungeonData.length - 1; z++) {
                  for (let x = 1; x < dungeonData[z].length - 1; x++) {
                       if (dungeonData[z][x] !== DungeonTile.Wall) {
                           startX = x; startZ = z; break outerLoopFallback;
                       }
                  }
               }
          }
         player.position.set(startX * TILE_SIZE, 0, startZ * TILE_SIZE);
         lastPlayerPosition.current.copy(player.position);
         playerRotationY.current = 0;
         updateDiscovery(startX, startZ);


        // Dungeon Rendering (Torches and Objects)
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, side: THREE.DoubleSide, roughness: 1.0 });

        const dungeonGroup = dungeonGroupRef.current;
        dungeonGroup.clear();
        torchesRef.current = [];
        interactableObjectsRef.current = []; // Clear previous objects

        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                const tileCenterX = x * TILE_SIZE;
                const tileCenterZ = z * TILE_SIZE;

                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(tileCenterX, WALL_HEIGHT / 2, tileCenterZ);
                    wall.receiveShadow = true; wall.castShadow = true;
                    dungeonGroup.add(wall);
                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileCenterX, 0, tileCenterZ);
                    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileCenterX, WALL_HEIGHT, tileCenterZ);
                    ceiling.rotation.x = Math.PI / 2; ceiling.receiveShadow = true;
                    dungeonGroup.add(ceiling);

                    const isCorridor = tile === DungeonTile.Corridor;
                    const torchProbability = isCorridor ? CORRIDOR_TORCH_PROBABILITY : ROOM_TORCH_PROBABILITY;

                    // Place torches - Unchanged logic
                     if (isAdjacentToWall(x, z, dungeonData) && Math.random() < torchProbability) {
                         const torchWallData = findTorchWallPosition(x, z, dungeonData);
                         if (torchWallData) {
                             const torchData = createTorch(torchWallData.position);
                             dungeonGroup.add(torchData.group);
                             torchesRef.current.push(torchData);
                         }
                     }

                    // Place interactable light objects (orbs)
                    if (tile === DungeonTile.Floor && Math.random() < OBJECT_PROBABILITY) {
                        const orbSize = getRandomOrbSize();
                        const sizeProps = ORB_SIZES[orbSize];

                        // Ensure geometry reflects the size visually
                        const objectGeometry = new THREE.IcosahedronGeometry(sizeProps.scale, 1); // Increased subdivision for smoother look
                         const objectMaterial = new THREE.MeshStandardMaterial({
                             color: sizeProps.color,
                             emissive: sizeProps.color,
                             emissiveIntensity: sizeProps.emissiveIntensity,
                             roughness: 0.3,
                             metalness: 0.1
                         });
                        const lightSourceMesh = new THREE.Mesh(objectGeometry, objectMaterial);
                        lightSourceMesh.position.set(tileCenterX, OBJECT_HEIGHT, tileCenterZ);
                        lightSourceMesh.castShadow = false;
                        lightSourceMesh.receiveShadow = false;
                        lightSourceMesh.rotation.x = Math.random() * Math.PI;
                        lightSourceMesh.rotation.y = Math.random() * Math.PI;
                        dungeonGroup.add(lightSourceMesh);

                        // Add unique ID for easier tracking/debugging if needed
                        const objectId = interactableObjectsRef.current.length;
                        lightSourceMesh.name = `lightOrb_${objectId}`; // Name the mesh

                        interactableObjectsRef.current.push({
                            mesh: lightSourceMesh,
                            info: `A ${orbSize} source of light.`,
                            id: objectId,
                            used: false,
                            size: orbSize,
                            lightValue: sizeProps.lightValue,
                        });
                    }
                }
            });
        });
        scene.add(dungeonGroup);

        currentMount.appendChild(renderer.domElement);

        // Handle window resize - Unchanged
        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);
        cleanupFunctions.current.push(() => window.removeEventListener('resize', handleResize));

        // Keyboard controls - Unchanged
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            keysPressedRef.current[key] = true;
            switch (key) {
                case 'w': moveForward.current = true; break;
                case 's': moveBackward.current = true; break;
                case 'a': moveLeftStrafe.current = true; break;
                case 'd': moveRightStrafe.current = true; break;
                case 'arrowleft': rotateLeft.current = true; break;
                case 'arrowright': rotateRight.current = true; break;
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            keysPressedRef.current[key] = false;
             switch (key) {
                case 'w': moveForward.current = false; break;
                case 's': moveBackward.current = false; break;
                case 'a': moveLeftStrafe.current = false; break;
                case 'd': moveRightStrafe.current = false; break;
                case 'arrowleft': rotateLeft.current = false; break;
                case 'arrowright': rotateRight.current = false; break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        cleanupFunctions.current.push(() => window.removeEventListener('keydown', handleKeyDown));
        cleanupFunctions.current.push(() => window.removeEventListener('keyup', handleKeyUp));

        // Animation Loop
        let frameId: number;
        const animate = () => {
             if (!gameStarted || !rendererRef.current || !sceneRef.current || !cameraRef.current || !playerRef.current) {
                 if (frameId) cancelAnimationFrame(frameId);
                 return;
             }
            frameId = requestAnimationFrame(animate);
            const delta = clock.current.getDelta();
            const elapsedTime = clock.current.getElapsedTime();

            // --- Light Decay Logic ---
            const currentPosition = playerRef.current.position;
            const distanceMoved = lastPlayerPosition.current.distanceTo(currentPosition);

            if (distanceMoved > 0.01) {
                setLightDuration(prevDuration => Math.max(0, prevDuration - distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED));
                lastPlayerPosition.current.copy(currentPosition);
            }
            // --- End Light Decay Logic ---

             // Update Player Glow AND Scene Fog based on remaining light duration
             const lightRatio = Math.max(0, Math.min(1, lightDuration / MAX_LIGHT_DURATION));
             if (playerGlowLightRef.current) {
                if (lightDuration > 0) {
                    playerGlowLightRef.current.intensity = THREE.MathUtils.lerp(MIN_PLAYER_GLOW_INTENSITY, MAX_PLAYER_GLOW_INTENSITY, lightRatio);
                    playerGlowLightRef.current.distance = THREE.MathUtils.lerp(MIN_PLAYER_GLOW_DISTANCE, MAX_PLAYER_GLOW_DISTANCE, lightRatio);
                } else {
                    // Drastically reduce light when duration is zero
                    playerGlowLightRef.current.intensity = ZERO_LIGHT_INTENSITY;
                    playerGlowLightRef.current.distance = ZERO_LIGHT_DISTANCE;
                }
             }
             if (sceneRef.current?.fog) {
                const fog = sceneRef.current.fog as THREE.Fog;
                 if (lightDuration > 0) {
                    fog.near = NORMAL_FOG_NEAR;
                    fog.far = NORMAL_FOG_FAR;
                    (fog.color as THREE.Color).setHex(NORMAL_FOG_COLOR);
                 } else {
                    // Reduce visibility drastically when light is out
                    fog.near = ZERO_LIGHT_FOG_NEAR;
                    fog.far = ZERO_LIGHT_FOG_FAR;
                    (fog.color as THREE.Color).setHex(ZERO_LIGHT_FOG_COLOR);
                 }
             }


            // Animate Torches (Intensity Flicker Only) - Unchanged
            torchesRef.current.forEach(torchData => {
                const { light } = torchData;
                const intensityNoise = (Math.sin(elapsedTime * FLICKER_SPEED + light.id * 0.7) + Math.cos(elapsedTime * FLICKER_SPEED * 0.6 + light.id)) * 0.5;
                light.intensity = BASE_TORCH_LIGHT_INTENSITY + intensityNoise * FLICKER_INTENSITY_VARIATION;
            });

             // Animate Interactable Objects (Gentle Bobbing/Rotation/Glow)
             interactableObjectsRef.current.forEach(obj => {
                 if (obj.mesh.visible) {
                      obj.mesh.rotation.y += delta * 0.5;
                      obj.mesh.position.y = OBJECT_HEIGHT + Math.sin(elapsedTime * 1.5 + obj.id) * 0.1;
                      // Make emissive intensity pulse slightly
                      const baseIntensity = ORB_SIZES[obj.size].emissiveIntensity;
                      const pulse = (Math.sin(elapsedTime * 2.0 + obj.id * 1.1) + 1) / 2; // 0 to 1
                      (obj.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = baseIntensity * (0.8 + pulse * 0.4); // Pulse between 80% and 120% base
                 }
             });


            // Player Rotation - Unchanged
            let rotationChange = 0;
            if (rotateLeft.current) rotationChange += ROTATION_SPEED * delta;
            if (rotateRight.current) rotationChange -= ROTATION_SPEED * delta;
            playerRotationY.current += rotationChange;
            playerRef.current.rotation.y = playerRotationY.current;

            // Player Movement (Forward/Backward/Strafe) - Unchanged logic
            const moveDirection = new THREE.Vector3();
            const strafeDirection = new THREE.Vector3();
            playerRef.current.getWorldDirection(moveDirection).negate();
            moveDirection.y = 0;
            moveDirection.normalize();
            strafeDirection.crossVectors(playerRef.current.up, moveDirection).negate();


            const combinedMove = new THREE.Vector3();
            if (moveForward.current) combinedMove.add(moveDirection);
            if (moveBackward.current) combinedMove.sub(moveDirection);
            if (moveLeftStrafe.current) combinedMove.sub(strafeDirection);
            if (moveRightStrafe.current) combinedMove.add(strafeDirection);

            let movedThisFrame = false;

            if (combinedMove.lengthSq() > 0) {
                combinedMove.normalize();
                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = combinedMove.multiplyScalar(actualMoveSpeed);
                const currentPosition = playerRef.current.position.clone();
                const nextPosition = currentPosition.clone().add(moveAmount);

                 if (isPositionValid(nextPosition)) {
                    playerRef.current.position.copy(nextPosition);
                    movedThisFrame = true;
                 } else {
                     const moveXComponent = new THREE.Vector3(moveAmount.x, 0, 0);
                     const nextPositionX = currentPosition.clone().add(moveXComponent);
                     const moveZComponent = new THREE.Vector3(0, 0, moveAmount.z);
                     const nextPositionZ = currentPosition.clone().add(moveZComponent);

                     let movedX = false;
                     if (moveXComponent.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         playerRef.current.position.x = nextPositionX.x;
                         movedThisFrame = true;
                         movedX = true;
                     }

                     const currentPosForZCheck = playerRef.current.position.clone();
                     const nextPositionZAfterX = currentPosForZCheck.clone().add(moveZComponent);

                     if (moveZComponent.lengthSq() > 0.0001 && isPositionValid(nextPositionZAfterX)) {
                          playerRef.current.position.z = nextPositionZAfterX.z;
                          movedThisFrame = true;
                     }
                 }
            }

            // Update discovered tiles and collect light if the player moved
            if (movedThisFrame) {
                 const playerGridX = Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5);
                 const playerGridZ = Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5);
                 updateDiscovery(playerGridX, playerGridZ);
                 // Attempt to collect light *after* moving and updating position
                 collectNearbyLight();
            }

            // Removed nearby object check logic as interaction is automatic

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        frameId = requestAnimationFrame(animate);

        // Cleanup - Unchanged
        return () => {
             if (frameId) cancelAnimationFrame(frameId);
             cleanupFunctions.current.forEach(cleanup => cleanup());
             cleanupFunctions.current = [];

            if (currentMount && rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) {
                 try { currentMount.removeChild(rendererRef.current.domElement); }
                 catch (e) { console.warn("Error removing renderer DOM element:", e); }
            }
            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        object.geometry?.dispose();
                         if (Array.isArray(object.material)) { object.material.forEach(material => material.dispose()); }
                         else if (object.material) { object.material.dispose(); }
                    } else if (object instanceof THREE.Light) { object.dispose(); }
                });
                sceneRef.current.fog = null; // Clear fog explicitly
            }
             rendererRef.current?.dispose();
             clock.current.stop();

             sceneRef.current = undefined;
             rendererRef.current = undefined;
             cameraRef.current = undefined;
             playerRef.current = new THREE.Group();
             lastPlayerPosition.current.set(0,0,0);
             dungeonGroupRef.current = new THREE.Group();
             torchesRef.current = [];
             interactableObjectsRef.current = [];
             keysPressedRef.current = {};
             moveForward.current = false;
             moveBackward.current = false;
             moveLeftStrafe.current = false;
             moveRightStrafe.current = false;
             rotateLeft.current = false;
             rotateRight.current = false;
             // nearbyObjectRef removed
             setDiscoveredTiles(new Set());
             setLightDuration(INITIAL_LIGHT_DURATION);
        };
    // Dependencies updated: Removed nearbyObjectRef, added collectNearbyLight
    }, [gameStarted, dungeonData, isPositionValid, collectNearbyLight, updateDiscovery, toast]);


    if (!gameStarted) {
        return <IntroScreen onStartGame={startGame} />;
    }

    const playerGridX = playerRef.current ? Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5) : 0;
    const playerGridZ = playerRef.current ? Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5) : 0;

    return (
        <div ref={mountRef} className="w-full h-full relative bg-black">
             <GameHUD lightDuration={lightDuration} maxLightDuration={MAX_LIGHT_DURATION} />
             <Minimap
                 dungeon={dungeonData}
                 playerX={playerGridX}
                 playerZ={playerGridZ}
                 viewRadius={MINIMAP_VIEW_RADIUS}
                 tileSize={TILE_SIZE}
                 // Pass the *entire* list including used objects, Minimap will handle filtering based on visibility if needed
                 // or filter here before passing
                 interactableObjects={interactableObjectsRef.current.filter(obj => !obj.used)}
                 discoveredTiles={discoveredTiles}
                 getTileKey={getTileKey}
             />
             {/* Interaction hint removed */}
        </div>
    );
};

export default Game;
