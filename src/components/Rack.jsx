import React, { useEffect } from 'react';
import MasterOutput from './modules/MasterOutput';
import Oscillator from './modules/Oscillator';
import ISSNavModule from './modules/ISSNavModule';
import LISModule from './modules/LISModule';
import RadiationDetectorModule from './modules/RadiationDetectorModule';
import Mixer from './modules/Mixer';
import ToGate from './modules/ToGate';
import PatchCable from './PatchCable';
import { useSynthStore } from '../store/useSynthStore';
import { audioEngine } from '../engine/AudioEngine';

const Rack = () => {
    const connections = useSynthStore(state => state.connections);
    const portPositions = useSynthStore(state => state.portPositions);
    const isDraggingCable = useSynthStore(state => state.isDraggingCable);
    const dragStart = useSynthStore(state => state.dragStart);
    const dragCurrent = useSynthStore(state => state.dragCurrent);
    const updateDrag = useSynthStore(state => state.updateDrag);
    const cancelCable = useSynthStore(state => state.cancelCable);

    const handleMouseMove = (e) => {
        if (isDraggingCable) {
            updateDrag({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (isDraggingCable) {
            cancelCable();
        }
    };

    // Sync connections to AudioEngine
    useEffect(() => {
        connections.forEach(conn => {
            audioEngine.connect(conn.fromModule, conn.toModule, conn.fromPort, conn.toPort);
        });
    }, [connections]);

    return (
        <div
            className="w-full h-screen bg-slate-900 p-8 overflow-auto relative"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <div className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            {/* Module Layer */}
            <div className="relative z-10 flex flex-wrap gap-4 pointer-events-auto">
                <MasterOutput />
                <Oscillator id="osc-1" />
                <Mixer id="mixer-1" />
                <ToGate id="gate-1" />
                <ISSNavModule id="iss-nav" />
                <LISModule id="lis-1" />
                <RadiationDetectorModule id="rad-detector-1" />
            </div>

            {/* Cable Layer (SVG Overlay) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible">
                {connections.map(conn => {
                    const fromPos = portPositions[`${conn.fromModule}-output-${conn.fromPort}`];
                    const toPos = portPositions[`${conn.toModule}-input-${conn.toPort}`];
                    if (!fromPos || !toPos) return null;

                    return (
                        <PatchCable
                            key={conn.id}
                            x1={fromPos.x} y1={fromPos.y}
                            x2={toPos.x} y2={toPos.y}
                            onDisconnect={() => {
                                useSynthStore.getState().removeConnection(conn.id);
                                audioEngine.disconnect(conn.fromModule, conn.toModule);
                            }}
                        />
                    );
                })}

                {isDraggingCable && dragStart && dragCurrent && (
                    <PatchCable
                        x1={dragStart.x} y1={dragStart.y}
                        x2={dragCurrent.x} y2={dragCurrent.y}
                        color="#fbbf24"
                        interactive={false}
                    />
                )}
            </svg>
        </div>
    );
};

export default Rack;
