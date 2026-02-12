import * as THREE from 'three';
import { MOVE_SPEED, ROTATION_SPEED, LIGHT_DECAY_PER_UNIT_MOVED } from './constants';
import { isWallCollision } from './collision';
import { useGameStore } from './game-store';

export function updatePlayer(delta: number): number {
    const state = useGameStore.getState();
    const { keys, dungeon, playerPosition, playerRotationY, camera, phase } = state;

    if (phase !== 'playing' || !camera) return 0;

    const moveSpeed = MOVE_SPEED * delta;
    const rotateSpeed = ROTATION_SPEED * delta;
    let distanceMoved = 0;

    // Calculate forward direction from camera
    const moveDirection = new THREE.Vector3();
    camera.getWorldDirection(moveDirection);
    moveDirection.y = 0;
    moveDirection.normalize();

    const nextPos = playerPosition.clone();

    if (keys['w']) {
        const forwardMove = moveDirection.clone().multiplyScalar(moveSpeed);
        nextPos.add(forwardMove);
        distanceMoved += moveSpeed;
    }
    if (keys['s']) {
        const backwardMove = moveDirection.clone().multiplyScalar(-moveSpeed);
        nextPos.add(backwardMove);
        distanceMoved += moveSpeed;
    }

    // Collision check
    if (dungeon.length > 0 && !isWallCollision(nextPos, dungeon)) {
        state.setPlayerPosition(nextPos);
    } else {
        distanceMoved = 0;
    }

    // Handle rotation
    let newRotation = playerRotationY;
    if (keys['arrowleft']) {
        newRotation += rotateSpeed;
    }
    if (keys['arrowright']) {
        newRotation -= rotateSpeed;
    }
    if (newRotation !== playerRotationY) {
        state.setPlayerRotationY(newRotation);
    }

    // Apply rotation to camera
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), newRotation);
    camera.quaternion.copy(quaternion);

    // Light decay
    if (distanceMoved > 0 && state.lightDuration > 0) {
        state.adjustLight(-distanceMoved * LIGHT_DECAY_PER_UNIT_MOVED);
    }

    return distanceMoved;
}
