'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { generateDungeon, DungeonTile } from './dungeon-generator';

interface InteractableObject {
    mesh: THREE.Mesh;
    info: string;
    id: number;
}

const Game: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<THREE.Mesh>();
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const controlsRef = useRef<OrbitControls>();
    const sceneRef = useRef<THREE.Scene>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const interactableObjectsRef = useRef<InteractableObject[]>([]);
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupContent, setPopupContent] = useState('');
    const [nearbyObject, setNearbyObject] = useState<InteractableObject | null>(null);

    const interactionDistance = 1.5; // Distance threshold for interaction

    // Generate Dungeon Data
    const dungeonData = generateDungeon(20, 20, 5, 3, 7); // Adjust parameters as needed

    const handleInteraction = useCallback(() => {
        if (nearbyObject) {
            setPopupContent(nearbyObject.info);
            setIsPopupOpen(true);
        }
    }, [nearbyObject]);


    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0xc2b280); // Sepia background

        // Camera setup
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        cameraRef.current = camera;
        camera.position.set(5, 5, 5); // Initial camera position slightly above

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true; // Enable shadows for depth

        // Sepia effect (using post-processing if needed, or simple lighting)
        // For simplicity, using lighting and material colors for sepia tone
        const ambientLight = new THREE.AmbientLight(0x8c7853, 0.8); // Sepia ambient light
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffead0, 1); // Warmer directional light
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        // Configure shadow properties for better quality
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        scene.add(directionalLight);

        // Player setup (simple cube for now)
        const playerGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8); // Taller box for player
        const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4A3026 }); // Deep brown player
        const player = new THREE.Mesh(playerGeometry, playerMaterial);
        player.castShadow = true; // Player casts shadow
        player.position.y = 0.9; // Position player correctly on the ground
        scene.add(player);
        playerRef.current = player;
        // Find starting position
        for (let y = 0; y < dungeonData.length; y++) {
            for (let x = 0; x < dungeonData[y].length; x++) {
                if (dungeonData[y][x] === DungeonTile.Floor) {
                    player.position.x = x;
                    player.position.z = y;
                    camera.position.x = x + 5;
                    camera.position.z = y + 5;
                    camera.position.y = 5;
                    break;
                }
            }
            if (player.position.x !== 0 || player.position.z !== 0) break; // Found start
        }


        // Dungeon rendering
        const wallGeometry = new THREE.BoxGeometry(1, 2.5, 1); // Taller walls
        const floorGeometry = new THREE.PlaneGeometry(1, 1);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.8, metalness: 0.2 }); // Sepia wall
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 0.9 }); // Sepia floor

        const dungeonGroup = new THREE.Group();
        dungeonData.forEach((row, z) => {
            row.forEach((tile, x) => {
                if (tile === DungeonTile.Wall) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(x, 1.25, z); // Center wall cube
                    wall.receiveShadow = true;
                    wall.castShadow = true;
                    dungeonGroup.add(wall);
                } else if (tile === DungeonTile.Floor || tile === DungeonTile.Corridor) {
                    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                    floor.position.set(x, 0, z);
                    floor.rotation.x = -Math.PI / 2;
                    floor.receiveShadow = true;
                    dungeonGroup.add(floor);

                    // Add placeholder objects randomly on floor tiles
                     if (Math.random() < 0.1) { // 10% chance to place an object
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0); // Low poly placeholder
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x4A3026, roughness: 0.5 }); // Accent color
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(x, 0.3, z);
                        placeholderObject.castShadow = true;
                        dungeonGroup.add(placeholderObject);
                        interactableObjectsRef.current.push({
                            mesh: placeholderObject,
                            info: `You found a mysterious object at (${x}, ${z}). It seems ancient and emanates a faint warmth. Perhaps it holds secrets of this dungeon... [Add more scrollable text here to test the functionality. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.]`,
                            id: interactableObjectsRef.current.length,
                        });
                    }
                }
            });
        });
        scene.add(dungeonGroup);


        // Controls setup (OrbitControls for debugging, then switch to player-centric)
        // const controls = new OrbitControls(camera, renderer.domElement);
        // controlsRef.current = controls;
        // controls.target.copy(player.position); // Follow player initially
        // controls.enablePan = false; // Disable panning
        // controls.enableZoom = true; // Allow zoom
        // controls.maxPolarAngle = Math.PI / 2 - 0.1; // Limit looking down too much

        // Mount renderer
        mountRef.current.appendChild(renderer.domElement);

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
             if (event.key === 'Enter' && nearbyObject) {
                handleInteraction();
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);


        // Animation loop
        let lastTime = 0;
        const animate = (time: number) => {
            requestAnimationFrame(animate);

            const deltaTime = (time - lastTime) * 0.001; // Time in seconds
            lastTime = time;

            if (playerRef.current && cameraRef.current && rendererRef.current && sceneRef.current ) {
                const player = playerRef.current;
                const camera = cameraRef.current;
                const speed = 2.5 * deltaTime; // Player speed adjusted by delta time
                const moveVector = new THREE.Vector3();

                if (keysPressedRef.current['w']) moveVector.z -= 1;
                if (keysPressedRef.current['s']) moveVector.z += 1;
                if (keysPressedRef.current['a']) moveVector.x -= 1;
                if (keysPressedRef.current['d']) moveVector.x += 1;

                // Collision detection (simplified)
                const checkCollision = (move: THREE.Vector3): boolean => {
                    const playerBox = new THREE.Box3().setFromObject(player);
                    const targetPosition = player.position.clone().add(move);
                    const targetBox = playerBox.clone().translate(move);

                    for (let i = 0; i < dungeonGroup.children.length; i++) {
                        const child = dungeonGroup.children[i];
                         if (child !== player && child.geometry === wallGeometry) { // Only check walls
                            const wallBox = new THREE.Box3().setFromObject(child);
                            if (targetBox.intersectsBox(wallBox)) {
                                return true; // Collision detected
                            }
                        }
                    }
                    return false; // No collision
                };

                // Normalize movement vector if moving diagonally
                 if (moveVector.lengthSq() > 0) {
                    moveVector.normalize().multiplyScalar(speed);

                    const moveX = new THREE.Vector3(moveVector.x, 0, 0);
                    const moveZ = new THREE.Vector3(0, 0, moveVector.z);

                    // Move on each axis separately to allow sliding along walls
                    if (!checkCollision(moveX)) {
                         player.position.add(moveX);
                    }
                    if (!checkCollision(moveZ)) {
                         player.position.add(moveZ);
                    }
                }

                 // Camera follows player smoothly
                const desiredCameraPosition = player.position.clone().add(new THREE.Vector3(0, 4, 3.5)); // Behind and above player
                camera.position.lerp(desiredCameraPosition, 0.1); // Smooth interpolation
                camera.lookAt(player.position);

                // Check for nearby interactable objects
                let closestObject: InteractableObject | null = null;
                let minDistanceSq = interactionDistance * interactionDistance;

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

            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate(0); // Start animation loop

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement);
            }
             if (sceneRef.current) {
                 // Dispose geometries and materials
                sceneRef.current.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        if (object.geometry) {
                            object.geometry.dispose();
                        }
                        if (object.material) {
                             if (Array.isArray(object.material)) {
                                object.material.forEach(material => material.dispose());
                            } else {
                                object.material.dispose();
                            }
                        }
                    }
                });
            }
            rendererRef.current?.dispose();
        };
    }, [handleInteraction, nearbyObject, dungeonData]); // Add dependencies

    return (
        <div ref={mountRef} className="w-full h-full relative">
            {nearbyObject && (
                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 p-2 bg-background/80 text-foreground rounded-md shadow-lg text-sm">
                    Press Enter to interact with the {nearbyObject.mesh.geometry.type.replace('Geometry', '')}
                </div>
            )}
             <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background text-foreground border-primary">
                    <DialogHeader>
                        <DialogTitle className="text-primary-foreground bg-primary p-2 rounded-t-md">Object Information</DialogTitle>
                        <DialogDescription className="p-4">
                            <ScrollArea className="h-[200px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground">
                                {popupContent}
                            </ScrollArea>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end p-4">
                        <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Game;
