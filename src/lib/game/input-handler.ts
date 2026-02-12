import { useGameStore } from './game-store';

export function setupInputListeners(): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        useGameStore.getState().setKey(key, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        useGameStore.getState().setKey(key, false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
}
