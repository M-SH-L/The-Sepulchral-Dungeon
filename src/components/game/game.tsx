
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { generateDungeon, DungeonTile } from './dungeon-generator';

interface InteractableObject {
    mesh: THREE.Mesh;
    info: string;
    id: number;
}

// Constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3; // Slightly smaller radius for tighter spaces
const INTERACTION_DISTANCE = 1.5;
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Slightly below the top
const MOVE_SPEED = 3.5; // Adjusted speed
const DUNGEON_SIZE_WIDTH = 20;
const DUNGEON_SIZE_HEIGHT = 20;
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0; // Assuming each grid cell is 1x1 unit

const Game: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<THREE.Group>(new THREE.Group()); // Use Group for player pivot
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const controlsRef = useRef<PointerLockControls>();
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const dungeonGroupRef = useRef<THREE.Group>(new THREE.Group()); // Reference to dungeon meshes
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState('');
    const [nearbyObject, setNearbyObject] = useState<InteractableObject | null>(null);
    const [isPointerLocked, setIsPointerLocked] = useState(false);
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    // Generate Dungeon Data - Memoize to prevent regeneration on every render
    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 5, 3, 7), []);

    // Interaction Logic
    const handleInteraction = useCallback(() => {
        if (nearbyObject) {
            setPopupContent(nearbyObject.info);
            setIsPopupOpen(true);
            // Unlock pointer when dialog opens
            controlsRef.current?.unlock();
        }
    }, [nearbyObject]);

    // Collision Detection - Refined
    const isPositionValid = useCallback((newPosition: THREE.Vector3): boolean => {
        // Player's potential bounding box corners in XZ plane
        const corners = [
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS), // Top-right
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS), // Bottom-right
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS), // Bottom-left
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS), // Top-left
        ];

        for (const corner of corners) {
            // Convert corner world coordinates to grid coordinates
            const gridX = Math.floor(corner.x / TILE_SIZE + 0.5); // Center-based grid cell index
            const gridZ = Math.floor(corner.z / TILE_SIZE + 0.5);

            // Check Map Bounds
            if (
                gridX < 0 || gridX >= DUNGEON_SIZE_WIDTH ||
                gridZ < 0 || gridZ >= DUNGEON_SIZE_HEIGHT
            ) {
                // console.log(`Collision: Out of bounds at (${gridX}, ${gridZ}) for position (${newPosition.x.toFixed(2)}, ${newPosition.z.toFixed(2)})`);
                return false; // Out of bounds
            }

            // Check Tile Type
            const tile = dungeonData[gridZ]?.[gridX];
            if (tile === undefined || tile === DungeonTile.Wall) {
                // console.log(`Collision: Wall at (${gridX}, ${gridZ}) for position (${newPosition.x.toFixed(2)}, ${newPosition.z.toFixed(2)})`);
                return false; // Collision with wall
            }
        }

        // Optional: Add collision checks with interactable objects if needed
        // interactableObjectsRef.current.forEach(obj => { ... });

        return true; // Position is valid
    }, [dungeonData]);


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current) return;

        const currentMount = mountRef.current;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0xc2b280); // Sepia background
        scene.fog = new THREE.Fog(0xc2b280, 5, 15); // Add fog for atmosphere

        // Camera setup
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        cameraRef.current = camera;
        // Camera position is set relative to the player group later

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

        // Sepia Tone Lighting
        const ambientLight = new THREE.AmbientLight(0x8c7853, 0.6); // Slightly less intense ambient
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffead0, 0.8);
        directionalLight.position.set(15, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
         // Adjust shadow camera frustum if needed
         directionalLight.shadow.camera.left = -DUNGEON_SIZE_WIDTH / 2;
         directionalLight.shadow.camera.right = DUNGEON_SIZE_WIDTH / 2;
         directionalLight.shadow.camera.top = DUNGEON_SIZE_HEIGHT / 2;
         directionalLight.shadow.camera.bottom = -DUNGEON_SIZE_HEIGHT / 2;
        scene.add(directionalLight);
         scene.add(directionalLight.target); // Target for directional light

        // Player setup (Group with Camera inside)
        const player = playerRef.current;
        player.position.y = 0; // Player group pivot at floor level
        camera.position.y = CAMERA_EYE_LEVEL; // Set camera at eye level within the player group
        player.add(camera); // Add camera to player group
        scene.add(player); // Add player group to scene

        // Find starting position for player
        let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
        let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
        let foundStart = false;
        for (let z = 1; z < dungeonData.length - 1 && !foundStart; z++) { // Avoid edges
            for (let x = 1; x < dungeonData[z].length - 1 && !foundStart; x++) {
                if (dungeonData[z][x] === DungeonTile.Floor) {
                    // Check neighbors to ensure it's not isolated if possible
                    if (
                        (dungeonData[z + 1]?.[x] !== DungeonTile.Wall) ||
                        (dungeonData[z - 1]?.[x] !== DungeonTile.Wall) ||
                        (dungeonData[z]?.[x + 1] !== DungeonTile.Wall) ||
                        (dungeonData[z]?.[x - 1] !== DungeonTile.Wall)
                    ) {
                        startX = x;
                        startZ = z;
                        foundStart = true;
                    }
                }
            }
        }
        // If no suitable floor found (highly unlikely), use fallback center (might be wall)
         if (!foundStart) {
             console.warn("No suitable starting floor tile found, using center fallback.");
             startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
             startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
         }

        // Position player group at center of the start tile
        player.position.set(startX * TILE_SIZE, 0, startZ * TILE_SIZE);


        // Dungeon Rendering
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE); // Ceiling geometry
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xae9a86, side: THREE.DoubleSide, roughness: 1.0 }); // Slightly lighter ceiling

        const dungeonGroup = dungeonGroupRef.current;
        interactableObjectsRef.current = []; // Clear previous objects
        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                // Center position for the tile
                const tileCenterX = x * TILE_SIZE;
                const tileCenterZ = z * TILE_SIZE;

                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    // Position wall cube centered on the tile, vertically centered
                    wall.position.set(tileCenterX, WALL_HEIGHT / 2, tileCenterZ);
                    wall.receiveShadow = true;
                    wall.castShadow = true;
                    dungeonGroup.add(wall);
                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    // Floor
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileCenterX, 0, tileCenterZ); // At Y=0
                    floor.rotation.x = -Math.PI / 2;
                    floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    // Ceiling
                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileCenterX, WALL_HEIGHT, tileCenterZ); // Position ceiling at wall height
                    ceiling.rotation.x = Math.PI / 2; // Rotate to face down
                    ceiling.receiveShadow = true;
                    dungeonGroup.add(ceiling);


                    // Add placeholder objects randomly on floor tiles
                    if (tile === DungeonTile.Floor && Math.random() < 0.08) { // Place only in rooms, lower chance
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0);
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x4A3026, roughness: 0.5 });
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(tileCenterX, 0.3, tileCenterZ);
                        placeholderObject.castShadow = true;
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

        // Pointer Lock Controls
        const controls = new PointerLockControls(camera, renderer.domElement);
        controlsRef.current = controls;
        // No need to add controls.getObject() to scene, camera is already in player group

        const onPointerLockChange = () => {
            setIsPointerLocked(controls.isLocked);
        };
        const onPointerLockError = (event: Event) => {
            console.error('PointerLockControls: Error locking pointer.', event);
            setIsPointerLocked(false);
        };

        controls.addEventListener('lock', onPointerLockChange);
        controls.addEventListener('unlock', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError);

        // Click to lock pointer
        const lockPointer = () => {
            if (!isPopupOpen) { // Only lock if popup is not open
                try {
                    controls.lock();
                } catch (error) {
                    console.error("Failed to lock pointer:", error);
                    // Optionally inform the user that pointer lock failed
                    alert("Could not lock pointer. This might be due to browser settings or sandboxing restrictions.");
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
                     if (isPointerLocked && nearbyObject) { // Only interact if pointer is locked
                        handleInteraction();
                    }
                    break;
                case 'escape': // Allow Esc to unlock pointer
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

        // Animation loop
        let prevTime = performance.now();
        const clock = new THREE.Clock(); // Use Clock for delta

        const animate = () => {
            requestAnimationFrame(animate);

            const delta = clock.getDelta(); // Delta time in seconds

            if (controlsRef.current?.isLocked === true) {
                const player = playerRef.current;
                const camera = cameraRef.current;
                if (!camera) return; // Should not happen, but safety check

                 // Reset velocity (optional, depending on desired movement style)
                 // velocity.current.x -= velocity.current.x * 10.0 * delta;
                 // velocity.current.z -= velocity.current.z * 10.0 * delta;

                // Calculate direction based on input
                direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
                direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
                direction.current.normalize(); // Ensure consistent speed in all directions

                 // Get camera's forward and right vectors (in XZ plane)
                 const cameraDirection = new THREE.Vector3();
                 camera.getWorldDirection(cameraDirection);
                 cameraDirection.y = 0; // Project onto XZ plane
                 cameraDirection.normalize();

                 const cameraRight = new THREE.Vector3();
                 cameraRight.crossVectors(camera.up, cameraDirection).normalize();

                 // Calculate movement vector based on camera orientation and input
                 const moveVector = new THREE.Vector3();
                 moveVector.addScaledVector(cameraDirection, direction.current.z); // Forward/backward
                 moveVector.addScaledVector(cameraRight, direction.current.x);      // Left/right
                 moveVector.normalize(); // Normalize the combined movement vector

                 const actualMoveSpeed = MOVE_SPEED * delta;
                 const moveAmount = moveVector.multiplyScalar(actualMoveSpeed);


                 // --- Collision Detection before moving ---
                 const currentPosition = player.position.clone();
                 const nextPosition = currentPosition.clone().add(moveAmount);

                 // Check collision for the full movement
                 if (isPositionValid(nextPosition)) {
                     player.position.copy(nextPosition); // Apply full movement if valid
                 } else {
                     // If full movement invalid, try moving along X and Z separately (slide collision)
                     const moveX = moveAmount.clone();
                     moveX.z = 0; // Only X component
                     const nextPositionX = currentPosition.clone().add(moveX);

                     const moveZ = moveAmount.clone();
                     moveZ.x = 0; // Only Z component
                     const nextPositionZ = currentPosition.clone().add(moveZ);

                     let moved = false;
                     if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         player.position.copy(nextPositionX);
                         moved = true;
                     }
                     // Get the possibly updated position before checking Z
                     const positionAfterXCheck = player.position.clone();
                     const nextPositionZFromX = positionAfterXCheck.clone().add(moveZ);

                     if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZFromX)) {
                          // If X was already valid, add Z movement to it.
                          // Otherwise, try Z from the original position.
                         player.position.copy(nextPositionZFromX);
                         moved = true;
                      } else if (!moved && moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZ)) {
                         // Fallback: try moving only Z from original if X wasn't valid
                          player.position.copy(nextPositionZ);
                          moved = true;
                      }

                     // If neither X nor Z movement (or combined) is valid, the player doesn't move.
                      if (!moved) {
                         // console.log("Blocked");
                      }
                 }


                 // Update directional light target to follow player
                 directionalLight.target.position.copy(player.position);
                 directionalLight.target.updateMatrixWorld(); // Important after changing target position


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
                    setNearbyObject(closestObject); // Update state if the nearest object changes
                }
            } else {
                 // Reset velocity if pointer isn't locked (optional)
                 // velocity.current.set(0, 0, 0);
                 setNearbyObject(null); // Clear nearby object when not locked
            }


            rendererRef.current?.render(sceneRef.current, cameraRef.current);
        };

        animate(); // Start animation loop

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
             currentMount.removeEventListener('click', lockPointer);
            controlsRef.current?.removeEventListener('lock', onPointerLockChange);
            controlsRef.current?.removeEventListener('unlock', onPointerLockChange);
            document.removeEventListener('pointerlockerror', onPointerLockError);
            controlsRef.current?.dispose(); // Dispose controls


            if (currentMount && rendererRef.current) {
                 // Check if renderer element is still a child before removing
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
                    }
                });
            }
            rendererRef.current?.dispose();
            if (cameraRef.current && playerRef.current.children.includes(cameraRef.current)) {
                 playerRef.current.remove(cameraRef.current); // Remove camera before cleanup
            }
             setIsPointerLocked(false); // Ensure state is reset
             clock.stop(); // Stop the clock
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleInteraction, isPositionValid, dungeonData]); // Add dependencies that don't change frequently

     // Effect to handle popup closing and pointer locking
    useEffect(() => {
        if (!isPopupOpen && !isPointerLocked) {
            // Attempt to re-lock pointer after closing the dialog by clicking the screen again
        }
    }, [isPopupOpen, isPointerLocked]);

    return (
        <div ref={mountRef} className="w-full h-full relative cursor-crosshair"> {/* Changed cursor */}
             {!isPointerLocked && !isPopupOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl pointer-events-none">
                    Click to Look Around
                </div>
            )}
            {isPointerLocked && nearbyObject && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary pointer-events-none">
                    Press Enter to interact
                </div>
            )}
             {/* Crosshair */}
            {isPointerLocked && (
                 <div className="absolute top-1/2 left-1/2 w-1 h-1 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-foreground/80 rounded-full"></div>
            )}

             <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-foreground border-primary rounded-lg shadow-xl">
                    <DialogHeader className="bg-primary p-4 rounded-t-lg">
                        <DialogTitle className="text-primary-foreground text-lg">Object Information</DialogTitle>
                    </DialogHeader>
                     <DialogDescription asChild> {/* Use asChild to prevent nesting p tags */}
                            <ScrollArea className="h-[250px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground mt-2 mb-4">
                                <p>{popupContent}</p> {/* Wrap content in a paragraph */}
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

