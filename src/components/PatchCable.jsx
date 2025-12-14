import React from 'react';

const PatchCable = ({ x1, y1, x2, y2, color = '#f59e0b', onDisconnect, interactive = true }) => {
    // Calculate control points for a nice bezier curve
    // The curve should droop slightly or curve naturally based on distance
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const handleLen = Math.min(dist * 0.5, 150);

    // Control points: vertical out from ports usually looks best for rack gear
    // But since our ports are likely on the faceplate, maybe just a standard curve
    // Let's try a "gravity" effect where it droops
    const cp1x = x1;
    const cp1y = y1 + handleLen;
    const cp2x = x2;
    const cp2y = y2 + handleLen;

    const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2} `;

    return (
        <g className="group">
            {/* Hit area (thicker invisible line) */}
            <path
                d={path}
                stroke="transparent"
                strokeWidth="20"
                fill="none"
                className={`cursor - pointer ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} `}
                onClick={onDisconnect}
                onContextMenu={(e) => { e.preventDefault(); onDisconnect && onDisconnect(); }}
            />
            {/* Shadow/Outline for visibility */}
            <path
                d={path}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                className="group-hover:stroke-red-500/50 transition-colors"
            />
            {/* Main Cable */}
            <path
                d={path}
                stroke={color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                className="drop-shadow-lg pointer-events-none"
            />
        </g>
    );
};

export default PatchCable;
