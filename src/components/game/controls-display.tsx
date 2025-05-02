
'use client';

import React from 'react';

const ControlsDisplay: React.FC = () => {
    return (
        <div className="absolute top-4 left-4 p-4 bg-background/80 text-foreground rounded-md shadow-lg text-sm border border-primary pointer-events-none z-10 w-64">
            <h3 className="font-bold mb-2 text-base border-b border-primary/50 pb-1">Controls</h3>
            <ul className="list-none space-y-1 text-xs mb-3">
                <li><span className="font-semibold">[ W ]:</span> Move Forward</li>
                <li><span className="font-semibold">[ S ]:</span> Move Backward</li>
                <li><span className="font-semibold">[ ← ]:</span> Look Left</li>
                <li><span className="font-semibold">[ → ]:</span> Look Right</li>
            </ul>
        </div>
    );
};

export default ControlsDisplay;

```