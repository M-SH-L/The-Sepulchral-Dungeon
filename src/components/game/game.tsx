'use client';
 
 import React, { useRef, useEffect, useState, useCallback } from 'react';
 import * as THREE from 'three';
-
 import { generateDungeon, DungeonTile } from './dungeon-generator';
 import ControlsDisplay from './controls-display';
 import LightMeter from './light-meter';
@@ -48,7 +47,6 @@
 
 // Constants
  const PLAYER_HEIGHT = 1.7;
-
  const PLAYER_RADIUS = 0.3;
 +const COLLECTION_DISTANCE = 1.5; // Adjust as needed to ensure smooth and consistent light collection
  const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
@@ -71,6 +69,7 @@
  const fov = 75; // Field of view
  const aspect = window.innerWidth / window.innerHeight; // Aspect ratio
  const near = 0.1; // Near clipping plane
+ const far = 1000; // Far clipping plane
  const initialZoom = 1;
  const initialLightSpread = 10;
  const maxLightDuration = 250;
@@ -96,10 +95,8 @@
   const [currentLevel, setCurrentLevel] = useState(1);
   const keysPressedRef = useRef<{[key: string]: boolean}>({});
 
-
   // Ref for light intensity
  const playerLightIntensity = useRef(0.75);
-
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
@@ -111,14 +108,12 @@
   const isTransitioningRef = useRef(false);
 
   const [isPopupOpen, setIsPopupOpen] = useState(false);
-
   const clockRef = useRef(new THREE.Clock());
   const controlsRef = useRef<THREE.OrbitControls | null>(null);
 
   // Ref for the last position before orb collection
   const lastPositionRef = useRef(new THREE.Vector3());
 
-
   const currentMount = useRef<HTMLDivElement>(null);
   const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
   const cameraRef = useRef<THREE.PerspectiveCamera>(
@@ -133,7 +128,6 @@
     new THREE.AmbientLight(0x404040)
   );
 
-
   const playerLightRef = useRef(new THREE.PointLight(0xffffff, playerLightIntensity.current, initialLightSpread));
   const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
 
@@ -147,7 +141,6 @@
         size: 'small',
     }
   ]);
-
 
   const [dungeon, setDungeon] = useState<DungeonTile[][]>([]);
   const [playerGridPosition, setPlayerGridPosition] = useState({ x: 0, z: 0 });
@@ -173,7 +166,6 @@
           numberOfSegments: 20,
       }
   );
-
 
   // Function to generate dungeon and set initial player position
    const generateNewDungeon = useCallback(() => {
@@ -221,8 +213,6 @@
         }
     }, [generateDungeon]);
 
-
-
   useEffect(() => {
     const currentRef = currentMount.current;
     const width = window.innerWidth;
@@ -238,7 +228,6 @@
       cameraRef.current.position.y = CAMERA_EYE_LEVEL;
       cameraRef.current.zoom = initialZoom;
       cameraRef.current.updateProjectionMatrix();
-
 
       // Set up orbital controls
       const controls = new THREE.OrbitControls(cameraRef.current, currentRef);
@@ -247,7 +236,6 @@
       controls.enablePan = false;
       controls.enableZoom = false;
       controlsRef.current = controls;
-
 
       // Lighting
       sceneRef.current.add(ambientLight);
@@ -263,7 +251,6 @@
       sceneRef.current.fog = new THREE.Fog(0x000000, 1, 50);
       rendererRef.current.setClearColor(0x000000); // Set clear color to black
 
-
       // Initial dungeon generation
       generateNewDungeon();
 
@@ -297,7 +284,6 @@
     const animate = () => {
       if (!animationFrameIdRef.current) return;
 
-
       // Calculate delta for frame-rate independent movement
       const delta = clockRef.current.getDelta();
 
@@ -305,19 +291,18 @@
       const moveSpeed = MOVE_SPEED * delta;
       const rotateSpeed = ROTATE_SPEED * delta;
 
-
       if (moveForward.current) {
           velocity.z -= moveSpeed;
       }
       if (moveBackward.current) {
           velocity.z += moveSpeed;
       }
+      if (moveLeft.current) {
+          velocity.x -= moveSpeed;
+      }
       if (moveRight.current) {
+          velocity.x += moveSpeed;
+      }
 
-          velocity.x += moveSpeed;
-      }
-      if (moveLeft.current) {
-          velocity.x -= moveSpeed;
-      }
 
       // Normalize and apply movement
       if (velocity.length() > 0) {
@@ -337,7 +322,6 @@
           setPlayerGridPosition({ x: newGridX, z: newGridZ });
       }
 
-
       // Update camera position
       cameraRef.current.position.x = playerPosition.x;
       cameraRef.current.position.z = playerPosition.z;
@@ -345,10 +329,8 @@
       playerLightRef.current.position.x = playerPosition.x;
       playerLightRef.current.position.z = playerPosition.z;
 
-
       // Decrease light duration based on movement
       setLightDuration(prevDuration => Math.max(0, prevDuration - (Math.abs(velocity.x) + Math.abs(velocity.z)) * 2));
-
 
       // Collecting light orbs
        if (!isTransitioningRef.current) {
@@ -366,13 +348,11 @@
                 const orb = interactableObjects[index];
                 if (orb && !orb.used) {
                      orb.used = true; // Mark as collected immediately
-
                      // Get size of the orb
                      const lightToAdd = orb.size === 'small' ? 25 : orb.size === 'medium' ? 50 : 75;
 
                      setLightDuration(prevDuration => Math.min(maxLightDuration, prevDuration + lightToAdd));
-
-                     // Hide object
+                     // Hide object +                    
                      orb.mesh.visible = false;
                      setInteractableObjects(currentObjects => {
                           const newObjects = [...currentObjects];
@@ -383,7 +363,6 @@
                      break; // Prevent collecting multiple orbs in one frame
                 }
             }
-
         }
 
       // If the light meter runs out, end the game
@@ -391,10 +370,8 @@
             // Set the light spread to 0
             playerLightRef.current.distance = 0;
         } else {
-            // Calculate new light distance based on light duration
-            const newLightDistance = (lightDuration / maxLightDuration) * maxLightSpread;
-            playerLightRef.current.distance = newLightDistance;
-        }
+           playerLightRef.current.distance = (lightDuration / maxLightDuration) * maxLightSpread;
+       }
 
       if (rendererRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
@@ -425,7 +402,6 @@
         return () => {
             cancelAnimationFrame(animationFrameIdRef.current);
         };
-
     }, [lightDuration, maxLightDuration, generateNewDungeon, interactableObjects, maxLightSpread]);
 
     return (
@@ -465,7 +441,7 @@
         </div>
     );
 };
-
 export default Game;
+
 
+