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
-
  const PLAYER_RADIUS = 0.3;
 +const COLLECTION_DISTANCE = 1.5; // Adjust as needed to ensure smooth and consistent light collection
  const CAMERA_EYE_LEVEL = PLAYER_HEIGHT * 0.9; // Place camera near the top of the player height
  const MOVE_SPEED = 3.5;
@@ -916,5 +914,5 @@
 
 
 export default Game;
-
+
