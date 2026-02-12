'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Geist_Mono } from 'next/font/google';

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

interface IntroScreenProps {
    onStartGame: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onStartGame }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                onStartGame();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onStartGame]);

    return (
        <div className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-sepia-foreground p-8",
            geistMono.variable,
            "intro-screen-font"
        )}>
            <h1 className="text-5xl font-bold mb-6 text-primary animate-pulse">Sepia Dungeon Explorer</h1>
            <p className="text-lg text-center mb-8 max-w-md text-foreground/80">
                Navigate the dimly lit corridors. Collect light orbs to keep your path illuminated.
                If the light fades completely, the darkness consumes you.
            </p>
            <div className="text-left mb-8 bg-background/10 p-4 rounded border border-primary/50 max-w-sm w-full">
                <h2 className="text-xl font-semibold mb-3 text-primary-foreground">Instructions & Controls</h2>
                <ul className="list-none space-y-1 text-sm text-foreground/90">
                    <li><span className="font-semibold text-primary-foreground">[ W ] :</span> Move Forward</li>
                    <li><span className="font-semibold text-primary-foreground">[ S ] :</span> Move Backward</li>
                    <li><span className="font-semibold text-primary-foreground">[ ← ] :</span> Look Left</li>
                    <li><span className="font-semibold text-primary-foreground">[ → ] :</span> Look Right</li>
                    <li className="mt-2">Collect light orbs by walking near them.</li>
                    <li>Keep your Light Meter above zero to survive.</li>
                    <li>Explore the maze to find the exit (not yet implemented).</li>
                </ul>
            </div>
            <Button
                onClick={onStartGame}
                className="text-xl px-8 py-4 bg-primary hover:bg-primary/80 text-primary-foreground"
                aria-label="Start Game (Press Enter)"
            >
                Enter the Dungeon <span className="text-sm ml-2">(Press Enter)</span>
            </Button>
        </div>
    );
};

export default IntroScreen;
