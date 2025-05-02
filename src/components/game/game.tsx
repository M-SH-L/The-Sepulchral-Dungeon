
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

// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const COLLECTION_DISTANCE = 1.5; // Increased distance for automatic collection
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
const MOVE_SPEED = 3.5;
const ROTATION_SPEED = Math.PI * 0.6; // Radians per second for turning
const DUNGEON_SIZE_WIDTH = 30;
const DUNGEON_SIZE_HEIGHT = 30;
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0;
const OBJECT_PROBABILITY = 0.08; // Chance for objects on floor tiles
const OBJECT_HEIGHT_OFFSET = -0.2; // Place orbs slightly below center line of wall

const PLAYER_GLOW_COLOR = 0xffffff;
const MIN_PLAYER_GLOW_INTENSITY = 0.5;
const MAX_PLAYER_GLOW_INTENSITY = 3.0; // Increased max intensity for better visibility
const MIN_PLAYER_GLOW_DISTANCE = 3.0; // Increased min distance
const MAX_PLAYER_GLOW_DISTANCE = 8.0; // Increased max distance
const MINIMAP_VIEW_RADIUS = 5;
const PLAYER_DISCOVERY_RADIUS = 1;
const INITIAL_LIGHT_DURATION = 60; // Starting light amount
const MAX_LIGHT_DURATION = 120; // Max light amount player can hold
const LIGHT_DECAY_PER_UNIT_MOVED = 2.5; // Amount of light duration lost per unit distance moved
const ZERO_LIGHT_INTENSITY = 0.01; // Extremely low intensity when light is out
const ZERO_LIGHT_DISTANCE = 0.1; // Extremely low distance when light is out
const ZERO_LIGHT_FOG_NEAR = 0.05; // Very near fog start
const ZERO_LIGHT_FOG_FAR = 0.5; // Very near fog end - Pitch Black
const ZERO_LIGHT_FOG_COLOR = 0x000000; // Pure black fog when light is out
const NORMAL_FOG_NEAR = 1;
const NORMAL_FOG_FAR = 12; // Slightly increased normal fog distance
const NORMAL_FOG_COLOR = 0x100500; // Dark sepia/brown fog color


// HUD Component
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


// Intro Screen Component
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
                        // Ensure button has focus initially for Enter key press
                        autoFocus
                    >
                        Dare to Explore (or press Enter)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

// Helper function to get a random orb size based on probabilities
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
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
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
    const animationFrameId = useRef<number | null>(null); // Use ref for animation frame ID

    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 15, 5, 9), []);

    // Function to get tile key for discovery set
    const getTileKey = (x: number, z: number): string => `${x},${z}`;

     // Update discovered tiles based on player position
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

    // Automatic Light Collection Logic
    const collectNearbyLight = useCallback(() => {
        if (!playerRef.current) return; // Ensure player ref exists
        const playerPos = playerRef.current.position;

        interactableObjectsRef.current.forEach((obj) => {
            if (!obj.used && obj.mesh.visible) {
                const distanceSq = playerPos.distanceToSquared(obj.mesh.position);
                 if (distanceSq < COLLECTION_DISTANCE * COLLECTION_DISTANCE) {
                     // Increase light duration
                     setLightDuration(currentDuration => Math.min(MAX_LIGHT_DURATION, currentDuration + obj.lightValue));

                     // Mark object as used and hide it
                     obj.used = true;
                     obj.mesh.visible = false;

                     // Provide feedback
                     toast({
                         title: `${obj.size.charAt(0).toUpperCase() + obj.size.slice(1)} Light Collected!`,
                         description: `Light replenished by ${obj.lightValue}.`,
                         variant: "default",
                         duration: 2000,
                     });

                 }
            }
        });

    }, [toast]);


    // Collision Detection
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

    // Start Game Function
    const startGame = useCallback(() => {
        console.log("Starting game..."); // Debug log
        setGameStarted(true);
        // Reset state if needed (redundant if cleanup is working, but safe)
        setLightDuration(INITIAL_LIGHT_DURATION);
        setDiscoveredTiles(new Set());
        playerRotationY.current = 0;
        keysPressedRef.current = {};
        moveForward.current = false;
        moveBackward.current = false;
        moveLeftStrafe.current = false;
        moveRightStrafe.current = false;
        rotateLeft.current = false;
        rotateRight.current = false;
    }, []);


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return;

        console.log("Game useEffect triggered"); // Debug log

        // Cleanup previous instances
        cleanupFunctions.current.forEach(cleanup => cleanup());
        cleanupFunctions.current = [];
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
        if (rendererRef.current?.domElement && mountRef.current.contains(rendererRef.current.domElement)) {
            try { mountRef.current.removeChild(rendererRef.current.domElement); }
            catch (e) { console.warn("Error removing previous renderer DOM element:", e); }
        }
        rendererRef.current?.dispose();
        sceneRef.current?.clear(); // Clear scene content

        // Reset refs
        playerRef.current = new THREE.Group();
        cameraRef.current = undefined;
        sceneRef.current = undefined;
        rendererRef.current = undefined;
        playerGlowLightRef.current = undefined;
        dungeonGroupRef.current = new THREE.Group();
        interactableObjectsRef.current = [];
        keysPressedRef.current = {};
        moveForward.current = false;
        moveBackward.current = false;
        moveLeftStrafe.current = false;
        moveRightStrafe.current = false;
        rotateLeft.current = false;
        rotateRight.current = false;
        playerRotationY.current = 0;


        const currentMount = mountRef.current;

        // Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(ZERO_LIGHT_FOG_COLOR); // Start with dark background
        scene.fog = new THREE.Fog(NORMAL_FOG_COLOR, NORMAL_FOG_NEAR, NORMAL_FOG_FAR); // Initial fog state

        // Camera Setup
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        cameraRef.current = camera;
        camera.position.y = CAMERA_EYE_LEVEL; // Set camera at eye level

        // Renderer Setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = false; // Shadows disabled for performance and simpler lighting
        renderer.toneMapping = THREE.NoToneMapping; // Use basic tone mapping

        // Set initial camera look direction (important!)
        const lookDirection = new THREE.Vector3(0, CAMERA_EYE_LEVEL, -1); // Look straight ahead at eye level
        camera.lookAt(lookDirection);
        camera.up.set(0, 1, 0); // Ensure camera is upright


        // Lighting Setup - Only player glow light

        // Player Setup
        const player = playerRef.current;
        player.position.y = 0; // Place player group at ground level
        player.add(camera); // Add camera to the player group
        scene.add(player);

        // Player Glow Light
        const playerGlowLight = new THREE.PointLight(PLAYER_GLOW_COLOR, MAX_PLAYER_GLOW_INTENSITY, MAX_PLAYER_GLOW_DISTANCE);
        playerGlowLight.position.set(0, PLAYER_HEIGHT * 0.5, 0); // Center light within player height
        playerGlowLight.castShadow = false; // Disable shadows for player glow
        player.add(playerGlowLight); // Add light to player group
        playerGlowLightRef.current = playerGlowLight;

        // Find starting position and initialize discovered tiles
         let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
         let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
         let foundStart = false;
         outerLoop: for (let z = 1; z < dungeonData.length - 1; z++) {
             for (let x = 1; x < dungeonData[z].length - 1; x++) {
                  if (dungeonData[z][x] === DungeonTile.Floor) {
                      startX = x; startZ = z; foundStart = true; break outerLoop;
                  } else if (!foundStart && dungeonData[z][x] === DungeonTile.Corridor) {
                     startX = x; startZ = z; // Use corridor as start if no floor found yet
                  }
             }
         }
          // Fallback if only walls were generated (unlikely but possible)
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
         playerRotationY.current = 0; // Reset rotation
         player.rotation.y = 0; // Apply reset rotation
         updateDiscovery(startX, startZ);
         console.log(`Player start position: (${startX * TILE_SIZE}, 0, ${startZ * TILE_SIZE})`); // Debug log

        // Dungeon Rendering
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        // Darker materials as primary light is player glow
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9, metalness: 0.1 }); // Darker brown
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, side: THREE.DoubleSide, roughness: 1.0 }); // Darker floor
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, side: THREE.DoubleSide, roughness: 1.0 }); // Darker ceiling

        const dungeonGroup = dungeonGroupRef.current;
        dungeonGroup.clear();
        interactableObjectsRef.current = []; // Clear previous objects

        // Orb Geometry and Material Cache
        const orbGeometries: { [K in OrbSize]?: THREE.BufferGeometry } = {};
        const orbMaterials: { [K in OrbSize]?: THREE.MeshStandardMaterial } = {};
        Object.keys(ORB_SIZES).forEach(sizeKey => {
            const size = sizeKey as OrbSize;
            const props = ORB_SIZES[size];
            orbGeometries[size] = new THREE.IcosahedronGeometry(props.scale, 1);
            orbMaterials[size] = new THREE.MeshStandardMaterial({
                color: props.color,
                emissive: props.color,
                emissiveIntensity: props.emissiveIntensity,
                roughness: 0.3,
                metalness: 0.1
            });
        });


        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                const tileCenterX = x * TILE_SIZE;
                const tileCenterZ = z * TILE_SIZE;

                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(tileCenterX, WALL_HEIGHT / 2, tileCenterZ);
                    wall.receiveShadow = false; wall.castShadow = false; // No shadows
                    dungeonGroup.add(wall);

                     // Place interactable light objects (orbs) *on walls*
                    if (Math.random() < OBJECT_PROBABILITY * 0.5) { // Reduced probability for walls
                        const orbSize = getRandomOrbSize();
                        const sizeProps = ORB_SIZES[orbSize];
                        const objectGeometry = orbGeometries[orbSize];
                        const objectMaterial = orbMaterials[orbSize];

                        if (objectGeometry && objectMaterial) {
                            const lightSourceMesh = new THREE.Mesh(objectGeometry, objectMaterial);

                            // Determine wall face and position orb accordingly
                            let offsetX = 0, offsetZ = 0;
                            // Prioritize placing on N/S walls if possible
                            if (z > 0 && dungeonData[z - 1]?.[x] !== DungeonTile.Wall) offsetZ = -TILE_SIZE / 2 + sizeProps.scale * 0.8; // North face
                            else if (z < DUNGEON_SIZE_HEIGHT - 1 && dungeonData[z + 1]?.[x] !== DungeonTile.Wall) offsetZ = TILE_SIZE / 2 - sizeProps.scale * 0.8; // South face
                            else if (x > 0 && dungeonData[z]?.[x - 1] !== DungeonTile.Wall) offsetX = -TILE_SIZE / 2 + sizeProps.scale * 0.8; // West face
                            else if (x < DUNGEON_SIZE_WIDTH - 1 && dungeonData[z]?.[x + 1] !== DungeonTile.Wall) offsetX = TILE_SIZE / 2 - sizeProps.scale * 0.8; // East face

                            if (offsetX !== 0 || offsetZ !== 0) { // Only place if adjacent non-wall found
                                lightSourceMesh.position.set(
                                    tileCenterX + offsetX,
                                    WALL_HEIGHT / 2 + OBJECT_HEIGHT_OFFSET, // Place near vertical center of wall
                                    tileCenterZ + offsetZ
                                );
                                lightSourceMesh.castShadow = false;
                                lightSourceMesh.receiveShadow = false;
                                lightSourceMesh.rotation.x = Math.random() * Math.PI;
                                lightSourceMesh.rotation.y = Math.random() * Math.PI;
                                dungeonGroup.add(lightSourceMesh);

                                const objectId = interactableObjectsRef.current.length;
                                lightSourceMesh.name = `lightOrb_${objectId}`;

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
                    }

                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileCenterX, 0, tileCenterZ);
                    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = false; // No shadows
                    dungeonGroup.add(floor);

                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileCenterX, WALL_HEIGHT, tileCenterZ);
                    ceiling.rotation.x = Math.PI / 2; ceiling.receiveShadow = false; // No shadows
                    dungeonGroup.add(ceiling);

                    // Place interactable light objects (orbs) *on floors/corridors*
                    if (tile === DungeonTile.Floor && Math.random() < OBJECT_PROBABILITY) {
                        const orbSize = getRandomOrbSize();
                        const sizeProps = ORB_SIZES[orbSize];
                        const objectGeometry = orbGeometries[orbSize];
                        const objectMaterial = orbMaterials[orbSize];

                        if (objectGeometry && objectMaterial) {
                            const lightSourceMesh = new THREE.Mesh(objectGeometry, objectMaterial);
                            lightSourceMesh.position.set(
                                tileCenterX,
                                PLAYER_HEIGHT * 0.7, // Keep floor orbs floating at eye level
                                tileCenterZ
                            );
                            lightSourceMesh.castShadow = false;
                            lightSourceMesh.receiveShadow = false;
                            lightSourceMesh.rotation.x = Math.random() * Math.PI;
                            lightSourceMesh.rotation.y = Math.random() * Math.PI;
                            dungeonGroup.add(lightSourceMesh);

                            const objectId = interactableObjectsRef.current.length;
                            lightSourceMesh.name = `lightOrb_${objectId}`;

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
                }
            });
        });
        scene.add(dungeonGroup);

        currentMount.appendChild(renderer.domElement);
        cleanupFunctions.current.push(() => {
             if (currentMount && renderer.domElement && currentMount.contains(renderer.domElement)) {
                 try { currentMount.removeChild(renderer.domElement); }
                 catch (e) { /* Ignore potential error during rapid cleanup */ }
             }
         });

        // Handle window resize
        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);
        cleanupFunctions.current.push(() => window.removeEventListener('resize', handleResize));

        // Keyboard controls
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!gameStarted) return; // Prevent controls before game starts
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
             if (!gameStarted) return;
            const key = event.key.toLowerCase();
            keysPressedRef.current[key] = false;
             switch (key) {
                case 'w': moveForward.current = false; break;
                case 's': moveBackward.current = false; break;
                case 'a': moveLeftStrafe.current = false; break; // Ensure strafe stops on key up
                case 'd': moveRightStrafe.current = false; break; // Ensure strafe stops on key up
                case 'arrowleft': rotateLeft.current = false; break; // Ensure rotate stops on key up
                case 'arrowright': rotateRight.current = false; break; // Ensure rotate stops on key up
            }
        };

        // Add listeners and cleanup
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        cleanupFunctions.current.push(() => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            console.log("Removed key listeners"); // Debug log
        });
        console.log("Added key listeners"); // Debug log


       // --- Animation Loop ---
        const animate = () => {
             if (!gameStarted || !rendererRef.current || !sceneRef.current || !cameraRef.current || !playerRef.current) {
                 console.log("Animation loop stopped or refs missing");
                 animationFrameId.current = null; // Ensure ID is cleared
                 return;
             }
            animationFrameId.current = requestAnimationFrame(animate); // Store frame ID
            const delta = clock.current.getDelta();
            const elapsedTime = clock.current.getElapsedTime();

            // --- Light Decay Logic ---
            const currentPosition = playerRef.current.position;
            const distanceMoved = lastPlayerPosition.current.distanceTo(currentPosition);
            let movedThisFrame = distanceMoved > 0.001; // Use a small threshold

            if (movedThisFrame && lightDuration > 0) { // Only decay if light is present
                 setLightDuration(prevDuration => {
                     const newDuration = Math.max(0, prevDuration - distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED);
                     return newDuration;
                 });
                lastPlayerPosition.current.copy(currentPosition);
            } else if (lightDuration <= 0 && !movedThisFrame) {
                 // Ensure last position is updated even if standing still in darkness
                 lastPlayerPosition.current.copy(currentPosition);
            }
            // --- End Light Decay Logic ---

            // Update Player Glow AND Scene Fog based on remaining light duration - Pitch black logic added
            const lightRatio = Math.max(0, Math.min(1, lightDuration / MAX_LIGHT_DURATION));
            if (playerGlowLightRef.current) {
                if (lightDuration > 0) {
                    playerGlowLightRef.current.intensity = THREE.MathUtils.lerp(MIN_PLAYER_GLOW_INTENSITY, MAX_PLAYER_GLOW_INTENSITY, lightRatio);
                    playerGlowLightRef.current.distance = THREE.MathUtils.lerp(MIN_PLAYER_GLOW_DISTANCE, MAX_PLAYER_GLOW_DISTANCE, lightRatio);
                } else {
                    // PITCH BLACK: Turn off the light completely
                    playerGlowLightRef.current.intensity = ZERO_LIGHT_INTENSITY;
                    playerGlowLightRef.current.distance = ZERO_LIGHT_DISTANCE;
                }
            }
            if (sceneRef.current?.fog) {
                const fog = sceneRef.current.fog as THREE.Fog;
                if (lightDuration > 0) {
                    fog.near = NORMAL_FOG_NEAR;
                    // Fog distance shrinks significantly as light fades, but stays slightly further than pitch black until light is fully out
                    fog.far = THREE.MathUtils.lerp(ZERO_LIGHT_FOG_FAR + 0.5, NORMAL_FOG_FAR, lightRatio);
                    (fog.color as THREE.Color).setHex(NORMAL_FOG_COLOR);
                } else {
                    // PITCH BLACK: Make fog extremely close and black
                    fog.near = ZERO_LIGHT_FOG_NEAR;
                    fog.far = ZERO_LIGHT_FOG_FAR;
                    (fog.color as THREE.Color).setHex(ZERO_LIGHT_FOG_COLOR);
                }
                 // Update background color to match fog color for seamless transition
                if(sceneRef.current.background instanceof THREE.Color){
                    sceneRef.current.background.setHex((fog.color as THREE.Color).getHex());
                }
            }


             // Animate Interactable Objects (Gentle Glow Pulse)
             interactableObjectsRef.current.forEach(obj => {
                 if (obj.mesh.visible) { // Only animate visible orbs
                    // Pulsating emissive intensity
                    const baseIntensity = ORB_SIZES[obj.size].emissiveIntensity;
                    const pulse = (Math.sin(elapsedTime * 2.0 + obj.id * 1.1) + 1) / 2; // 0 to 1 sine wave
                    const material = obj.mesh.material as THREE.MeshStandardMaterial;
                    if(material?.emissiveIntensity !== undefined) {
                         material.emissiveIntensity = baseIntensity * (0.8 + pulse * 0.4); // Pulse between 80% and 120% of base
                    }
                 }
             });


            // --- Player Movement and Rotation ---
            let rotationChange = 0;
            if (rotateLeft.current) rotationChange += ROTATION_SPEED * delta;
            if (rotateRight.current) rotationChange -= ROTATION_SPEED * delta;
            if (Math.abs(rotationChange) > 0.001) {
                playerRotationY.current += rotationChange;
                playerRef.current.rotation.y = playerRotationY.current;

                 // Update camera lookAt target based on player rotation
                const lookDirection = new THREE.Vector3(0, 0, -1); // Base forward direction
                lookDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRotationY.current); // Apply current Y rotation
                lookDirection.normalize();

                // Calculate the target position for the camera to look at
                const lookAtTarget = new THREE.Vector3().copy(playerRef.current.position); // Start at player's position
                lookAtTarget.y = CAMERA_EYE_LEVEL; // Set target height to camera's eye level
                lookAtTarget.add(lookDirection); // Add the rotated direction vector

                cameraRef.current.lookAt(lookAtTarget);
                cameraRef.current.up.set(0, 1, 0); // Ensure the camera remains upright
            }


            const moveDirection = new THREE.Vector3();
            const strafeDirection = new THREE.Vector3();
            // Get forward direction based on the player's current Y rotation
            moveDirection.set(Math.sin(playerRotationY.current), 0, Math.cos(playerRotationY.current)).negate(); // Forward is -Z initially, rotate around Y
            moveDirection.normalize();

            // Calculate right vector for strafing based on the forward direction
            strafeDirection.crossVectors(playerRef.current.up, moveDirection).normalize(); // Right vector is up x forward


            const combinedMove = new THREE.Vector3();
            if (moveForward.current) combinedMove.add(moveDirection);
            if (moveBackward.current) combinedMove.sub(moveDirection);
            if (moveLeftStrafe.current) combinedMove.sub(strafeDirection); // Strafe left uses negative right vector
            if (moveRightStrafe.current) combinedMove.add(strafeDirection); // Strafe right uses positive right vector

            // Normalize if moving diagonally, scale by speed and delta time
            if (combinedMove.lengthSq() > 0.0001) { // Use a small threshold
                combinedMove.normalize();
                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = combinedMove.multiplyScalar(actualMoveSpeed);
                const currentPosBeforeMove = playerRef.current.position.clone();
                const nextPosition = currentPosBeforeMove.clone().add(moveAmount);

                 if (isPositionValid(nextPosition)) {
                    playerRef.current.position.copy(nextPosition);
                 } else {
                     // Sliding collision logic (try moving along X or Z axis separately)
                     const moveXComponent = new THREE.Vector3(moveAmount.x, 0, 0);
                     const nextPositionX = currentPosBeforeMove.clone().add(moveXComponent);
                     const moveZComponent = new THREE.Vector3(0, 0, moveAmount.z);
                     const nextPositionZ = currentPosBeforeMove.clone().add(moveZComponent);

                     let movedX = false;
                     let movedZ = false;

                     if (moveXComponent.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         playerRef.current.position.x = nextPositionX.x;
                         movedX = true;
                     }

                     // Need to re-evaluate Z possibility after potential X move
                     const currentPosForZCheck = playerRef.current.position.clone(); // Get position potentially updated by X move
                     const nextPositionZAfterX = currentPosForZCheck.clone().add(moveZComponent);

                     if (moveZComponent.lengthSq() > 0.0001 && isPositionValid(nextPositionZAfterX)) {
                          playerRef.current.position.z = nextPositionZAfterX.z;
                          movedZ = true;
                     }
                 }
            }
            // --- End Player Movement ---


            // Update discovered tiles and collect light if the player moved
            // This check is now independent of lightDuration
            if (movedThisFrame) {
                 const playerGridX = Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5);
                 const playerGridZ = Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5);
                 updateDiscovery(playerGridX, playerGridZ);
                 collectNearbyLight(); // Attempt to collect light *after* moving
            }


            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        // --- End Animation Loop ---

        clock.current.start(); // Ensure clock is running
        animate(); // Start the animation loop immediately after setup
        console.log("Game setup complete, starting animation loop."); // Debug log


        // Cleanup function
        return () => {
            console.log("Running cleanup function..."); // Debug log
             if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
                console.log("Cancelled animation frame"); // Debug log
             }
             cleanupFunctions.current.forEach(cleanup => cleanup());
             cleanupFunctions.current = [];
             console.log("Executed registered cleanup functions"); // Debug log

            // Explicitly try removing the DOM element again, handling potential errors
             if (currentMount && rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) {
                  try {
                      currentMount.removeChild(rendererRef.current.domElement);
                      console.log("Removed renderer DOM element on cleanup"); // Debug log
                  } catch (e) {
                      console.warn("Error removing renderer DOM element during cleanup:", e);
                  }
             }

             // Dispose Three.js resources
             if (sceneRef.current) {
                 sceneRef.current.traverse((object) => {
                     if (object instanceof THREE.Mesh) {
                         object.geometry?.dispose();
                          if (Array.isArray(object.material)) {
                              object.material.forEach(material => material.dispose());
                          } else if (object.material) {
                              object.material.dispose();
                          }
                     } else if (object instanceof THREE.Light) {
                         object.dispose();
                     }
                 });
                 sceneRef.current.clear(); // Ensure scene is cleared
                 console.log("Disposed scene objects"); // Debug log
             }
              rendererRef.current?.dispose();
              console.log("Disposed renderer"); // Debug log
              clock.current.stop();
              console.log("Stopped clock"); // Debug log

              // Reset refs to initial state or values
              sceneRef.current = undefined;
              rendererRef.current = undefined;
              cameraRef.current = undefined;
              playerRef.current = new THREE.Group(); // Recreate player group
              lastPlayerPosition.current.set(0,0,0);
              dungeonGroupRef.current = new THREE.Group();
              interactableObjectsRef.current = [];
              keysPressedRef.current = {};
              // Correctly reset boolean refs
              moveForward.current = false;
              moveBackward.current = false;
              moveLeftStrafe.current = false;
              moveRightStrafe.current = false;
              rotateLeft.current = false;
              rotateRight.current = false;
              playerRotationY.current = 0;

              console.log("Cleanup complete."); // Debug log
        };
    }, [gameStarted, dungeonData, isPositionValid, collectNearbyLight, updateDiscovery, toast]); // Dependencies


    const playerGridX = playerRef.current ? Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5) : 0;
    const playerGridZ = playerRef.current ? Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5) : 0;

    return (
        <div ref={mountRef} className="w-full h-full relative bg-black">
             {gameStarted && ( // Only render HUD and Minimap if game has started
                 <>
                    <GameHUD lightDuration={lightDuration} maxLightDuration={MAX_LIGHT_DURATION} />
                    <Minimap
                        dungeon={dungeonData}
                        playerX={playerGridX}
                        playerZ={playerGridZ}
                        viewRadius={MINIMAP_VIEW_RADIUS}
                        tileSize={TILE_SIZE}
                        // Filter interactableObjects *before* passing to Minimap
                        interactableObjects={interactableObjectsRef.current.filter(obj => !obj.used && obj.mesh.visible)}
                        discoveredTiles={discoveredTiles}
                        getTileKey={getTileKey}
                    />
                </>
            )}
            {!gameStarted && (
                <IntroScreen onStartGame={startGame} />
            )}
        </div>
    );
};

export default Game;
