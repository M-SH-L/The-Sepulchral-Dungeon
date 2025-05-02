
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Geist_Mono } from 'next/font/google';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});


interface LightMeterProps {
    lightDuration: number;
    maxLightDuration: number;
    numberOfSegments?: number;
}

const LightMeter: React.FC<LightMeterProps> = ({
    lightDuration,
    maxLightDuration,
    numberOfSegments = 20, // Match the image
}) => {
    const lightPercentage = Math.max(0, Math.min(100, (lightDuration / maxLightDuration) * 100));
    const filledSegments = Math.ceil((lightPercentage / 100) * numberOfSegments);

    return (
        <div className={cn(
            "absolute top-28 right-4 p-3 bg-background/70 text-foreground rounded-md shadow-lg border border-primary/50 pointer-events-none z-10 flex flex-col items-center",
             geistMono.variable, // Apply Geist Mono font variable
             "intro-screen-font" // Use the specific font class if needed, or rely on variable
             )}>
            {/* Segments Container - Reversed Column */}
            <div className="flex flex-col-reverse gap-1 mb-2">
                {Array.from({ length: numberOfSegments }).map((_, index) => (
                    <div
                        key={index}
                        className={cn(
                            'w-10 h-2 rounded-full transition-colors duration-200',
                            index < filledSegments
                                ? 'bg-primary' // Filled segment color (brownish)
                                : 'bg-black/60' // Empty segment background (dark)
                        )}
                    />
                ))}
            </div>
             {/* Label */}
             <p className="text-xs font-bold text-primary-foreground tracking-wider mt-1">
                 LIGHT METER
             </p>
             {lightPercentage <= 0 && (
                <p className="text-xs text-center mt-1 text-destructive font-semibold animate-pulse">
                    Darkness...
                </p>
             )}
        </div>
    );
};

export default LightMeter;
```