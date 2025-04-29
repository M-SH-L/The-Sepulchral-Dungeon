
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
// Removed PointerLockControls import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateDungeon, DungeonTile } from './dungeon-generator';
import { useToast } from '@/hooks/use-toast';
import Minimap from './minimap'; // Import the new Minimap component

interface InteractableObject {
    mesh: THREE.Mesh;
    info: string;
    id: number;
}

interface TorchData {
    group: THREE.Group;
    light: THREE.PointLight;
    flame: THREE.Mesh;
}

// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const INTERACTION_DISTANCE = 1.5;
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9;
const MOVE_SPEED = 3.5;
const ROTATION_SPEED = Math.PI * 0.6; // Radians per second for turning
const DUNGEON_SIZE_WIDTH = 30;
const DUNGEON_SIZE_HEIGHT = 30;
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0;
const TORCH_PROBABILITY = 0.04;
const BASE_TORCH_LIGHT_INTENSITY = 1.5;
const TORCH_LIGHT_DISTANCE = 5.0;
const TORCH_LIGHT_COLOR = 0xffa54a;
const TORCH_HEIGHT_OFFSET = 1.2;
const FLICKER_SPEED = 5.0;
const FLICKER_INTENSITY_VARIATION = 0.5;
const FLICKER_POSITION_VARIATION = 0.03;
const PLAYER_GLOW_INTENSITY = 1.8; // Intensity of the light around the player
const PLAYER_GLOW_DISTANCE = 4.0; // How far the player's light reaches
const PLAYER_GLOW_COLOR = 0xffffff; // Neutral white light
const MINIMAP_VIEW_RADIUS = 5; // How many tiles around the player to show on the minimap

// Function to create a torch model and light (unchanged)
const createTorch = (position: THREE.Vector3): TorchData => {
    const torchGroup = new THREE.Group();
    const stickGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 });
    const stickMesh = new THREE.Mesh(stickGeometry, stickMaterial);
    stickMesh.position.y = 0.5;
    stickMesh.castShadow = true;
    torchGroup.add(stickMesh);
    const flameGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_LIGHT_COLOR });
    const flameMesh = new THREE.Mesh(flameGeometry, flameMaterial);
    flameMesh.position.y = 1.0 + 0.1;
    flameMesh.name = "torchFlame";
    torchGroup.add(flameMesh);
    const pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, BASE_TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
    pointLight.position.y = TORCH_HEIGHT_OFFSET;
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 256;
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.bias = -0.01;
    pointLight.name = "torchLight";
    torchGroup.add(pointLight);
    torchGroup.position.copy(position);
    return { group: torchGroup, light: pointLight, flame: flameMesh };
};

// HUD Component - Updated Controls
const GameHUD: React.FC = () => {
    return (
        <div className="absolute top-4 left-4 p-4 bg-background/70 text-foreground rounded-md shadow-lg text-sm border border-primary pointer-events-none z-10">
            <h3 className="font-bold mb-2 text-base">Controls</h3>
            <ul className="list-none space-y-1">
                <li><span className="font-semibold">W, A, S, D:</span> Move</li>
                <li><span className="font-semibold">Arrow Left/Right:</span> Look</li>
                <li><span className="font-semibold">Enter:</span> Interact (when near object)</li>
                <li><span className="font-semibold">Esc:</span> Close Pop-up</li>
            </ul>
        </div>
    );
};

// Intro Screen Component - Updated Start Logic
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
        <div className="w-screen h-screen flex items-center justify-center bg-background">
            <Card className="w-[450px] shadow-xl border-primary">
                <CardHeader className="bg-primary p-6 rounded-t-lg">
                    <CardTitle className="text-primary-foreground text-2xl text-center">Sepia Dungeon Explorer</CardTitle>
                    <CardDescription className="text-primary-foreground/80 text-center pt-2">
                        Venture into the flickering torchlight...
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4 text-center">
                    <p className="text-foreground">
                        Explore the procedurally generated dungeon. Use W/A/S/D keys to move and Left/Right Arrow keys to look around.
                        Find mysterious objects and press Enter to inspect them. Click the button or press Enter to begin.
                    </p>
                    <Button onClick={onStartGame} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6">
                        Begin Exploration (or press Enter)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};


const Game: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<THREE.Group>(new THREE.Group());
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    // Removed controlsRef
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const dungeonGroupRef = useRef<THREE.Group>(new THREE.Group());
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const torchesRef = useRef<TorchData[]>([]);
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState('');
    const [nearbyObject, setNearbyObject] = useState<InteractableObject | null>(null);
    // Removed isPointerLocked state
    const [gameStarted, setGameStarted] = useState(false);
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeftStrafe = useRef(false); // Renamed for clarity
    const moveRightStrafe = useRef(false); // Renamed for clarity
    const rotateLeft = useRef(false);
    const rotateRight = useRef(false);
    const playerRotationY = useRef(0); // Store player rotation angle
    // Removed velocity and direction refs as movement is calculated differently
    const { toast } = useToast();
    const clock = useRef(new THREE.Clock());

    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 15, 5, 9), []);

    // Interaction Logic - No longer depends on pointer lock
    const handleInteraction = useCallback(() => {
        if (nearbyObject) { // Only interact if near an object
            setPopupContent(nearbyObject.info);
            setIsPopupOpen(true);
            // No pointer unlock needed
        }
    }, [nearbyObject]);

    // Collision Detection (unchanged)
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

    // Function to handle starting the game
    const startGame = useCallback(() => {
        setGameStarted(true);
        // No pointer lock attempt needed
    }, []);


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return;

        const currentMount = mountRef.current;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0x4a3026); // Sepia background
        scene.fog = new THREE.Fog(0x4a3026, 3, 15); // Sepia fog

        // --- Camera Setup ---
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        cameraRef.current = camera;
        camera.position.y = CAMERA_EYE_LEVEL; // Camera at eye level relative to player group
        camera.lookAt(0, CAMERA_EYE_LEVEL, -1); // Look forward initially


        // --- Renderer Setup ---
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;

        // Apply sepia filter using post-processing
        // Note: Three.js doesn't have a built-in sepia filter.
        // We can achieve this by adjusting lighting and materials, or using a post-processing pass.
        // For simplicity, we'll rely on the sepia background, fog, and material colors.
        // A more advanced approach would involve THREE.ShaderPass with a sepia shader.

        // --- Lighting Setup ---
        const ambientLight = new THREE.AmbientLight(0x504030, 0.3); // Dim sepia ambient light
        scene.add(ambientLight);

        // --- Player Setup ---
        const player = playerRef.current;
        player.position.y = 0; // Player group at floor level
        player.add(camera); // Add camera as child of player group
        scene.add(player);

        // Add Player Glow Light
        const playerGlowLight = new THREE.PointLight(PLAYER_GLOW_COLOR, PLAYER_GLOW_INTENSITY, PLAYER_GLOW_DISTANCE);
        playerGlowLight.position.set(0, PLAYER_HEIGHT * 0.5, 0); // Position light source near player center
        playerGlowLight.castShadow = false; // Player glow doesn't need to cast shadows
        player.add(playerGlowLight); // Add light as child of player

        // Find starting position (unchanged)
        let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
        let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
        let foundStart = false;
         outerLoop: for (let z = 1; z < dungeonData.length - 1; z++) {
            for (let x = 1; x < dungeonData[z].length - 1; x++) {
                 if (dungeonData[z][x] === DungeonTile.Floor) {
                     startX = x;
                     startZ = z;
                     foundStart = true;
                     break outerLoop;
                 } else if (!foundStart && dungeonData[z][x] === DungeonTile.Corridor) {
                    startX = x;
                    startZ = z;
                 }
            }
        }
         if (!foundStart && dungeonData[startZ]?.[startX] === DungeonTile.Wall) {
              outerLoopFallback: for (let z = 1; z < dungeonData.length - 1; z++) {
                 for (let x = 1; x < dungeonData[z].length - 1; x++) {
                      if (dungeonData[z][x] !== DungeonTile.Wall) {
                          startX = x;
                          startZ = z;
                          break outerLoopFallback;
                      }
                 }
              }
         }
        player.position.set(startX * TILE_SIZE, 0, startZ * TILE_SIZE);
        playerRotationY.current = 0; // Start looking straight ahead (along negative Z initially)

        // --- Dungeon Rendering (includes torch placement) ---
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        // Adjusted material colors for a stronger sepia feel
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 }); // Darker brown wall
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 }); // Muted sepia floor
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x6A4F3A, side: THREE.DoubleSide, roughness: 1.0 }); // Sepia ceiling

        const dungeonGroup = dungeonGroupRef.current;
        torchesRef.current = [];
        interactableObjectsRef.current = [];
        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                const tileCenterX = x * TILE_SIZE;
                const tileCenterZ = z * TILE_SIZE;

                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(tileCenterX, WALL_HEIGHT / 2, tileCenterZ);
                    wall.receiveShadow = true;
                    wall.castShadow = true;
                    dungeonGroup.add(wall);
                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileCenterX, 0, tileCenterZ);
                    floor.rotation.x = -Math.PI / 2;
                    floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileCenterX, WALL_HEIGHT, tileCenterZ);
                    ceiling.rotation.x = Math.PI / 2;
                    ceiling.receiveShadow = true; // Ceiling should receive shadows
                    dungeonGroup.add(ceiling);

                     let isNearWall = false;
                     if (dungeonData[z + 1]?.[x] === DungeonTile.Wall ||
                         dungeonData[z - 1]?.[x] === DungeonTile.Wall ||
                         dungeonData[z]?.[x + 1] === DungeonTile.Wall ||
                         dungeonData[z]?.[x - 1] === DungeonTile.Wall) {
                         isNearWall = true;
                     }

                     if (isNearWall && tile !== DungeonTile.Corridor && Math.random() < TORCH_PROBABILITY) {
                        // Find a wall adjacent to this floor/corridor tile to place the torch
                        let torchPos = new THREE.Vector3(tileCenterX, 0, tileCenterZ);
                        if (dungeonData[z]?.[x+1] === DungeonTile.Wall) torchPos.x += TILE_SIZE/2 - 0.1;
                        else if (dungeonData[z]?.[x-1] === DungeonTile.Wall) torchPos.x -= TILE_SIZE/2 - 0.1;
                        else if (dungeonData[z+1]?.[x] === DungeonTile.Wall) torchPos.z += TILE_SIZE/2 - 0.1;
                        else if (dungeonData[z-1]?.[x] === DungeonTile.Wall) torchPos.z -= TILE_SIZE/2 - 0.1;
                        else torchPos.x += 0.1; // fallback placement slightly offset

                        const torchData = createTorch(torchPos);
                        dungeonGroup.add(torchData.group);
                        torchesRef.current.push(torchData);
                    }

                    if (tile === DungeonTile.Floor && Math.random() < 0.04) {
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0); // Simple low-poly shape
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.1 }); // Deep brown accent
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(tileCenterX, 0.3, tileCenterZ);
                        placeholderObject.castShadow = true;
                        placeholderObject.receiveShadow = true;
                        placeholderObject.rotation.x = Math.random() * Math.PI;
                        placeholderObject.rotation.y = Math.random() * Math.PI;
                        dungeonGroup.add(placeholderObject);
                        interactableObjectsRef.current.push({
                            mesh: placeholderObject,
                            info: `At grid (${x}, ${z}), you find a mysterious artifact pulsating with a faint, warm energy. It appears ancient, perhaps a key or power source left behind by previous explorers. Its surface is covered in worn, unreadable symbols.\n\n[Scroll down for more...]\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
                            id: interactableObjectsRef.current.length,
                        });
                    }
                }
            });
        });
        scene.add(dungeonGroup);


        // --- Remove Pointer Lock Controls ---
        // No Pointer Lock setup needed

        // Mount renderer
        currentMount.appendChild(renderer.domElement);

        // Handle window resize (unchanged)
        const handleResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        // --- Keyboard controls - Updated ---
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            keysPressedRef.current[key] = true;
            switch (key) {
                case 'w': moveForward.current = true; break;
                case 's': moveBackward.current = true; break;
                case 'a': moveLeftStrafe.current = true; break; // Strafe left
                case 'd': moveRightStrafe.current = true; break; // Strafe right
                case 'arrowleft': rotateLeft.current = true; break;
                case 'arrowright': rotateRight.current = true; break;
                case 'enter':
                     if (isPopupOpen) {
                         setIsPopupOpen(false);
                     } else if (nearbyObject) { // Interact if near an object
                         handleInteraction();
                     }
                    break;
                case 'escape':
                    if (isPopupOpen) {
                        setIsPopupOpen(false);
                    }
                    // No pointer unlock action needed
                    break;
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

        // --- Animation Loop ---
        const animate = () => {
             if (!gameStarted || !rendererRef.current || !sceneRef.current || !cameraRef.current || !playerRef.current) {
                 if (frameId) cancelAnimationFrame(frameId);
                 return;
             }
            const frameId = requestAnimationFrame(animate);
            const delta = clock.current.getDelta();
            const elapsedTime = clock.current.getElapsedTime();

            // --- Animate Torches (unchanged) ---
            torchesRef.current.forEach(torchData => {
                const { light, flame } = torchData;
                 const intensityNoise = (Math.sin(elapsedTime * FLICKER_SPEED + light.id * 0.7) + Math.cos(elapsedTime * FLICKER_SPEED * 0.6 + light.id)) * 0.5;
                light.intensity = BASE_TORCH_LIGHT_INTENSITY + intensityNoise * FLICKER_INTENSITY_VARIATION;
                const positionNoiseY = Math.sin(elapsedTime * FLICKER_SPEED * 1.2 + flame.id * 0.5) * FLICKER_POSITION_VARIATION;
                flame.position.y = (1.0 + 0.1) + positionNoiseY;
                 const scaleNoise = 1.0 + Math.cos(elapsedTime * FLICKER_SPEED * 0.8 + flame.id * 0.9) * 0.1;
                 flame.scale.setScalar(scaleNoise);
            });

            // --- Player Rotation ---
            let rotationChange = 0;
            if (rotateLeft.current) rotationChange += ROTATION_SPEED * delta;
            if (rotateRight.current) rotationChange -= ROTATION_SPEED * delta;
            playerRotationY.current += rotationChange;
            playerRef.current.rotation.y = playerRotationY.current; // Apply rotation to the player group

            // --- Player Movement ---
            const moveDirection = new THREE.Vector3(); // Forward/Backward direction relative to player rotation
            const strafeDirection = new THREE.Vector3(); // Left/Right strafe direction relative to player rotation

            // Calculate forward/backward movement direction based on player's Y rotation
            // Forward is along negative Z axis *in the player's local space*
            moveDirection.setFromMatrixColumn(playerRef.current.matrix, 2); // Get the forward vector (local Z)
            moveDirection.negate(); // Make it point forward
            moveDirection.y = 0; // Ensure movement is planar
            moveDirection.normalize();

            // Calculate left/right strafe direction (perpendicular to forward)
            // Right is along positive X axis *in the player's local space*
            strafeDirection.setFromMatrixColumn(playerRef.current.matrix, 0); // Get the right vector (local X)
            strafeDirection.y = 0; // Ensure movement is planar
            strafeDirection.normalize();

            const combinedMove = new THREE.Vector3();
            if (moveForward.current) combinedMove.add(moveDirection);
            if (moveBackward.current) combinedMove.sub(moveDirection);
            if (moveLeftStrafe.current) combinedMove.sub(strafeDirection); // Strafe left (negative X)
            if (moveRightStrafe.current) combinedMove.add(strafeDirection); // Strafe right (positive X)


            if (combinedMove.lengthSq() > 0) { // Only move if there's input
                combinedMove.normalize(); // Ensure consistent speed diagonally
                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = combinedMove.multiplyScalar(actualMoveSpeed);

                const currentPosition = playerRef.current.position.clone();
                const nextPosition = currentPosition.clone().add(moveAmount);

                // --- Collision Detection & Response (Simplified - check full move first) ---
                 if (isPositionValid(nextPosition)) {
                    playerRef.current.position.copy(nextPosition);
                 } else {
                     // Try moving only on X axis relative to world (using the calculated X component of moveAmount)
                     const moveX = new THREE.Vector3(moveAmount.x, 0, 0);
                     const nextPositionX = currentPosition.clone().add(moveX);

                     // Try moving only on Z axis relative to world (using the calculated Z component of moveAmount)
                     const moveZ = new THREE.Vector3(0, 0, moveAmount.z);
                     const nextPositionZ = currentPosition.clone().add(moveZ);

                     let moved = false;
                     // Check X movement possibility (slide along Z wall)
                     if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         playerRef.current.position.x = nextPositionX.x;
                         moved = true;
                     }

                     // Check Z movement possibility (slide along X wall)
                     if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZ)) {
                         playerRef.current.position.z = nextPositionZ.z;
                         moved = true;
                     }
                     // If sliding didn't work on either axis, don't move at all for this frame.
                 }
            }


            // --- Check for nearby interactable objects ---
            let closestObject: InteractableObject | null = null;
            let minDistanceSq = INTERACTION_DISTANCE * INTERACTION_DISTANCE;
            const playerPos = playerRef.current.position;

            interactableObjectsRef.current.forEach(obj => {
                const distanceSq = playerPos.distanceToSquared(obj.mesh.position);
                if (distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    closestObject = obj;
                }
            });

            // Update state only if the closest object changes OR if popup is open (to ensure hint disappears when moving away)
            if (closestObject?.id !== nearbyObject?.id || (nearbyObject && !closestObject)) {
                 setNearbyObject(closestObject);
            }


            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        let frameId = requestAnimationFrame(animate);

        // Cleanup
        return () => {
             if (frameId) cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            // Remove pointer lock listeners
            // currentMount.removeEventListener('click', lockPointer); // Removed
            // controlsRef.current?.removeEventListener('lock', onPointerLockChange); // Removed
            // controlsRef.current?.removeEventListener('unlock', onPointerLockChange); // Removed
            // document.removeEventListener('pointerlockerror', onPointerLockError, false); // Removed
            // controlsRef.current?.dispose(); // Removed

            if (currentMount && rendererRef.current) {
                if (currentMount.contains(rendererRef.current.domElement)) {
                     try {
                         currentMount.removeChild(rendererRef.current.domElement);
                     } catch (e) { console.warn("Error removing renderer DOM element:", e); }
                }
            }
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
                 torchesRef.current = [];
                 interactableObjectsRef.current = [];
                 dungeonGroupRef.current.clear();
            }
             rendererRef.current?.dispose();
             if (cameraRef.current && playerRef.current?.children.includes(cameraRef.current)) {
                  playerRef.current.remove(cameraRef.current);
             }
             if (playerRef.current?.children.find(c => c instanceof THREE.PointLight)) {
                 const light = playerRef.current.children.find(c => c instanceof THREE.PointLight);
                 if (light) playerRef.current.remove(light);
             }

             setNearbyObject(null);
             setIsPopupOpen(false);
             clock.current.stop();

             sceneRef.current = undefined;
             rendererRef.current = undefined;
             // controlsRef.current = undefined; // Removed
             cameraRef.current = undefined;
             playerRef.current = new THREE.Group();
             dungeonGroupRef.current = new THREE.Group();
        };
    }, [gameStarted, dungeonData, handleInteraction, isPositionValid]);


    // No effect needed for popup/pointer lock interaction anymore

    if (!gameStarted) {
        return <IntroScreen onStartGame={startGame} />;
    }

    // Get player position for Minimap
    const playerGridX = playerRef.current ? Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5) : 0;
    const playerGridZ = playerRef.current ? Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5) : 0;


    return (
        <div ref={mountRef} className="w-full h-full relative bg-black"> {/* No cursor change */}
             <GameHUD />
             {/* Minimap Component */}
             <Minimap
                 dungeon={dungeonData}
                 playerX={playerGridX}
                 playerZ={playerGridZ}
                 viewRadius={MINIMAP_VIEW_RADIUS}
                 tileSize={TILE_SIZE}
                 interactableObjects={interactableObjectsRef.current}
             />

             {/* Hint: Press Enter to interact (shown when near object, popup closed) */}
            {nearbyObject && !isPopupOpen && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary pointer-events-none z-10">
                    Press <span className="font-bold text-primary">[ Enter ]</span> to interact
                </div>
            )}

            {/* Removed Crosshair and Click to lock hint */}

             {/* Scroll Popup Dialog (unchanged logic, but no re-locking pointer) */}
             <Dialog open={isPopupOpen} onOpenChange={(open) => {
                 setIsPopupOpen(open);
                 // No attempt to re-lock pointer
             }}>
                <DialogContent className="sm:max-w-[475px] bg-background text-foreground border-primary rounded-lg shadow-xl z-20"> {/* Ensure dialog is above minimap */}
                    <DialogHeader className="bg-primary p-4 rounded-t-lg">
                        <DialogTitle className="text-primary-foreground text-lg">Object Details</DialogTitle>
                         <DialogDescription className="text-primary-foreground/80 text-xs pt-1">
                           Press Esc or click Close to return.
                         </DialogDescription>
                    </DialogHeader>
                     <div className="p-4">
                         <ScrollArea className="h-[250px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground">
                             <p className="whitespace-pre-wrap">{popupContent}</p>
                         </ScrollArea>
                     </div>
                    <div className="flex justify-end px-4 pb-4">
                        <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Game;
