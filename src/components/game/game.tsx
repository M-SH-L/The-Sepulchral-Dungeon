
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateDungeon, DungeonTile } from './dungeon-generator';
import { useToast } from '@/hooks/use-toast';

interface InteractableObject {
    mesh: THREE.Mesh;
    info: string;
    id: number;
}

// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const INTERACTION_DISTANCE = 1.5;
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9;
const MOVE_SPEED = 3.5;
const DUNGEON_SIZE_WIDTH = 30; // Increased size
const DUNGEON_SIZE_HEIGHT = 30; // Increased size
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0;
const TORCH_PROBABILITY = 0.04; // Chance to place a torch on a floor tile near a wall
const TORCH_LIGHT_INTENSITY = 2.0; // Increased intensity
const TORCH_LIGHT_DISTANCE = 5.0; // Increased distance
const TORCH_LIGHT_COLOR = 0xffa54a; // Warm orange light
const TORCH_HEIGHT_OFFSET = 1.2; // How high the torch flame is from the floor

// Function to create a torch model and light
const createTorch = (position: THREE.Vector3): THREE.Group => {
    const torchGroup = new THREE.Group();

    // Stick
    const stickGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 }); // Darker wood
    const stickMesh = new THREE.Mesh(stickGeometry, stickMaterial);
    stickMesh.position.y = 0.5; // Position stick slightly above ground
    torchGroup.add(stickMesh);

    // Flame (simple sphere for low poly)
    const flameGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_LIGHT_COLOR, transparent: true, opacity: 0.8 }); // Use BasicMaterial for unlit flame
    const flameMesh = new THREE.Mesh(flameGeometry, flameMaterial);
    flameMesh.position.y = 1.0 + 0.1; // Position flame atop the stick
    torchGroup.add(flameMesh);

    // Point Light
    const pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
    pointLight.position.y = TORCH_HEIGHT_OFFSET; // Position light source near the flame
    pointLight.castShadow = true; // Torches cast shadows
    pointLight.shadow.mapSize.width = 256; // Lower resolution for performance
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.bias = -0.01; // Adjust shadow bias if needed
    torchGroup.add(pointLight);


    torchGroup.position.copy(position);
    return torchGroup;
};

// HUD Component
const GameHUD: React.FC = () => {
    return (
        <div className="absolute top-4 left-4 p-4 bg-background/70 text-foreground rounded-md shadow-lg text-sm border border-primary pointer-events-none">
            <h3 className="font-bold mb-2 text-base">Controls</h3>
            <ul className="list-none space-y-1">
                <li><span className="font-semibold">W, A, S, D:</span> Move</li>
                <li><span className="font-semibold">Mouse:</span> Look</li>
                <li><span className="font-semibold">Click:</span> Lock Mouse</li>
                <li><span className="font-semibold">Enter:</span> Interact</li>
                <li><span className="font-semibold">Esc:</span> Unlock Mouse</li>
            </ul>
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
                        Explore the procedurally generated dungeon. Use your mouse to look and W/A/S/D keys to move.
                        Find mysterious objects and press Enter to inspect them. Click the screen to begin.
                    </p>
                    <Button onClick={onStartGame} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6">
                        Begin Exploration (or press Enter)
                    </Button>
                     <p className="text-xs text-muted-foreground pt-2">
                        Note: Pointer lock might not work in restricted environments (like some embedded previews). Try opening in a new tab if you have issues.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};


const Game: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<THREE.Group>(new THREE.Group());
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const controlsRef = useRef<PointerLockControls>();
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const dungeonGroupRef = useRef<THREE.Group>(new THREE.Group());
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const torchLightsRef = useRef<THREE.PointLight[]>([]); // Keep track of torch lights
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState('');
    const [nearbyObject, setNearbyObject] = useState<InteractableObject | null>(null);
    const [isPointerLocked, setIsPointerLocked] = useState(false);
    const [gameStarted, setGameStarted] = useState(false); // State for intro screen
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());
    const { toast } = useToast();

    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 10, 4, 8), []); // More rooms

    // Interaction Logic - Now triggered by Enter key press
    const handleInteraction = useCallback(() => {
        if (nearbyObject) {
            setPopupContent(nearbyObject.info);
            setIsPopupOpen(true);
            controlsRef.current?.unlock(); // Unlock pointer when dialog opens
        }
    }, [nearbyObject]);

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

            if (
                gridX < 0 || gridX >= DUNGEON_SIZE_WIDTH ||
                gridZ < 0 || gridZ >= DUNGEON_SIZE_HEIGHT
            ) {
                return false;
            }

            const tile = dungeonData[gridZ]?.[gridX];
            if (tile === undefined || tile === DungeonTile.Wall) {
                return false;
            }
        }
        return true;
    }, [dungeonData]);

     // Function to handle starting the game and locking pointer
    const startGameAndLockPointer = useCallback(() => {
        setGameStarted(true);
         // Delay pointer lock slightly to ensure the canvas is active
        setTimeout(() => {
             if (controlsRef.current && !controlsRef.current.isLocked) {
                 try {
                     if ('pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document) {
                          controlsRef.current.lock();
                     } else {
                         console.warn("Pointer Lock API not supported by this browser.");
                         toast({
                             title: "Pointer Lock Not Supported",
                             description: "Your browser does not seem to support the Pointer Lock API required for mouse look.",
                             variant: "destructive",
                         });
                     }
                 } catch (error) {
                     console.warn("Attempted to lock pointer, but failed:", error);
                     // Toast notification handled by the onPointerLockError handler
                 }
             }
        }, 100); // 100ms delay
    }, [toast]);


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return; // Only setup if game has started

        const currentMount = mountRef.current;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0x3a2d1d); // Darker sepia/brown background
        scene.fog = new THREE.Fog(0x3a2d1d, 3, 12); // Adjust fog

        // --- Camera Setup ---
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        cameraRef.current = camera;

        // --- Renderer Setup ---
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Improves lighting feel
        renderer.toneMappingExposure = 0.8; // Adjust exposure

        // --- Lighting Setup ---
        const ambientLight = new THREE.AmbientLight(0x403020, 0.2); // Very dim ambient light
        scene.add(ambientLight);

        // Reduced directional light (moonlight/distant light)
        const directionalLight = new THREE.DirectionalLight(0xffead0, 0.1); // Much dimmer
        directionalLight.position.set(5, 10, 7); // Adjust position
        // directionalLight.castShadow = true; // Maybe disable shadows for performance boost
        // directionalLight.shadow.mapSize.width = 512;
        // directionalLight.shadow.mapSize.height = 512;
        scene.add(directionalLight);
        scene.add(directionalLight.target);

        // --- Player Setup ---
        const player = playerRef.current;
        player.position.y = 0;
        camera.position.y = CAMERA_EYE_LEVEL;
        player.add(camera);
        scene.add(player);

        // Find starting position
        let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
        let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
        let foundStart = false;
         outerLoop: for (let z = 1; z < dungeonData.length - 1; z++) {
            for (let x = 1; x < dungeonData[z].length - 1; x++) {
                if (dungeonData[z][x] !== DungeonTile.Wall) {
                    // Check neighbors to prefer more open areas
                    let openNeighbors = 0;
                    if (dungeonData[z + 1]?.[x] !== DungeonTile.Wall) openNeighbors++;
                    if (dungeonData[z - 1]?.[x] !== DungeonTile.Wall) openNeighbors++;
                    if (dungeonData[z]?.[x + 1] !== DungeonTile.Wall) openNeighbors++;
                    if (dungeonData[z]?.[x - 1] !== DungeonTile.Wall) openNeighbors++;

                    if (openNeighbors >= 2) { // Prefer spots with at least 2 open neighbors
                         startX = x;
                         startZ = z;
                         foundStart = true;
                         break outerLoop;
                    } else if (!foundStart) { // Fallback to the first non-wall found
                        startX = x;
                        startZ = z;
                        foundStart = true; // Keep searching for a better spot
                    }
                }
            }
        }
         if (!foundStart) { // Extremely unlikely fallback
             console.warn("No suitable starting tile found, using absolute center.");
             startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
             startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
         }
        player.position.set(startX * TILE_SIZE, 0, startZ * TILE_SIZE);


        // --- Dungeon Rendering ---
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, side: THREE.DoubleSide, roughness: 1.0 }); // Darker ceiling

        const dungeonGroup = dungeonGroupRef.current;
        torchLightsRef.current = []; // Clear previous lights
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
                    // Floor
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileCenterX, 0, tileCenterZ);
                    floor.rotation.x = -Math.PI / 2;
                    floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    // Ceiling
                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileCenterX, WALL_HEIGHT, tileCenterZ);
                    ceiling.rotation.x = Math.PI / 2;
                    ceiling.receiveShadow = true;
                    dungeonGroup.add(ceiling);

                    // Add Torches
                     let isNearWall = false;
                     if (dungeonData[z + 1]?.[x] === DungeonTile.Wall ||
                         dungeonData[z - 1]?.[x] === DungeonTile.Wall ||
                         dungeonData[z]?.[x + 1] === DungeonTile.Wall ||
                         dungeonData[z]?.[x - 1] === DungeonTile.Wall) {
                         isNearWall = true;
                     }

                     if (isNearWall && tile !== DungeonTile.Corridor && Math.random() < TORCH_PROBABILITY) { // Place near walls, less in corridors
                        const torchPosition = new THREE.Vector3(tileCenterX, 0, tileCenterZ); // Place at floor level
                         const torch = createTorch(torchPosition);
                         dungeonGroup.add(torch);
                         const pointLight = torch.children.find(child => child instanceof THREE.PointLight) as THREE.PointLight;
                         if (pointLight) {
                             torchLightsRef.current.push(pointLight);
                         }
                    }


                    // Add placeholder objects randomly on floor tiles (reduced probability)
                    if (tile === DungeonTile.Floor && Math.random() < 0.05) { // Lower chance
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0); // Low poly
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.6, metalness: 0.2 });
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(tileCenterX, 0.3, tileCenterZ);
                        placeholderObject.castShadow = true;
                        placeholderObject.receiveShadow = true;
                        dungeonGroup.add(placeholderObject);
                        interactableObjectsRef.current.push({
                            mesh: placeholderObject,
                            info: `You found a mysterious object at grid cell (${x}, ${z}). It seems ancient and emanates a faint warmth. Perhaps it holds secrets of this dungeon... [Add more scrollable text here to test the functionality. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.]`,
                            id: interactableObjectsRef.current.length,
                        });
                    }
                }
            });
        });
        scene.add(dungeonGroup);

        // --- Pointer Lock Controls ---
        const controls = new PointerLockControls(camera, renderer.domElement);
        controlsRef.current = controls;

        const onPointerLockChange = () => {
            setIsPointerLocked(controls.isLocked);
        };
        const onPointerLockError = (event: Event) => {
            console.warn('PointerLockControls: Error locking pointer.', event);
             setIsPointerLocked(false);
             toast({
                 title: "Pointer Lock Unavailable",
                 description: "Cannot lock mouse pointer. This may be due to browser settings or running in a restricted environment (like some preview iframes). Try opening in a new tab.",
                 variant: "destructive",
             });
        };

        controls.addEventListener('lock', onPointerLockChange);
        controls.addEventListener('unlock', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError, false);

        // Click to lock pointer (only if game started)
        const lockPointer = () => {
             if (gameStarted && !isPopupOpen && controlsRef.current && !controlsRef.current.isLocked) {
                 try {
                      if ('pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document) {
                          controlsRef.current.lock();
                      } else {
                           console.warn("Pointer Lock API not supported by this browser.");
                           toast({
                               title: "Pointer Lock Not Supported",
                               description: "Your browser does not seem to support the Pointer Lock API required for mouse look.",
                               variant: "destructive",
                           });
                      }
                  } catch (error) {
                      console.warn("Attempted to lock pointer, but failed:", error);
                  }
             }
         };
        currentMount.addEventListener('click', lockPointer);


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

        // Keyboard controls
        const handleKeyDown = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = true;
            switch (event.key.toLowerCase()) {
                case 'w': moveForward.current = true; break;
                case 's': moveBackward.current = true; break;
                case 'a': moveLeft.current = true; break;
                case 'd': moveRight.current = true; break;
                case 'enter':
                     // Trigger interaction only if pointer is locked and near an object
                    if (isPointerLocked && nearbyObject) {
                        handleInteraction();
                    }
                    break;
                case 'escape':
                    if (isPointerLocked) {
                        controls.unlock();
                    }
                    break;
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = false;
             switch (event.key.toLowerCase()) {
                case 'w': moveForward.current = false; break;
                case 's': moveBackward.current = false; break;
                case 'a': moveLeft.current = false; break;
                case 'd': moveRight.current = false; break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // --- Animation Loop ---
        const clock = new THREE.Clock();

        const animate = () => {
            if (!gameStarted) return; // Stop animation if game hasn't started
            requestAnimationFrame(animate);

            const delta = clock.getDelta();

            if (controlsRef.current?.isLocked === true) {
                const player = playerRef.current;
                const camera = cameraRef.current;
                if (!camera) return;

                direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
                direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
                direction.current.normalize();

                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0;
                cameraDirection.normalize();

                const cameraRight = new THREE.Vector3();
                cameraRight.crossVectors(camera.up, cameraDirection).normalize();

                const moveVector = new THREE.Vector3();
                moveVector.addScaledVector(cameraDirection, direction.current.z);
                moveVector.addScaledVector(cameraRight, direction.current.x);
                moveVector.normalize();

                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = moveVector.multiplyScalar(actualMoveSpeed);

                // Collision Detection
                const currentPosition = player.position.clone();
                const nextPosition = currentPosition.clone().add(moveAmount);

                if (isPositionValid(nextPosition)) {
                    player.position.copy(nextPosition);
                } else {
                    // Slide collision
                    const moveX = moveAmount.clone();
                    moveX.z = 0;
                    const nextPositionX = currentPosition.clone().add(moveX);

                    const moveZ = moveAmount.clone();
                    moveZ.x = 0;
                    const nextPositionZ = currentPosition.clone().add(moveZ);

                    let moved = false;
                    if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                        player.position.copy(nextPositionX);
                        moved = true;
                    }
                    const positionAfterXCheck = player.position.clone();
                    const nextPositionZFromX = positionAfterXCheck.clone().add(moveZ);

                    if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZFromX)) {
                        player.position.copy(nextPositionZFromX);
                        moved = true;
                     } else if (!moved && moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZ)) {
                         player.position.copy(nextPositionZ);
                         moved = true;
                     }
                }

                // Update light target (optional)
                // directionalLight.target.position.copy(player.position);
                // directionalLight.target.updateMatrixWorld();

                // Check for nearby interactable objects
                let closestObject: InteractableObject | null = null;
                let minDistanceSq = INTERACTION_DISTANCE * INTERACTION_DISTANCE;

                interactableObjectsRef.current.forEach(obj => {
                    const distanceSq = player.position.distanceToSquared(obj.mesh.position);
                    if (distanceSq < minDistanceSq) {
                        minDistanceSq = distanceSq;
                        closestObject = obj;
                    }
                });

                if (closestObject !== nearbyObject) {
                    setNearbyObject(closestObject);
                }
            } else {
                 setNearbyObject(null);
            }

            rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        };

        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            currentMount.removeEventListener('click', lockPointer);
            controlsRef.current?.removeEventListener('lock', onPointerLockChange);
            controlsRef.current?.removeEventListener('unlock', onPointerLockChange);
            document.removeEventListener('pointerlockerror', onPointerLockError, false);
            controlsRef.current?.dispose();


            if (currentMount && rendererRef.current) {
                if (currentMount.contains(rendererRef.current.domElement)) {
                    currentMount.removeChild(rendererRef.current.domElement);
                }
            }
            if (sceneRef.current) {
                // Dispose geometries and materials
                sceneRef.current.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        object.geometry?.dispose();
                         if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else if (object.material) {
                            object.material.dispose();
                        }
                    } else if (object instanceof THREE.Light) {
                         object.dispose(); // Dispose lights
                    }
                });
                 // Dispose torch lights explicitly if needed (though PointLight.dispose should handle it)
                 torchLightsRef.current.forEach(light => light.dispose());
                 torchLightsRef.current = [];
            }
            rendererRef.current?.dispose();
            if (cameraRef.current && playerRef.current.children.includes(cameraRef.current)) {
                 playerRef.current.remove(cameraRef.current);
            }
             setIsPointerLocked(false);
             clock.stop();
             sceneRef.current = undefined; // Help GC
             rendererRef.current = undefined;
             controlsRef.current = undefined;
             playerRef.current = new THREE.Group(); // Reset player ref
             dungeonGroupRef.current = new THREE.Group();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameStarted, handleInteraction, isPositionValid, dungeonData, toast]); // Re-run setup when gameStarted changes

    useEffect(() => {
        // Handle pointer lock attempt after closing the dialog
        if (!isPopupOpen && gameStarted && !isPointerLocked) {
            // The click listener on mountRef should handle re-locking
        }
    }, [isPopupOpen, gameStarted, isPointerLocked]);

    if (!gameStarted) {
        return <IntroScreen onStartGame={startGameAndLockPointer} />;
    }

    return (
        <div ref={mountRef} className="w-full h-full relative cursor-crosshair">
             <GameHUD /> {/* Always display HUD */}
             {!isPointerLocked && !isPopupOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl pointer-events-none">
                    Click screen to lock mouse and look around
                </div>
            )}
            {isPointerLocked && nearbyObject && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary pointer-events-none">
                    Press Enter to interact with the object
                </div>
            )}
            {isPointerLocked && (
                 <div className="absolute top-1/2 left-1/2 w-1 h-1 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-foreground/80 rounded-full"></div>
            )}

             <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-foreground border-primary rounded-lg shadow-xl">
                    <DialogHeader className="bg-primary p-4 rounded-t-lg">
                        <DialogTitle className="text-primary-foreground text-lg">Object Information</DialogTitle>
                    </DialogHeader>
                     <DialogDescription asChild>
                            <ScrollArea className="h-[250px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground mt-2 mb-4">
                                <p>{popupContent}</p>
                            </ScrollArea>
                    </DialogDescription>
                    <div className="flex justify-end px-4 pb-4">
                        <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Game;
