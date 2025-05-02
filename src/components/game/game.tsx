'use client';
 
 import React, { useRef, useEffect, useState, useCallback } from 'react';
 import * as THREE from 'three';
@@ -40,7 +40,6 @@
 // Constants
  const PLAYER_HEIGHT = 1.7;
  const PLAYER_RADIUS = 0.3;
--const COLLECTION_DISTANCE = 1.5; // Increased distance for automatic collection
 +const COLLECTION_DISTANCE = 1.5; // Adjust as needed to ensure smooth and consistent light collection
  const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
  const MOVE_SPEED = 3.5;
@@ -785,10 +784,10 @@
 
               moveRightStrafe = false;
               rotateLeft = false;
-              rotateRight = false;
+              rotateRight = false;            
               playerRotationY.current = 0;
                controlsRef.current?.disconnect();
-               controlsRef.current = null;
+              controlsRef.current = null;
           }
           //console.log('Key released:', event.key);
         };
@@ -897,7 +896,7 @@
 
 
 export default Game;
-
+