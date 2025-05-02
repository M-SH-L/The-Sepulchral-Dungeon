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
 const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9;
 const MOVE_SPEED = 3.5;
 const ROTATION_SPEED = 1.25;
@@ -831,7 +829,6 @@
                 case 'w': moveForward.current = true; break;
                 case 'a': moveLeft.current = true; break;
                 case 's': moveBackward.current = true; break;
-                case 'd': moveRight.current = true; break; // Changed to moveRight
                 case 'd': moveRight.current = true;
             }
         };
@@ -920,5 +917,4 @@
         </div>
     );
 }
-
+