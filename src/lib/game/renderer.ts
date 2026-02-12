import * as THREE from 'three';
import {
    CAMERA_EYE_LEVEL,
    INITIAL_PLAYER_LIGHT_INTENSITY,
    INITIAL_PLAYER_LIGHT_DISTANCE,
    MAX_PLAYER_LIGHT_DISTANCE,
} from './constants';

export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    return renderer;
}

export function createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = CAMERA_EYE_LEVEL;
    return camera;
}

export function createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    return scene;
}

export function createPlayerLight(x: number, z: number): THREE.PointLight {
    const playerLight = new THREE.PointLight(0xffeedd, INITIAL_PLAYER_LIGHT_INTENSITY, INITIAL_PLAYER_LIGHT_DISTANCE);
    playerLight.position.set(x, CAMERA_EYE_LEVEL + 0.2, z);
    playerLight.castShadow = true;
    playerLight.shadow.mapSize.width = 1024;
    playerLight.shadow.mapSize.height = 1024;
    playerLight.shadow.camera.near = 0.5;
    playerLight.shadow.camera.far = MAX_PLAYER_LIGHT_DISTANCE * 1.2;
    playerLight.shadow.bias = -0.005;
    return playerLight;
}

export function setupResizeHandler(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer
): () => void {
    const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}

export function dispose(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    renderer.dispose();
    scene.clear();
}
