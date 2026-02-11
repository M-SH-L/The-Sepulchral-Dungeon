'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

import { cn } from '@/lib/utils';
import { generateDungeon, DungeonTile } from './dungeon-generator';
import ControlsDisplay from './controls-display';
import LightMeter from './light-meter';
import Minimap from './minimap'; // Import Minimap
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { Button } from '@/components/ui/button';
import { Geist_Mono } from 'next/font/google';

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});


// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const COLLECTION_DISTANCE = 1.5; // Adjust as needed to ensure smooth and consistent light collection
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
const MOVE_SPEED = 3.5;
const ROTATION_SPEED = Math.PI / 3; // Radians per second
const TILE_SIZE = 5; // Size of each tile in world units
const WALL_HEIGHT = 3.5;
const CEILING_HEIGHT = WALL_HEIGHT; // Ceiling at the same height as walls

const MAX_LIGHT_DURATION = 100; // Represents 100% light initially
const LIGHT_DECAY_PER_UNIT_MOVED = 0.5; // How much light decreases per unit distance moved

// Player Light Properties
const INITIAL_PLAYER_LIGHT_INTENSITY = 1.5; // Brighter initial intensity
const MAX_PLAYER_LIGHT_INTENSITY = 3.5; // Maximum intensity player light can reach
const MIN_PLAYER_LIGHT_INTENSITY = 0; // Minimum intensity (pitch black)
const INITIAL_PLAYER_LIGHT_DISTANCE = 5.0 * TILE_SIZE; // Initial light distance (spread)
const MAX_PLAYER_LIGHT_DISTANCE = 7.0 * TILE_SIZE; // Maximum light distance (spread)
const MIN_PLAYER_LIGHT_DISTANCE = 0; // Minimum light distance (pitch black)


// Orb Light Properties
const ORB_BASE_INTENSITY = 0.8; // Slightly dimmer base intensity
const ORB_PULSE_AMOUNT = 0.3; // How much intensity changes during pulse
const ORB_PULSE_SPEED = 1.5; // Speed of the pulsing effect
const ORB_HOVER_SPEED = 0.4;
const ORB_HOVER_AMOUNT = 0.1;
const ORB_SPAWN_HEIGHT = PLAYER_HEIGHT * 0.7; // Spawn orbs near eye level

// Orb Sizes and Light Values
const ORB_SIZES = {
    small: { radius: 0.15, lightValue: 15 },
    medium: { radius: 0.25, lightValue: 30 },
    large: { radius: 0.35, lightValue: 50 },
};
type OrbSize = keyof typeof ORB_SIZES;

interface InteractableObjectData {
    mesh: THREE.Mesh;
    id: number;
    light: THREE.PointLight;
    baseY: number; // Store the base Y position for hovering
    size: OrbSize;
    used?: boolean;
}

// Function to get tile key for the discovered set
const getTileKey = (x: number, z: number) => `${x},${z}`;


const IntroScreen: React.FC<{ onStartGame: () => void }> = ({ onStartGame }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                onStartGame();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onStartGame]);

    return (
        <div className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-sepia-foreground p-8",
            geistMono.variable, // Apply Geist Mono font variable
            "intro-screen-font" // Use the specific font class
        )}>
            <h1 className="text-5xl font-bold mb-6 text-primary animate-pulse">Sepia Dungeon Explorer</h1>
            <p className="text-lg text-center mb-8 max-w-md text-foreground/80">
                Navigate the dimly lit corridors. Collect light orbs to keep your path illuminated.
                If the light fades completely, the darkness consumes you.
            </p>
            <div className="text-left mb-8 bg-background/10 p-4 rounded border border-primary/50 max-w-sm w-full">
                <h2 className="text-xl font-semibold mb-3 text-primary-foreground">Instructions & Controls</h2>
                 <ul className="list-none space-y-1 text-sm text-foreground/90">
                     <li><span className="font-semibold text-primary-foreground">[ W ] :</span> Move Forward</li>
                     <li><span className="font-semibold text-primary-foreground">[ S ] :</span> Move Backward</li>
                     <li><span className="font-semibold text-primary-foreground">[ ← ] :</span> Look Left</li>
                     <li><span className="font-semibold text-primary-foreground">[ → ] :</span> Look Right</li>
                     <li className="mt-2">Collect light orbs by walking near them.</li>
                     <li>Keep your Light Meter above zero to survive.</li>
                     <li>Explore the maze to find the exit (not yet implemented).</li>
                </ul>
            </div>
            <Button
                onClick={onStartGame}
                className="text-xl px-8 py-4 bg-primary hover:bg-primary/80 text-primary-foreground"
                aria-label="Start Game (Press Enter)"
            >
                Enter the Dungeon <span className="text-sm ml-2">(Press Enter)</span>
            </Button>
        </div>
    );
};


function Game() {
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const playerRef = useRef<THREE.Mesh | null>(null); // Represents the player's position/collision body
    const playerLightRef = useRef<THREE.PointLight | null>(null); // Player's light source
    const controlsRef = useRef<{ update: (delta: number) => void } | null>(null); // Simplified controls ref
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});

    // State for game logic
    const [dungeon, setDungeon] = useState<DungeonTile[][]>([]);
    const [interactableObjects, setInteractableObjects] = useState<InteractableObjectData[]>([]);
    const playerPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0));
    const playerRotationY = useRef(0); // Player's current rotation around Y axis
    const lightDurationRef = useRef(MAX_LIGHT_DURATION);
    const [lightDurationHud, setLightDurationHud] = useState(MAX_LIGHT_DURATION);
    const isGameOverRef = useRef(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const showIntroRef = useRef(true);
    const [showIntro, setShowIntro] = useState(true); // Show intro screen initially
    const { toast } = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    // Movement states using refs to avoid re-renders in animation loop
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    // const moveLeft = useRef(false); // Strafe left
    // const moveRight = useRef(false); // Strafe right
    const rotateLeft = useRef(false);
    const rotateRight = useRef(false);

    // Refs for animation loop (avoid stale closures)
    const interactableObjectsRef = useRef<InteractableObjectData[]>([]);
    const dungeonRef = useRef<DungeonTile[][]>([]);

    // Minimap related state
    const [discoveredTiles, setDiscoveredTiles] = useState<Set<string>>(new Set());
    const [playerGridPos, setPlayerGridPos] = useState({ x: 0, z: 0 });

    // Callback to start the game
    const startGame = useCallback(() => {
        setShowIntro(false);
        showIntroRef.current = false;
        lightDurationRef.current = MAX_LIGHT_DURATION;
        setLightDurationHud(MAX_LIGHT_DURATION);
        isGameOverRef.current = false;
        setIsGameOver(false);
        playerRotationY.current = 0;
    }, []);


    // Effect for dungeon generation and initial setup
    useEffect(() => {
        const width = 30; // Dungeon width in tiles
        const height = 30; // Dungeon height in tiles
        const generatedDungeon = generateDungeon(width, height, 15, 4, 8);
        setDungeon(generatedDungeon);

        // Find a valid starting floor position
        let startX = -1, startZ = -1;
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                if (generatedDungeon[z][x] === DungeonTile.Floor || generatedDungeon[z][x] === DungeonTile.Corridor) {
                    startX = x;
                    startZ = z;
                    break;
                }
            }
            if (startX !== -1) break;
        }

        // Fallback if no floor found (shouldn't happen with current generator)
        if (startX === -1) {
            startX = Math.floor(width / 2);
            startZ = Math.floor(height / 2);
             if (startX > 0 && startX < width -1 && startZ > 0 && startZ < height -1) {
                 generatedDungeon[startZ][startX] = DungeonTile.Floor; // Ensure a floor tile exists
             } else {
                 // Extreme fallback: center of a small 3x3 area if dimensions are too small
                 startX = 1; startZ = 1;
                 if (generatedDungeon[startZ]?.[startX]) generatedDungeon[startZ][startX] = DungeonTile.Floor;
             }
        }


        const initialWorldX = startX * TILE_SIZE;
        const initialWorldZ = startZ * TILE_SIZE;
        const initialPosition = new THREE.Vector3(initialWorldX, PLAYER_HEIGHT / 2, initialWorldZ);
        playerPositionRef.current = initialPosition;
        setPlayerGridPos({ x: startX, z: startZ }); // Set initial grid pos for minimap


        // Initialize Three.js scene, camera, renderer
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        // Set scene background to black for pitch black effect when light is out
        scene.background = new THREE.Color(0x000000); // Pitch black


        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.y = CAMERA_EYE_LEVEL; // Set camera at eye level
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true; // Enable shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
        mountRef.current?.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Player representation (optional, for collision visualization)
        // const playerGeo = new THREE.CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_HEIGHT, 16);
        // const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false }); // Invisible player marker
        // const playerMesh = new THREE.Mesh(playerGeo, playerMat);
        // playerMesh.position.copy(initialPosition); // Start at the calculated position
        // scene.add(playerMesh);
        // playerRef.current = playerMesh;

         // Player Light Source - Starts enabled
         const playerLight = new THREE.PointLight(0xffeedd, INITIAL_PLAYER_LIGHT_INTENSITY, INITIAL_PLAYER_LIGHT_DISTANCE); // Warm light
         playerLight.position.set(initialPosition.x, CAMERA_EYE_LEVEL + 0.2, initialPosition.z); // Position light slightly above camera
         playerLight.castShadow = true;
         // Configure shadow properties for performance vs quality
         playerLight.shadow.mapSize.width = 1024; // default 512
         playerLight.shadow.mapSize.height = 1024; // default 512
         playerLight.shadow.camera.near = 0.5;
         playerLight.shadow.camera.far = MAX_PLAYER_LIGHT_DISTANCE * 1.2; // Adjust far based on max light distance
         playerLight.shadow.bias = -0.005; // Adjust shadow bias to prevent artifacts

         scene.add(playerLight);
         playerLightRef.current = playerLight;

        // Add ceiling
        const ceilingGeometry = new THREE.PlaneGeometry(width * TILE_SIZE, height * TILE_SIZE);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4d41, side: THREE.DoubleSide }); // Slightly different sepia tone
        const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceilingMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
        ceilingMesh.position.set((width / 2) * TILE_SIZE - TILE_SIZE / 2, CEILING_HEIGHT, (height / 2) * TILE_SIZE - TILE_SIZE / 2); // Center and position at ceiling height
        ceilingMesh.receiveShadow = true; // Ceiling receives shadows
        scene.add(ceilingMesh);


        // Generate dungeon geometry
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6c5d53 }); // Sepia-toned wall
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7e75 }); // Lighter sepia floor
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);


        generatedDungeon.forEach((row, z) => {
            row.forEach((tile, x) => {
                const worldX = x * TILE_SIZE;
                const worldZ = z * TILE_SIZE;

                if (tile === DungeonTile.Wall) {
                    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
                    wallMesh.position.set(worldX, WALL_HEIGHT / 2, worldZ);
                    wallMesh.castShadow = true;
                    wallMesh.receiveShadow = true;
                    scene.add(wallMesh);
                } else { // Floor or Corridor
                    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
                    floorMesh.rotation.x = -Math.PI / 2;
                    floorMesh.position.set(worldX, 0, worldZ);
                    floorMesh.receiveShadow = true; // Floors receive shadows
                    scene.add(floorMesh);
                }
            });
        });

        // Spawn interactable light orbs
        const objects: InteractableObjectData[] = [];
        let objectId = 0;
        const orbMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc66, // Warm yellow/orange
            emissive: 0xffaa00, // Make it glow slightly
            emissiveIntensity: 0.5, // Adjust glow intensity
        });

        generatedDungeon.forEach((row, z) => {
            row.forEach((tile, x) => {
                 // Spawn only on floor/corridor tiles, less frequently
                 if ((tile === DungeonTile.Floor || tile === DungeonTile.Corridor) && Math.random() < 0.15) {
                     const worldX = x * TILE_SIZE;
                     const worldZ = z * TILE_SIZE;
                     const baseY = ORB_SPAWN_HEIGHT; // Spawn at a consistent height

                     // Randomly choose orb size
                     const sizeKeys = Object.keys(ORB_SIZES) as OrbSize[];
                     const size = sizeKeys[Math.floor(Math.random() * sizeKeys.length)];
                     const orbData = ORB_SIZES[size];

                     const orbGeometry = new THREE.SphereGeometry(orbData.radius, 16, 16);
                     const orbMesh = new THREE.Mesh(orbGeometry, orbMaterial.clone()); // Clone material for unique emissive control if needed later
                     orbMesh.position.set(worldX, baseY, worldZ);
                     orbMesh.castShadow = true; // Orbs can cast shadows

                     // Add a point light for the orb itself
                     const orbLight = new THREE.PointLight(0xffaa00, ORB_BASE_INTENSITY, TILE_SIZE * 1.5); // Orb light doesn't cast shadows by default for performance
                     orbLight.position.copy(orbMesh.position);
                     orbLight.castShadow = false; // Orb lights do not cast shadows for performance

                     scene.add(orbMesh);
                     scene.add(orbLight);
                     objects.push({ mesh: orbMesh, id: objectId++, light: orbLight, baseY, size });
                 }
            });
        });
        setInteractableObjects(objects);
        interactableObjectsRef.current = objects;
        dungeonRef.current = generatedDungeon;


        // Keyboard handlers
        const handleKeyDown = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = true;
            const key = event.key.toLowerCase();
            switch (key) {
                case 'w': moveForward.current = true; break;
                case 's': moveBackward.current = true; break;
                case 'arrowleft': rotateLeft.current = true; break;
                case 'arrowright': rotateRight.current = true; break;
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = false;
            const key = event.key.toLowerCase();
            switch (key) {
                case 'w': moveForward.current = false; break;
                case 's': moveBackward.current = false; break;
                case 'arrowleft': rotateLeft.current = false; break;
                case 'arrowright': rotateRight.current = false; break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Handle window resize
        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                const width = window.innerWidth;
                const height = window.innerHeight;
                cameraRef.current.aspect = width / height;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(width, height);
            }
        };
        window.addEventListener('resize', handleResize);


        // Simplified controls state management (using refs)
         controlsRef.current = {
             update: (delta: number) => {
                 const moveSpeed = MOVE_SPEED * delta;
                 const rotateSpeed = ROTATION_SPEED * delta;
                 let distanceMoved = 0;

                 // Calculate forward/backward movement direction based on player rotation
                 const moveDirection = new THREE.Vector3();
                 if (cameraRef.current) {
                     cameraRef.current.getWorldDirection(moveDirection);
                     moveDirection.y = 0; // Ensure movement is only on the XZ plane
                     moveDirection.normalize();
                 }

                 const currentPos = playerPositionRef.current.clone(); // Get current position
                 const nextPos = currentPos.clone(); // Calculate potential next position

                 if (moveForward.current) {
                     const forwardMove = moveDirection.clone().multiplyScalar(moveSpeed);
                     nextPos.add(forwardMove);
                     distanceMoved += moveSpeed;
                 }
                 if (moveBackward.current) {
                     const backwardMove = moveDirection.clone().multiplyScalar(-moveSpeed);
                      nextPos.add(backwardMove);
                      distanceMoved += moveSpeed;
                 }


                 // No strafing needed with current controls
                 // if (moveLeft.current) {
                 //     // Calculate left direction (cross product of camera direction and up vector)
                 //     const leftDirection = new THREE.Vector3();
                 //     if (cameraRef.current) {
                 //         cameraRef.current.getWorldDirection(leftDirection);
                 //         leftDirection.cross(cameraRef.current.up); // Get vector pointing left
                 //         leftDirection.y = 0;
                 //         leftDirection.normalize();
                 //         const leftMove = leftDirection.multiplyScalar(moveSpeed);
                 //         nextPos.add(leftMove);
                 //         distanceMoved += moveSpeed;
                 //     }
                 // }
                 // if (moveRight.current) {
                 //      // Calculate right direction (cross product of up vector and camera direction)
                 //     const rightDirection = new THREE.Vector3();
                 //     if (cameraRef.current) {
                 //         cameraRef.current.getWorldDirection(rightDirection);
                 //         rightDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // Rotate 90 degrees right
                 //         rightDirection.y = 0;
                 //         rightDirection.normalize();
                 //         const rightMove = rightDirection.multiplyScalar(moveSpeed);
                 //         nextPos.add(rightMove);
                 //         distanceMoved += moveSpeed;
                 //     }
                 // }


                // Collision detection
                if (!isWallCollision(nextPos, generatedDungeon)) {
                     playerPositionRef.current = nextPos;
                 } else {
                     distanceMoved = 0; // Don't decay light if movement was blocked
                 }


                // Handle Rotation
                if (rotateLeft.current) {
                    playerRotationY.current += rotateSpeed;
                }
                if (rotateRight.current) {
                    playerRotationY.current -= rotateSpeed;
                }
                 if (cameraRef.current) {
                     // Apply rotation directly to the camera's quaternion
                     const quaternion = new THREE.Quaternion();
                     quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerRotationY.current);
                     cameraRef.current.quaternion.copy(quaternion);
                 }

                // Decrease light duration based on distance moved
                 if (distanceMoved > 0 && !isGameOverRef.current) {
                     lightDurationRef.current = Math.max(0, lightDurationRef.current - distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED);
                     setLightDurationHud(lightDurationRef.current);
                 }
             }
         };

         // Add initial tile to discovered
         setDiscoveredTiles(prev => new Set(prev).add(getTileKey(startX, startZ)));


        // Cleanup function
        return () => {
            window.removeEventListener('resize', handleResize);
             // Remove key listeners on unmount
             window.removeEventListener('keydown', handleKeyDown);
             window.removeEventListener('keyup', handleKeyUp);

            mountRef.current?.removeChild(renderer.domElement); // Use optional chaining
            renderer.dispose();
            scene.clear(); // Dispose of scene objects
            // Dispose geometries and materials if needed for complex scenes
        };
    }, [startGame]); // Run only once on mount, startGame dependency is stable


    // Function for collision detection
     const isWallCollision = (position: THREE.Vector3, dungeonMap: DungeonTile[][]): boolean => {
         const gridX = Math.floor((position.x + (TILE_SIZE / 2 * Math.sign(position.x))) / TILE_SIZE);
         const gridZ = Math.floor((position.z + (TILE_SIZE / 2 * Math.sign(position.z))) / TILE_SIZE);


         // Check boundaries and wall tiles considering player radius
         const checkRadius = PLAYER_RADIUS;
         for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip center

                const checkX = position.x + dx * checkRadius;
                const checkZ = position.z + dz * checkRadius;

                const checkGridX = Math.floor(checkX / TILE_SIZE + 0.5);
                const checkGridZ = Math.floor(checkZ / TILE_SIZE + 0.5);


                 if (checkGridZ < 0 || checkGridZ >= dungeonMap.length || checkGridX < 0 || checkGridX >= dungeonMap[0].length) {
                     return true; // Collision with map boundary
                 }
                if (dungeonMap[checkGridZ]?.[checkGridX] === DungeonTile.Wall) {
                    // More precise bounding box check (optional but better)
                    const wallMinX = checkGridX * TILE_SIZE - TILE_SIZE / 2;
                    const wallMaxX = checkGridX * TILE_SIZE + TILE_SIZE / 2;
                    const wallMinZ = checkGridZ * TILE_SIZE - TILE_SIZE / 2;
                    const wallMaxZ = checkGridZ * TILE_SIZE + TILE_SIZE / 2;

                    if (
                        position.x + PLAYER_RADIUS > wallMinX &&
                        position.x - PLAYER_RADIUS < wallMaxX &&
                        position.z + PLAYER_RADIUS > wallMinZ &&
                        position.z - PLAYER_RADIUS < wallMaxZ
                    ) {
                        return true; // Collision with wall
                    }
                }
            }
        }

        return false; // No collision
    };


     // Animation loop
     useEffect(() => {
         let animationFrameId: number;
         const clock = new THREE.Clock();

         let lastGridX = -1;
         let lastGridZ = -1;

         const animate = () => {
             animationFrameId = requestAnimationFrame(animate);

             if (showIntroRef.current || isGameOverRef.current) {
                 // Still render the scene even if paused or intro is shown
                 if (rendererRef.current && sceneRef.current && cameraRef.current) {
                     rendererRef.current.render(sceneRef.current, cameraRef.current);
                 }
                 return;
             }

            const delta = clock.getDelta();
            const pos = playerPositionRef.current;
            const light = lightDurationRef.current;
            const objects = interactableObjectsRef.current;

             // Update controls (movement/rotation)
             controlsRef.current?.update(delta);

             // Update player position and camera based on refs
             if (cameraRef.current && playerLightRef.current) {
                 cameraRef.current.position.x = pos.x;
                 cameraRef.current.position.z = pos.z;
                 cameraRef.current.position.y = CAMERA_EYE_LEVEL;

                 playerLightRef.current.position.x = pos.x;
                 playerLightRef.current.position.z = pos.z;
                 playerLightRef.current.position.y = CAMERA_EYE_LEVEL + 0.1;

                 // Update player's grid position for minimap
                 const currentGridX = Math.floor(pos.x / TILE_SIZE + 0.5);
                 const currentGridZ = Math.floor(pos.z / TILE_SIZE + 0.5);
                 if (currentGridX !== lastGridX || currentGridZ !== lastGridZ) {
                     lastGridX = currentGridX;
                     lastGridZ = currentGridZ;
                     setPlayerGridPos({ x: currentGridX, z: currentGridZ });

                     // Discover new tiles around the player
                     const discoveryRadius = 2;
                     setDiscoveredTiles(prev => {
                         const next = new Set(prev);
                         for (let dz = -discoveryRadius; dz <= discoveryRadius; dz++) {
                             for (let dx = -discoveryRadius; dx <= discoveryRadius; dx++) {
                                 next.add(getTileKey(currentGridX + dx, currentGridZ + dz));
                             }
                         }
                         return next;
                     });
                 }
             }

             // Update Light Intensity & Distance based on lightDuration
             if (playerLightRef.current) {
                 const lightRatio = light / MAX_LIGHT_DURATION;
                 const easedRatio = Math.pow(lightRatio, 1.5);

                 const currentIntensity = THREE.MathUtils.lerp(MIN_PLAYER_LIGHT_INTENSITY, MAX_PLAYER_LIGHT_INTENSITY, easedRatio);
                 const currentDistance = THREE.MathUtils.lerp(MIN_PLAYER_LIGHT_DISTANCE, MAX_PLAYER_LIGHT_DISTANCE, easedRatio);

                 playerLightRef.current.intensity = currentIntensity;
                 playerLightRef.current.distance = currentDistance;

                 // Make orb lights visible/invisible based on player light
                 objects.forEach(obj => {
                     if (obj.light) {
                         obj.light.visible = currentIntensity > MIN_PLAYER_LIGHT_INTENSITY;
                     }
                     if (obj.mesh) {
                         const orbMat = obj.mesh.material as THREE.MeshStandardMaterial;
                         orbMat.emissiveIntensity = currentIntensity > MIN_PLAYER_LIGHT_INTENSITY ? 0.5 : 0.05;
                     }
                 });
             }

             // Check for game over
             if (light <= 0 && !isGameOverRef.current) {
                 isGameOverRef.current = true;
                 setIsGameOver(true);
                 toastRef.current({
                     title: "Engulfed by Darkness",
                     description: "Your light has faded completely.",
                     variant: "destructive",
                 });
                 setTimeout(() => {
                     showIntroRef.current = true;
                     setShowIntro(true);
                 }, 3000);
             }

             // Check for interaction with light orbs
             objects.forEach((obj) => {
                 if (!obj.used && obj.mesh.visible && pos.distanceTo(obj.mesh.position) < COLLECTION_DISTANCE) {
                     const lightValue = ORB_SIZES[obj.size].lightValue;
                     lightDurationRef.current = Math.min(MAX_LIGHT_DURATION, lightDurationRef.current + lightValue);
                     setLightDurationHud(lightDurationRef.current);
                     obj.used = true;
                     obj.mesh.visible = false;
                     if (obj.light) obj.light.visible = false;

                     toastRef.current({
                         title: `Light Orb Collected! (+${lightValue})`,
                         description: `Your light meter is now ${lightDurationRef.current.toFixed(0)}%`,
                     });
                 }
             });

             // Animate orbs (pulse and hover)
             const time = clock.getElapsedTime();
             objects.forEach(obj => {
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

             // Render the scene
             if (rendererRef.current && sceneRef.current && cameraRef.current) {
                 rendererRef.current.render(sceneRef.current, cameraRef.current);
             }
         };

         animate();

         return () => {
             cancelAnimationFrame(animationFrameId);
         };
     }, []); // Empty dependency array - all state read from refs


    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            {showIntro && <IntroScreen onStartGame={startGame} />}
            <div ref={mountRef} className="absolute top-0 left-0 h-full w-full" />
             {!showIntro && (
                <>
                     <ControlsDisplay />
                     <Minimap
                         dungeon={dungeon}
                         playerX={playerGridPos.x}
                         playerZ={playerGridPos.z}
                         viewRadius={5} // How many tiles around the player to show
                         tileSize={TILE_SIZE}
                         interactableObjects={interactableObjects}
                         discoveredTiles={discoveredTiles}
                         getTileKey={getTileKey}
                         isPlayerLightOut={lightDurationHud <= 0} // Pass light status
                     />
                     <LightMeter
                         lightDuration={lightDurationHud}
                         maxLightDuration={MAX_LIGHT_DURATION}
                     />
                </>
             )}
             {isGameOver && (
                 <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
                     <p className="text-4xl font-bold text-destructive animate-pulse">GAME OVER</p>
                 </div>
             )}
        </div>
    );
}
export default Game;
