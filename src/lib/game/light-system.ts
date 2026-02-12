import * as THREE from 'three';
import {
    MAX_LIGHT_DURATION,
    MIN_PLAYER_LIGHT_INTENSITY,
    MAX_PLAYER_LIGHT_INTENSITY,
    MIN_PLAYER_LIGHT_DISTANCE,
    MAX_PLAYER_LIGHT_DISTANCE,
} from './constants';

export function calculateLightProperties(lightDuration: number): {
    intensity: number;
    distance: number;
    lightRatio: number;
} {
    const lightRatio = lightDuration / MAX_LIGHT_DURATION;
    const easedRatio = Math.pow(lightRatio, 1.5);

    const intensity = THREE.MathUtils.lerp(MIN_PLAYER_LIGHT_INTENSITY, MAX_PLAYER_LIGHT_INTENSITY, easedRatio);
    const distance = THREE.MathUtils.lerp(MIN_PLAYER_LIGHT_DISTANCE, MAX_PLAYER_LIGHT_DISTANCE, easedRatio);

    return { intensity, distance, lightRatio };
}

export function calculateLightDecay(distanceMoved: number, decayRate: number): number {
    return distanceMoved * decayRate;
}
