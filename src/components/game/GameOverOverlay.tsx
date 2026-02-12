'use client';

import React from 'react';

const GameOverOverlay: React.FC = () => {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
            <p className="text-4xl font-bold text-destructive animate-pulse">GAME OVER</p>
        </div>
    );
};

export default GameOverOverlay;
