
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
const ROOM_TORCH_PROBABILITY = 0.04; // Torch probability in rooms
const CORRIDOR_TORCH_PROBABILITY = 0.08; // Increased torch probability in corridors
const OBJECT_PROBABILITY = 0.04; // Probability of an object appearing on a floor tile
const OBJECT_HEIGHT = PLAYER_HEIGHT * 0.7; // Place objects closer to eye level
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
    stickMesh.position.y = 0.5; // Stick base at floor level
    stickMesh.castShadow = true;
    torchGroup.add(stickMesh);
    const flameGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_LIGHT_COLOR });
    const flameMesh = new THREE.Mesh(flameGeometry, flameMaterial);
    flameMesh.position.y = 1.0 + 0.1; // Flame above the stick
    flameMesh.name = "torchFlame";
    torchGroup.add(flameMesh);
    const pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, BASE_TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
    pointLight.position.y = TORCH_HEIGHT_OFFSET; // Light source near flame
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 256;
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.bias = -0.01;
    pointLight.name = "torchLight";
    torchGroup.add(pointLight);
    torchGroup.position.copy(position); // Set group position
    return { group: torchGroup, light: pointLight, flame: flameMesh };
};

// HUD Component - Unchanged
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
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const dungeonGroupRef = useRef<THREE.Group>(new THREE.Group());
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const torchesRef = useRef<TorchData[]>([]);
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState('');
    const [nearbyObject, setNearbyObject] = useState<InteractableObject | null>(null);
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
    // Store cleanup functions to avoid re-adding listeners on potential re-renders
    const cleanupFunctions = useRef<(() => void)[]>([]);

    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 15, 5, 9), []);

    // Interaction Logic - Updated: No longer depends on useEffect dependency
    const handleInteraction = useCallback(() => {
        // Use the state directly from the ref at the time of interaction
        const currentNearbyObject = nearbyObject;
        if (currentNearbyObject) {
            setPopupContent(currentNearbyObject.info);
            setIsPopupOpen(true);
        }
    }, [nearbyObject]); // Keep nearbyObject dependency here for updating popup content

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

    // Function to handle starting the game (unchanged)
    const startGame = useCallback(() => {
        setGameStarted(true);
    }, []);

    // Check for adjacent walls (helper function)
    const isAdjacentToWall = (x: number, z: number, dungeon: DungeonTile[][]): boolean => {
         return dungeon[z + 1]?.[x] === DungeonTile.Wall ||
                dungeon[z - 1]?.[x] === DungeonTile.Wall ||
                dungeon[z]?.[x + 1] === DungeonTile.Wall ||
                dungeon[z]?.[x - 1] === DungeonTile.Wall;
    };

    // Find a suitable wall position for a torch (helper function)
    const findTorchWallPosition = (x: number, z: number, dungeon: DungeonTile[][]): THREE.Vector3 | null => {
         const tileCenterX = x * TILE_SIZE;
         const tileCenterZ = z * TILE_SIZE;
         let torchPos = new THREE.Vector3(tileCenterX, 0, tileCenterZ);
         let foundWall = false;

         if (dungeon[z]?.[x + 1] === DungeonTile.Wall) { torchPos.x += TILE_SIZE / 2 - 0.1; foundWall = true; }
         else if (dungeon[z]?.[x - 1] === DungeonTile.Wall) { torchPos.x -= TILE_SIZE / 2 - 0.1; foundWall = true; }
         else if (dungeon[z + 1]?.[x] === DungeonTile.Wall) { torchPos.z += TILE_SIZE / 2 - 0.1; foundWall = true; }
         else if (dungeon[z - 1]?.[x] === DungeonTile.Wall) { torchPos.z -= TILE_SIZE / 2 - 0.1; foundWall = true; }

         return foundWall ? torchPos : null;
    }


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return;

        // Clear previous cleanup functions if re-running
        cleanupFunctions.current.forEach(cleanup => cleanup());
        cleanupFunctions.current = [];

        const currentMount = mountRef.current;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0x4a3026); // Sepia background
        scene.fog = new THREE.Fog(0x4a3026, 3, 15); // Sepia fog

        // --- Camera Setup ---
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        cameraRef.current = camera;
        camera.position.y = CAMERA_EYE_LEVEL;
        camera.lookAt(0, CAMERA_EYE_LEVEL, -1);

        // --- Renderer Setup ---
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;

        // --- Lighting Setup ---
        const ambientLight = new THREE.AmbientLight(0x504030, 0.3); // Dim sepia ambient light
        scene.add(ambientLight);

        // --- Player Setup ---
        const player = playerRef.current;
        player.position.y = 0;
        player.add(camera);
        scene.add(player);

        // Add Player Glow Light
        const playerGlowLight = new THREE.PointLight(PLAYER_GLOW_COLOR, PLAYER_GLOW_INTENSITY, PLAYER_GLOW_DISTANCE);
        playerGlowLight.position.set(0, PLAYER_HEIGHT * 0.5, 0);
        playerGlowLight.castShadow = false;
        player.add(playerGlowLight);

        // Find starting position (unchanged logic)
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
        playerRotationY.current = 0;

        // --- Dungeon Rendering (includes torch and object placement) ---
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x6A4F3A, side: THREE.DoubleSide, roughness: 1.0 });

        const dungeonGroup = dungeonGroupRef.current;
        dungeonGroup.clear(); // Clear previous dungeon if re-running
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
                    ceiling.receiveShadow = true;
                    dungeonGroup.add(ceiling);

                    const isCorridor = tile === DungeonTile.Corridor;
                    const torchProbability = isCorridor ? CORRIDOR_TORCH_PROBABILITY : ROOM_TORCH_PROBABILITY;

                    // Place torches adjacent to walls
                     if (isAdjacentToWall(x, z, dungeonData) && Math.random() < torchProbability) {
                         const torchPos = findTorchWallPosition(x, z, dungeonData);
                         if (torchPos) {
                             const torchData = createTorch(torchPos);
                             dungeonGroup.add(torchData.group);
                             torchesRef.current.push(torchData);
                         }
                     }

                    // Place interactable objects on floor tiles (not corridors)
                    if (tile === DungeonTile.Floor && Math.random() < OBJECT_PROBABILITY) {
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0);
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.1 });
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        // Place object at eye level
                        placeholderObject.position.set(tileCenterX, OBJECT_HEIGHT, tileCenterZ);
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

        // Mount renderer
        currentMount.appendChild(renderer.domElement);

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

        // --- Keyboard controls ---
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
                case 'enter':
                     if (isPopupOpen) {
                         setIsPopupOpen(false);
                     } else {
                         // Use the *current* value of nearbyObject from state
                         const currentNearbyObj = nearbyObject; // Capture state at key press
                         if (currentNearbyObj) {
                            setPopupContent(currentNearbyObj.info);
                            setIsPopupOpen(true);
                         }
                     }
                    break;
                case 'escape':
                    if (isPopupOpen) {
                        setIsPopupOpen(false);
                    }
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
        cleanupFunctions.current.push(() => window.removeEventListener('keydown', handleKeyDown));
        cleanupFunctions.current.push(() => window.removeEventListener('keyup', handleKeyUp));

        // --- Animation Loop ---
        let frameId: number;
        const animate = () => {
             if (!gameStarted || !rendererRef.current || !sceneRef.current || !cameraRef.current || !playerRef.current) {
                 if (frameId) cancelAnimationFrame(frameId);
                 return;
             }
            frameId = requestAnimationFrame(animate);
            const delta = clock.current.getDelta();
            const elapsedTime = clock.current.getElapsedTime();

            // Animate Torches (unchanged)
            torchesRef.current.forEach(torchData => {
                const { light, flame } = torchData;
                const intensityNoise = (Math.sin(elapsedTime * FLICKER_SPEED + light.id * 0.7) + Math.cos(elapsedTime * FLICKER_SPEED * 0.6 + light.id)) * 0.5;
                light.intensity = BASE_TORCH_LIGHT_INTENSITY + intensityNoise * FLICKER_INTENSITY_VARIATION;
                const positionNoiseY = Math.sin(elapsedTime * FLICKER_SPEED * 1.2 + flame.id * 0.5) * FLICKER_POSITION_VARIATION;
                flame.position.y = (1.0 + 0.1) + positionNoiseY; // Keep flame position relative to torch stick base
                const scaleNoise = 1.0 + Math.cos(elapsedTime * FLICKER_SPEED * 0.8 + flame.id * 0.9) * 0.1;
                flame.scale.setScalar(scaleNoise);
            });

            // Player Rotation (unchanged)
            let rotationChange = 0;
            if (rotateLeft.current) rotationChange += ROTATION_SPEED * delta;
            if (rotateRight.current) rotationChange -= ROTATION_SPEED * delta;
            playerRotationY.current += rotationChange;
            playerRef.current.rotation.y = playerRotationY.current;

            // Player Movement (unchanged logic, uses refs)
            const moveDirection = new THREE.Vector3();
            const strafeDirection = new THREE.Vector3();
            moveDirection.setFromMatrixColumn(playerRef.current.matrix, 2).negate().setY(0).normalize();
            strafeDirection.setFromMatrixColumn(playerRef.current.matrix, 0).setY(0).normalize();
            const combinedMove = new THREE.Vector3();
            if (moveForward.current) combinedMove.add(moveDirection);
            if (moveBackward.current) combinedMove.sub(moveDirection);
            if (moveLeftStrafe.current) combinedMove.sub(strafeDirection);
            if (moveRightStrafe.current) combinedMove.add(strafeDirection);

            if (combinedMove.lengthSq() > 0) {
                combinedMove.normalize();
                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = combinedMove.multiplyScalar(actualMoveSpeed);
                const currentPosition = playerRef.current.position.clone();
                const nextPosition = currentPosition.clone().add(moveAmount);

                 if (isPositionValid(nextPosition)) {
                    playerRef.current.position.copy(nextPosition);
                 } else {
                     const moveX = new THREE.Vector3(moveAmount.x, 0, 0);
                     const nextPositionX = currentPosition.clone().add(moveX);
                     const moveZ = new THREE.Vector3(0, 0, moveAmount.z);
                     const nextPositionZ = currentPosition.clone().add(moveZ);

                     let moved = false;
                     if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         playerRef.current.position.x = nextPositionX.x;
                         moved = true;
                     }
                     if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZ)) {
                         playerRef.current.position.z = nextPositionZ.z;
                         moved = true;
                     }
                 }
            }

            // --- Check for nearby interactable objects ---
            // This calculation happens every frame
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

            // Update the nearbyObject state based on the calculation
            // This triggers re-render ONLY when the nearby object changes
            if (closestObject?.id !== nearbyObject?.id) {
                 setNearbyObject(closestObject);
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        frameId = requestAnimationFrame(animate);

        // Cleanup
        return () => {
             if (frameId) cancelAnimationFrame(frameId);
             // Run all registered cleanup functions
             cleanupFunctions.current.forEach(cleanup => cleanup());
             cleanupFunctions.current = [];

            if (currentMount && rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) {
                 try {
                     currentMount.removeChild(rendererRef.current.domElement);
                 } catch (e) { console.warn("Error removing renderer DOM element:", e); }
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
            }
             rendererRef.current?.dispose();
             clock.current.stop();

             // Reset refs and state for next game start
             sceneRef.current = undefined;
             rendererRef.current = undefined;
             cameraRef.current = undefined;
             playerRef.current = new THREE.Group();
             dungeonGroupRef.current = new THREE.Group();
             torchesRef.current = [];
             interactableObjectsRef.current = [];
             keysPressedRef.current = {}; // Reset keys
             moveForward.current = false;
             moveBackward.current = false;
             moveLeftStrafe.current = false;
             moveRightStrafe.current = false;
             rotateLeft.current = false;
             rotateRight.current = false;
             setNearbyObject(null); // Reset nearby object state
             setIsPopupOpen(false); // Close popup
        };
    }, [gameStarted, dungeonData, isPositionValid]); // Dependencies for setup: gameStarted and dungeonData
    // Removed nearbyObject and handleInteraction from dependencies to prevent setup re-running


    if (!gameStarted) {
        return <IntroScreen onStartGame={startGame} />;
    }

    // Get player position for Minimap
    const playerGridX = playerRef.current ? Math.floor(playerRef.current.position.x / TILE_SIZE + 0.5) : 0;
    const playerGridZ = playerRef.current ? Math.floor(playerRef.current.position.z / TILE_SIZE + 0.5) : 0;

    return (
        <div ref={mountRef} className="w-full h-full relative bg-black">
             <GameHUD />
             <Minimap
                 dungeon={dungeonData}
                 playerX={playerGridX}
                 playerZ={playerGridZ}
                 viewRadius={MINIMAP_VIEW_RADIUS}
                 tileSize={TILE_SIZE}
                 interactableObjects={interactableObjectsRef.current}
             />

             {/* Hint: Press Enter to interact */}
            {nearbyObject && !isPopupOpen && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary pointer-events-none z-10">
                    Press <span className="font-bold text-primary">[ Enter ]</span> to interact
                </div>
            )}

             {/* Scroll Popup Dialog */}
             <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent className="sm:max-w-[475px] bg-background text-foreground border-primary rounded-lg shadow-xl z-20">
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

    