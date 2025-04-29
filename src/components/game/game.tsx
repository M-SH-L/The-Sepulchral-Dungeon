
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
const DUNGEON_SIZE_WIDTH = 30; // Increased size
const DUNGEON_SIZE_HEIGHT = 30; // Increased size
const WALL_HEIGHT = 2.5;
const TILE_SIZE = 1.0;
const TORCH_PROBABILITY = 0.04; // Chance to place a torch on a floor tile near a wall
const BASE_TORCH_LIGHT_INTENSITY = 1.5; // Base intensity for flicker
const TORCH_LIGHT_DISTANCE = 5.0; // Increased distance
const TORCH_LIGHT_COLOR = 0xffa54a; // Warm orange light
const TORCH_HEIGHT_OFFSET = 1.2; // How high the torch flame is from the floor
const FLICKER_SPEED = 5.0; // How fast the torch flickers
const FLICKER_INTENSITY_VARIATION = 0.5; // How much the intensity changes
const FLICKER_POSITION_VARIATION = 0.03; // How much the flame moves vertically

// Function to create a torch model and light
const createTorch = (position: THREE.Vector3): TorchData => {
    const torchGroup = new THREE.Group();

    // Stick
    const stickGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 }); // Darker wood
    const stickMesh = new THREE.Mesh(stickGeometry, stickMaterial);
    stickMesh.position.y = 0.5; // Position stick slightly above ground
    stickMesh.castShadow = true;
    torchGroup.add(stickMesh);

    // Flame (simple sphere for low poly)
    const flameGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: TORCH_LIGHT_COLOR }); // Use BasicMaterial for unlit flame
    const flameMesh = new THREE.Mesh(flameGeometry, flameMaterial);
    flameMesh.position.y = 1.0 + 0.1; // Position flame atop the stick
    flameMesh.name = "torchFlame"; // Add name for animation lookup
    torchGroup.add(flameMesh);

    // Point Light
    const pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, BASE_TORCH_LIGHT_INTENSITY, TORCH_LIGHT_DISTANCE);
    pointLight.position.y = TORCH_HEIGHT_OFFSET; // Position light source near the flame
    pointLight.castShadow = true; // Torches cast shadows
    pointLight.shadow.mapSize.width = 256; // Lower resolution for performance
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.bias = -0.01; // Adjust shadow bias if needed
    pointLight.name = "torchLight"; // Add name for animation lookup
    torchGroup.add(pointLight);


    torchGroup.position.copy(position);
    return { group: torchGroup, light: pointLight, flame: flameMesh };
};

// HUD Component
const GameHUD: React.FC = () => {
    return (
        <div className="absolute top-4 left-4 p-4 bg-background/70 text-foreground rounded-md shadow-lg text-sm border border-primary pointer-events-none">
            <h3 className="font-bold mb-2 text-base">Controls</h3>
            <ul className="list-none space-y-1">
                <li><span className="font-semibold">W, A, S, D:</span> Move</li>
                <li><span className="font-semibold">Mouse Left/Right:</span> Look</li>
                <li><span className="font-semibold">Click:</span> Lock Mouse</li>
                <li><span className="font-semibold">Enter:</span> Interact (when near object)</li>
                <li><span className="font-semibold">Esc:</span> Unlock Mouse / Close Pop-up</li>
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
                        Explore the procedurally generated dungeon. Use your mouse to look left/right and W/A/S/D keys to move.
                        Find mysterious objects and press Enter to inspect them. Click the screen or press Enter to begin.
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
    const torchesRef = useRef<TorchData[]>([]); // Store torch data for animation
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
    const clock = useRef(new THREE.Clock()); // Use ref for clock

    const dungeonData = React.useMemo(() => generateDungeon(DUNGEON_SIZE_WIDTH, DUNGEON_SIZE_HEIGHT, 15, 5, 9), []); // Slightly more rooms/complexity

    // Interaction Logic - Triggered by Enter key press
    const handleInteraction = useCallback(() => {
        if (nearbyObject && isPointerLocked) { // Only interact if locked and near
            setPopupContent(nearbyObject.info);
            setIsPopupOpen(true);
            controlsRef.current?.unlock(); // Unlock pointer when dialog opens
        }
    }, [nearbyObject, isPointerLocked]); // Depend on isPointerLocked

    const isPositionValid = useCallback((newPosition: THREE.Vector3): boolean => {
        // Use player radius for collision check corners
        const corners = [
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x + PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z - PLAYER_RADIUS),
            new THREE.Vector3(newPosition.x - PLAYER_RADIUS, 0, newPosition.z + PLAYER_RADIUS),
        ];

        for (const corner of corners) {
             // Convert world position to grid coordinates, centering check within the tile
            const gridX = Math.floor(corner.x / TILE_SIZE + 0.5);
            const gridZ = Math.floor(corner.z / TILE_SIZE + 0.5);


            if (
                gridX < 0 || gridX >= DUNGEON_SIZE_WIDTH ||
                gridZ < 0 || gridZ >= DUNGEON_SIZE_HEIGHT
            ) {
                return false; // Out of bounds
            }

            const tile = dungeonData[gridZ]?.[gridX];
            if (tile === undefined || tile === DungeonTile.Wall) {
                return false; // Hit a wall or undefined area
            }
        }
        return true; // Position is valid
    }, [dungeonData]);

     // Function to handle starting the game and locking pointer
    const startGameAndLockPointer = useCallback(() => {
        setGameStarted(true);
         // Delay pointer lock slightly to ensure the canvas is active and intro screen unmounted
        setTimeout(() => {
             if (controlsRef.current && !controlsRef.current.isLocked) {
                 try {
                     // Check for Pointer Lock API support before attempting lock
                     if ('pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document) {
                          controlsRef.current.lock();
                     } else {
                         console.warn("Pointer Lock API not supported by this browser.");
                         toast({
                             title: "Pointer Lock Not Supported",
                             description: "Your browser does not seem to support the Pointer Lock API required for mouse look.",
                             variant: "destructive",
                             duration: 5000,
                         });
                     }
                 } catch (error) {
                     console.warn("Attempted to lock pointer, but failed:", error);
                     // Toast notification handled by the onPointerLockError handler
                 }
             }
        }, 150); // Increased delay slightly
    }, [toast]);


    // Initial Setup Effect
    useEffect(() => {
        if (!mountRef.current || !gameStarted) return; // Only setup if game has started

        const currentMount = mountRef.current;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0x4a3026); // Deeper Sepia/Brown background
        scene.fog = new THREE.Fog(0x4a3026, 3, 15); // Adjust fog

        // --- Camera Setup ---
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100); // Slightly narrower FOV
        cameraRef.current = camera;

        // --- Renderer Setup ---
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9; // Slightly brighter exposure

        // Apply Sepia Filter Postprocessing
        const sepiaShader: THREE.Shader = {
            uniforms: {
                "tDiffuse": { value: null },
                "amount": { value: 0.8 } // Adjust sepia intensity (0 to 1)
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform float amount;
                uniform sampler2D tDiffuse;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D( tDiffuse, vUv );
                    vec3 c = color.rgb;
                    color.r = dot( c, vec3( 1.0 - 0.607 * amount, 0.769 * amount, 0.189 * amount ) );
                    color.g = dot( c, vec3( 0.349 * amount, 1.0 - 0.314 * amount, 0.168 * amount ) );
                    color.b = dot( c, vec3( 0.272 * amount, 0.534 * amount, 1.0 - 0.869 * amount ) );
                    gl_FragColor = vec4( mix( color.rgb, c, 0.1 ), color.a ); // Mix slightly with original color for subtle effect
                     // Clamp colors to avoid overly bright artifacts
                    gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
                }
            `
        };
         // NOTE: ShaderPass and EffectComposer require importing from 'three/examples/jsm/postprocessing/...'
         // Due to the current setup, this is omitted for simplicity, but would be needed for a true post-processing filter.
         // Renderer background color and fog provide the primary sepia feel for now.

        // --- Lighting Setup ---
        const ambientLight = new THREE.AmbientLight(0x504030, 0.3); // Slightly stronger ambient sepia tint
        scene.add(ambientLight);

        // --- Player Setup ---
        const player = playerRef.current;
        player.position.y = 0; // Player group at floor level
        camera.position.y = CAMERA_EYE_LEVEL; // Camera within player group at eye level
        player.add(camera);
        scene.add(player);

        // Find starting position (prefer non-corridor tiles)
        let startX = Math.floor(DUNGEON_SIZE_WIDTH / 2);
        let startZ = Math.floor(DUNGEON_SIZE_HEIGHT / 2);
        let foundStart = false;
         outerLoop: for (let z = 1; z < dungeonData.length - 1; z++) {
            for (let x = 1; x < dungeonData[z].length - 1; x++) {
                 if (dungeonData[z][x] === DungeonTile.Floor) { // Prioritize Floor over Corridor
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
         if (!foundStart && dungeonData[startZ]?.[startX] === DungeonTile.Wall) { // If center is wall, find *any* non-wall
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


        // --- Dungeon Rendering ---
        const wallGeometry = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
        const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const ceilingGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x704214, roughness: 0.9, metalness: 0.1 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x967969, side: THREE.DoubleSide, roughness: 1.0 });
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, side: THREE.DoubleSide, roughness: 1.0 }); // Darker ceiling

        const dungeonGroup = dungeonGroupRef.current;
        torchesRef.current = []; // Clear previous torches
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
                    ceiling.receiveShadow = true; // Ceilings receive shadows from torches
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
                         const torchData = createTorch(torchPosition);
                         dungeonGroup.add(torchData.group);
                         torchesRef.current.push(torchData); // Store for animation
                    }


                    // Add placeholder objects randomly on floor tiles (reduced probability)
                    if (tile === DungeonTile.Floor && Math.random() < 0.04) { // Even lower chance
                        const objectGeometry = new THREE.IcosahedronGeometry(0.3, 0); // Low poly
                        const objectMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.1 }); // SaddleBrown
                        const placeholderObject = new THREE.Mesh(objectGeometry, objectMaterial);
                        placeholderObject.position.set(tileCenterX, 0.3, tileCenterZ); // Raise slightly off floor
                        placeholderObject.castShadow = true;
                        placeholderObject.receiveShadow = true;
                         // Add rotation for visual interest
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

        // --- Pointer Lock Controls ---
        const controls = new PointerLockControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.minPolarAngle = Math.PI / 2; // Lock vertical look - angle from top (0)
        controls.maxPolarAngle = Math.PI / 2; // Lock vertical look - angle from bottom (PI)

        const onPointerLockChange = () => {
             const locked = controls.isLocked;
            setIsPointerLocked(locked);
             if (!locked) {
                 // If unlocking and not because the popup opened, clear nearby object hint
                 if (!isPopupOpen) {
                     setNearbyObject(null);
                 }
             }
        };
        const onPointerLockError = (event: Event) => {
            console.warn('PointerLockControls: Error locking pointer.', event);
             setIsPointerLocked(false);
             toast({
                 title: "Pointer Lock Unavailable",
                 description: "Cannot lock mouse pointer. This may be due to browser settings or running in a restricted environment (like some preview iframes). Try opening in a new tab.",
                 variant: "destructive",
                 duration: 7000, // Longer duration
             });
        };

        controls.addEventListener('lock', onPointerLockChange);
        controls.addEventListener('unlock', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError, false);

        // Click to lock pointer (only if game started and popup closed)
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
                               duration: 5000,
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
                     if (isPopupOpen) {
                         // Allow Enter to close the popup as well
                         setIsPopupOpen(false);
                         // Attempt to re-lock pointer after closing with Enter
                         setTimeout(() => lockPointer(), 100);
                     } else if (isPointerLocked && nearbyObject) {
                         handleInteraction();
                     }
                    break;
                case 'escape':
                    if (isPopupOpen) {
                        setIsPopupOpen(false);
                         // Attempt to re-lock pointer after closing with Escape
                         setTimeout(() => lockPointer(), 100);
                    } else if (isPointerLocked) {
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
        // const clock = new THREE.Clock(); // Moved to useRef

        const animate = () => {
             if (!gameStarted || !rendererRef.current || !sceneRef.current || !cameraRef.current) {
                 // Ensure cleanup doesn't cause errors if called after component unmounts/stops
                 if (frameId) cancelAnimationFrame(frameId);
                 return;
             }
            const frameId = requestAnimationFrame(animate);

            const delta = clock.current.getDelta();
            const elapsedTime = clock.current.getElapsedTime();

            // Animate Torches
            torchesRef.current.forEach(torchData => {
                const { light, flame } = torchData;
                // Flicker intensity
                 const intensityNoise = (Math.sin(elapsedTime * FLICKER_SPEED + light.id * 0.7) + Math.cos(elapsedTime * FLICKER_SPEED * 0.6 + light.id)) * 0.5; // More complex noise
                light.intensity = BASE_TORCH_LIGHT_INTENSITY + intensityNoise * FLICKER_INTENSITY_VARIATION;

                // Flicker flame position slightly
                const positionNoiseY = Math.sin(elapsedTime * FLICKER_SPEED * 1.2 + flame.id * 0.5) * FLICKER_POSITION_VARIATION;
                flame.position.y = (1.0 + 0.1) + positionNoiseY; // Base position + flicker

                // Optional: Flicker flame scale slightly for more visual effect
                 const scaleNoise = 1.0 + Math.cos(elapsedTime * FLICKER_SPEED * 0.8 + flame.id * 0.9) * 0.1;
                 flame.scale.setScalar(scaleNoise);
            });


            if (controlsRef.current?.isLocked === true) {
                const player = playerRef.current;
                const camera = cameraRef.current;

                // Calculate movement direction based on camera (horizontal only)
                direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
                direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
                direction.current.normalize(); // Ensure consistent speed diagonally

                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0; // Ignore vertical component for movement
                cameraDirection.normalize();

                // Calculate right vector based on camera (horizontal only)
                 // Camera up is always (0, 1, 0) since we locked vertical rotation
                const cameraRight = new THREE.Vector3();
                cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();


                // Combine inputs into a final move vector
                const moveVector = new THREE.Vector3();
                // Move forward/backward along the camera's facing direction (horizontal)
                moveVector.addScaledVector(cameraDirection, direction.current.z);
                 // Move left/right perpendicular to the camera's facing direction (horizontal)
                moveVector.addScaledVector(cameraRight, direction.current.x);

                 // Normalize the final move vector if needed (e.g., if mixing inputs directly)
                 // In this case, direction is already normalized, so scaling is fine.
                 // moveVector.normalize(); // Uncomment if combining non-normalized inputs


                const actualMoveSpeed = MOVE_SPEED * delta;
                const moveAmount = moveVector.multiplyScalar(actualMoveSpeed);

                // Simple Collision Detection & Response
                const currentPosition = player.position.clone();
                const nextPosition = currentPosition.clone().add(moveAmount);


                if (isPositionValid(nextPosition)) {
                    player.position.copy(nextPosition);
                } else {
                    // Try moving only on X axis
                    const moveX = moveAmount.clone();
                    moveX.z = 0; // Isolate X movement
                    const nextPositionX = currentPosition.clone().add(moveX);

                    // Try moving only on Z axis
                    const moveZ = moveAmount.clone();
                    moveZ.x = 0; // Isolate Z movement
                    const nextPositionZ = currentPosition.clone().add(moveZ);

                    // Check X movement first
                    if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionX)) {
                         player.position.x = nextPositionX.x; // Allow X movement
                         // Now check if Z movement is possible from the new X position
                         const nextPositionZFromNewX = player.position.clone().add(moveZ);
                         if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZFromNewX)) {
                             player.position.z = nextPositionZFromNewX.z; // Allow Z too
                         }
                    }
                    // Else (if X move wasn't valid or didn't happen), check Z movement from original spot
                    else if (moveZ.lengthSq() > 0.0001 && isPositionValid(nextPositionZ)) {
                         player.position.z = nextPositionZ.z; // Allow Z movement
                          // Now check if X movement is possible from the new Z position
                         const nextPositionXFromNewZ = player.position.clone().add(moveX);
                         if (moveX.lengthSq() > 0.0001 && isPositionValid(nextPositionXFromNewZ)) {
                             player.position.x = nextPositionXFromNewZ.x; // Allow X too
                         }
                    }
                }


                // Check for nearby interactable objects
                let closestObject: InteractableObject | null = null;
                let minDistanceSq = INTERACTION_DISTANCE * INTERACTION_DISTANCE;

                interactableObjectsRef.current.forEach(obj => {
                    // Use player position for distance check
                    const distanceSq = player.position.distanceToSquared(obj.mesh.position);
                    if (distanceSq < minDistanceSq) {
                        minDistanceSq = distanceSq;
                        closestObject = obj;
                    }
                });

                 // Update state only if the closest object changes
                 if (closestObject?.id !== nearbyObject?.id) {
                     setNearbyObject(closestObject);
                 }

            } else {
                 // If pointer is not locked, ensure the hint is hidden
                 if (nearbyObject !== null) {
                     setNearbyObject(null);
                 }
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        // Start animation loop
        let frameId = requestAnimationFrame(animate);


        // Cleanup
        return () => {
             if (frameId) cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            currentMount.removeEventListener('click', lockPointer);
            controlsRef.current?.removeEventListener('lock', onPointerLockChange);
            controlsRef.current?.removeEventListener('unlock', onPointerLockChange);
            document.removeEventListener('pointerlockerror', onPointerLockError, false);
            controlsRef.current?.dispose();


            if (currentMount && rendererRef.current) {
                // Check if the renderer's DOM element is still a child before removing
                if (currentMount.contains(rendererRef.current.domElement)) {
                     try {
                         currentMount.removeChild(rendererRef.current.domElement);
                     } catch (e) {
                         console.warn("Error removing renderer DOM element:", e);
                     }
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
                  // Clear references to potentially large objects
                 torchesRef.current = [];
                 interactableObjectsRef.current = [];
                 dungeonGroupRef.current.clear(); // Clear children of the dungeon group
            }
             rendererRef.current?.dispose(); // Dispose renderer resources
             // Safely remove camera from player group if it exists
             if (cameraRef.current && playerRef.current?.children.includes(cameraRef.current)) {
                  playerRef.current.remove(cameraRef.current);
             }

              // Reset state variables
             setIsPointerLocked(false);
             setNearbyObject(null);
             setIsPopupOpen(false);
             clock.current.stop(); // Stop the clock

             // Clear refs to help GC
             sceneRef.current = undefined;
             rendererRef.current = undefined;
             controlsRef.current = undefined;
             cameraRef.current = undefined;
             playerRef.current = new THREE.Group(); // Re-initialize player ref
             dungeonGroupRef.current = new THREE.Group(); // Re-initialize dungeon group ref
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameStarted]); // Only re-run setup when gameStarted changes


    // Effect to handle pointer lock/unlock when popup state changes
    useEffect(() => {
        if (!gameStarted) return;

        if (isPopupOpen) {
            if (controlsRef.current?.isLocked) {
                controlsRef.current.unlock();
            }
        }
        // Attempt to re-lock is handled by click listener or Esc/Enter handlers now
    }, [isPopupOpen, gameStarted]);

    if (!gameStarted) {
        return <IntroScreen onStartGame={startGameAndLockPointer} />;
    }

    return (
        <div ref={mountRef} className="w-full h-full relative cursor-crosshair bg-black"> {/* Ensure mount div takes full space */}
             <GameHUD /> {/* Always display HUD */}

             {/* Hint: Click to lock mouse (only when not locked and popup closed) */}
             {!isPointerLocked && !isPopupOpen && gameStarted && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xl font-semibold pointer-events-none z-10">
                    Click screen to lock mouse and look around
                </div>
            )}

             {/* Hint: Press Enter to interact (only when locked and near object) */}
            {isPointerLocked && nearbyObject && !isPopupOpen && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 p-3 bg-background/80 text-foreground rounded-md shadow-lg text-base border border-primary pointer-events-none z-10">
                    Press <span className="font-bold text-primary">[ Enter ]</span> to interact
                </div>
            )}

            {/* Crosshair (only when locked) */}
            {isPointerLocked && (
                 <div className="absolute top-1/2 left-1/2 w-1 h-1 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-foreground/80 rounded-full z-10"></div>
            )}

             {/* Scroll Popup Dialog */}
             <Dialog open={isPopupOpen} onOpenChange={(open) => {
                 setIsPopupOpen(open);
                 // If closing the dialog, attempt to re-lock pointer after a short delay
                 if (!open) {
                     setTimeout(() => {
                          if (gameStarted && controlsRef.current && !controlsRef.current.isLocked) {
                                // Only try to lock if the game is still running and controls exist
                                try {
                                    if ('pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document) {
                                        controlsRef.current.lock();
                                    }
                                } catch(e) { console.warn("Error re-locking pointer after dialog close:", e); }
                            }
                     }, 150);
                 }
             }}>
                <DialogContent className="sm:max-w-[475px] bg-background text-foreground border-primary rounded-lg shadow-xl"> {/* Slightly wider */}
                    <DialogHeader className="bg-primary p-4 rounded-t-lg">
                        <DialogTitle className="text-primary-foreground text-lg">Object Details</DialogTitle>
                         <DialogDescription className="text-primary-foreground/80 text-xs pt-1">
                           Press Esc or click Close to return.
                         </DialogDescription>
                    </DialogHeader>
                     {/* Content uses ScrollArea */}
                     <div className="p-4">
                         <ScrollArea className="h-[250px] w-full rounded-md border border-input p-4 bg-secondary text-secondary-foreground">
                             <p className="whitespace-pre-wrap">{popupContent}</p> {/* Allow line breaks */}
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

    