'use client';
 
 import React, { useRef, useEffect, useState, useCallback } from 'react';
 import * as THREE from 'three';
-
 import { generateDungeon, DungeonTile } from './dungeon-generator';
 import ControlsDisplay from './controls-display';
 import LightMeter from './light-meter';
@@ -40,7 +39,6 @@
 // Constants
 const PLAYER_HEIGHT = 1.7;
 const PLAYER_RADIUS = 0.3;
-const COLLECTION_DISTANCE = 1.5; // Increased distance for automatic collection
 const COLLECTION_DISTANCE = 1.5; // Adjust as needed to ensure smooth and consistent light collection
 const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
 const MOVE_SPEED = 3.5;
@@ -827,10 +825,10 @@
             keysPressedRef.current[key] = true;
              switch (key) {
                 case 'w': moveForward.current = true; break;
+                case 'a': moveLeft.current = true; break;
                 case 's': moveBackward.current = true; break;
-                case 'a': moveLeft.current = true; break; // Changed to moveLeft
                 case 'd': moveRight.current = true; break; // Changed to moveRight
-                // Removed Arrow Key handling
+
              }
         };
         const handleKeyUp = (event: KeyboardEvent) => {
@@ -841,7 +839,7 @@
                 case 's': moveBackward.current = false; break;
                 case 'a': moveLeft.current = false; break; // Changed to moveLeft
                 case 'd': moveRight.current = false; break; // Changed to moveRight
-                 // Removed Arrow Key handling
+
              }
         };
 
