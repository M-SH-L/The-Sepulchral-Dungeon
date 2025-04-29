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
const PLAYER_RADIUS = 0.4; // Half the width/depth
const INTERACTION_DISTANCE = 1.5;
const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Slightly below the top
const MOVE_SPEED = 3.5; // Adjusted speed
const DUNGEON_SIZE_WIDTH = 20;
const DUNGEON_SIZE_HEIGHT = 20;
const WALL_HEIGHT = 2.5;

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

    // Collision Detection
    const isPositionValid = useCallback((newPosition: THREE.Vector3): boolean => {
        const playerX = Math.floor(newPosition.x + 0.5); // Get grid cell
        const playerZ = Math.floor(newPosition.z + 0.5);

        // 1. Check Map Bounds
        if (
            playerX < 0 || playerX >= DUNGEON_SIZE_WIDTH ||
            playerZ < 0 || playerZ >= DUNGEON_SIZE_HEIGHT
        ) {
            return false; // Out of bounds
        }

        // 2. Check Tile Type
        const currentTile = dungeonData[playerZ]?.[playerX];
        if (currentTile === undefined || currentTile === DungeonTile.Wall) {
             // Allow slight overlap with wall edges but prevent deep penetration
             // Check surrounding tiles for potential collisions near walls more precisely
             for (let dz = -1; dz <= 1; dz++) {
                 for (let dx = -1; dx <= 1; dx++) {
                     const checkX = playerX + dx;
                     const checkZ = playerZ + dz;

                     if (
                         checkX >= 0 && checkX < DUNGEON_SIZE_WIDTH &&
                         checkZ >= 0 && checkZ < DUNGEON_SIZE_HEIGHT &&
                         dungeonData[checkZ][checkX] === DungeonTile.Wall
                     ) {
                         const wallMin = new THREE.Vector3(checkX - 0.5, 0, checkZ - 0.5);
                         const wallMax = new THREE.Vector3(checkX + 0.5, WALL_HEIGHT, checkZ + 0.5);
                         const wallBox = new THREE.Box3(wallMin, wallMax);

                         const playerSphere = new THREE.Sphere(newPosition, PLAYER_RADIUS);
                         playerSphere.center.y = CAMERA_EYE_LEVEL; // Check collision at player height

                         if (wallBox.intersectsSphere(playerSphere)) {
                             return false; // Collision detected
                         }
                     }
                 }
             }
             // If initial check failed but detailed check passed (maybe just grazing),
             // it might still be a wall tile. Re-check primary tile.
             if (currentTile === DungeonTile.Wall) return false;

        }

        // 3. (Optional) Check against specific object bounding boxes if needed

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
        camera.position.y = CAMERA_EYE_LEVEL; // Set camera at eye level within the player group

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
         directionalLight.shadow.camera.left = -15;
         directionalLight.shadow.camera.right = 15;
         directionalLight.shadow.camera.top = 15;
         directionalLight.shadow.camera.bottom = -15;
        scene.add(directionalLight);
         scene.add(directionalLight.target); // Target for directional light

        // Player setup (Group with Camera inside)
        const player = playerRef.current;
        player.add(camera); // Add camera to player group
        scene.add(player); // Add player group to scene

        // Find starting position for player
        let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
        let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
        for (let y = 0; y < dungeonData.length; y++) {
            const floorIndex = dungeonData[y].indexOf(DungeonTile.Floor);
            if (floorIndex !== -1) {
                startX = floorIndex;
                startZ = y;
                break;
            }
        }
        player.position.set(startX, 0, startZ); // Place player group at start


        // Dungeon Rendering
        const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
        const floorGeometry = new THREE.PlaneGeometry(1, 1);
        const ceilingGeometry = new THREE.PlaneGeometry(1, 1); // Ceiling geometry
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xae9a86, side: THREE.DoubleSide, roughness: 1.0 }); // Slightly lighter ceiling

        const dungeonGroup = dungeonGroupRef.current;
        interactableObjectsRef.current = []; // Clear previous objects
        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                const tileX = x;
                const tileZ = z;

                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(tileX, WALL_HEIGHT / 2, tileZ); // Center wall cube vertically
                    wall.receiveShadow = true;
                    wall.castShadow = true;
                    dungeonGroup.add(wall);
                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    // Floor
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(tileX, 0, tileZ);
                    floor.rotation.x = -Math.PI / 2;
                    floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    // Ceiling
                    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
                    ceiling.position.set(tileX, WALL_HEIGHT, tileZ); // Position ceiling at wall height
                    ceiling.rotation.x = Math.PI / 2; // Rotate to face down
                    // Ceilings typically don't cast shadows, but can receive them
                    ceiling.receiveShadow = true;
                    dungeonGroup.add(ceiling);


                    // Add placeholder objects randomly on floor tiles
                    if (tile === DungeonTile.Floor && Math.random() < 0.08) { // Place only in rooms, lower chance
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0);
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x4A3026, roughness: 0.5 });
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(tileX, 0.3, tileZ);
                        placeholderObject.castShadow = true;
                        dungeonGroup.add(placeholderObject);
                        interactableObjectsRef.current.push({
                            mesh: placeholderObject,
                            info: `You found a mysterious object at (${tileX}, ${tileZ}). It seems ancient and emanates a faint warmth. Perhaps it holds secrets of this dungeon... [Add more scrollable text here to test the functionality. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.]`,
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
        scene.add(controls.getObject()); // Add the controls object (which contains the camera)

        const onPointerLockChange = () => {
            setIsPointerLocked(controls.isLocked);
        };
        const onPointerLockError = () => {
            console.error('PointerLockControls: Error locking pointer.');
            setIsPointerLocked(false);
        };

        controls.addEventListener('lock', onPointerLockChange);
        controls.addEventListener('unlock', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError);

        // Click to lock pointer
        const lockPointer = () => {
            if (!isPopupOpen) { // Only lock if popup is not open
                 controls.lock();
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
        const animate = () => {
            requestAnimationFrame(animate);

            const time = performance.now();
            const delta = (time - prevTime) / 1000; // Delta time in seconds

            if (controlsRef.current?.isLocked === true) {
                const player = playerRef.current;

                 // Reset velocity
                 velocity.current.x -= velocity.current.x * 10.0 * delta;
                 velocity.current.z -= velocity.current.z * 10.0 * delta;

                // Calculate direction
                direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
                direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
                direction.current.normalize(); // Ensure consistent speed in all directions

                 // Apply movement based on camera direction
                 const moveX = direction.current.x * MOVE_SPEED * delta;
                 const moveZ = direction.current.z * MOVE_SPEED * delta;

                 const potentialMove = new THREE.Vector3();
                 controlsRef.current.getDirection(potentialMove); // Get camera direction
                 potentialMove.y = 0; // Ignore vertical component for movement
                 potentialMove.normalize();

                 const rightVector = new THREE.Vector3();
                 rightVector.crossVectors(camera.up, potentialMove).normalize(); // Get right vector

                 const forwardMove = potentialMove.clone().multiplyScalar(-moveZ); // Forward/Backward
                 const sidewaysMove = rightVector.multiplyScalar(-moveX); // Left/Right


                 const finalMove = new THREE.Vector3();
                 finalMove.add(forwardMove).add(sidewaysMove);


                 // --- Collision Detection before moving ---
                 const currentPosition = player.position.clone();
                 const nextPosition = currentPosition.clone().add(finalMove);

                if (isPositionValid(nextPosition)) {
                     player.position.copy(nextPosition); // Apply movement if valid
                 } else {
                     // Try moving along Z axis only
                     const nextPositionZ = currentPosition.clone().add(forwardMove);
                     if (isPositionValid(nextPositionZ)) {
                         player.position.copy(nextPositionZ);
                     } else {
                         // Try moving along X axis only
                         const nextPositionX = currentPosition.clone().add(sidewaysMove);
                         if (isPositionValid(nextPositionX)) {
                             player.position.copy(nextPositionX);
                         }
                         // If both fail, player doesn't move
                     }
                 }


                 // Update directional light target to follow player
                 directionalLight.target.position.copy(player.position);


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
                 // Reset velocity if pointer isn't locked
                 velocity.current.set(0, 0, 0);
                 setNearbyObject(null); // Clear nearby object when not locked
            }


            rendererRef.current?.render(sceneRef.current, cameraRef.current);
            prevTime = time;
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
                currentMount.removeChild(rendererRef.current.domElement);
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
            playerRef.current.remove(cameraRef.current); // Remove camera before cleanup
            setIsPointerLocked(false); // Ensure state is reset
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleInteraction, isPositionValid, dungeonData]); // Add dependencies that don't change frequently

     // Effect to handle popup closing and pointer locking
    useEffect(() => {
        if (!isPopupOpen && !isPointerLocked) {
            // Attempt to re-lock pointer after closing the dialog if needed
             // maybe add a small delay or rely on user click to re-lock
        }
    }, [isPopupOpen, isPointerLocked]);

    return (
        <div ref={mountRef} className="w-full h-full relative cursor-pointer">
             {!isPointerLocked && !isPopupOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl pointer-events-none">
                    Click to Look Around
                </div>
            )}
            {isPointerLocked && nearbyObject && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary">
                    Press Enter to interact
                </div>
            )}
             {/* Crosshair */}
            {isPointerLocked && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-1 h-4 bg-foreground/70"></div>
                    <div className="w-4 h-1 bg-foreground/70 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                </div>
            )}

             <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-foreground border-primary rounded-lg shadow-xl">
                    <DialogHeader className="bg-primary p-4 rounded-t-lg">
                        <DialogTitle className="text-primary-foreground text-lg">Object Information</DialogTitle>
                    </DialogHeader>
                     <DialogDescription className="p-1"> {/* Reduced padding */}
                            <ScrollArea className="h-[250px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground mt-2 mb-4">
                                {popupContent}
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
```