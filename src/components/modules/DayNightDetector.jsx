import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Sun, Moon } from 'lucide-react';
import { useISSData } from '../../services/ISSDataService';
import Port from './Port';

const DayNightDetector = ({ id }) => {
    const { rawData } = useISSData();
    const [isDaylight, setIsDaylight] = useState(false);
    const [transitionCount, setTransitionCount] = useState(0);
    const [justTransitioned, setJustTransitioned] = useState(false);

    const gateSignalRef = useRef(null);
    const triggerSignalRef = useRef(null);
    const lastStateRef = useRef(null);

    useEffect(() => {
        // Create output signals
        const gateSignal = new Tone.Signal(0);
        const triggerSignal = new Tone.Signal(0);

        gateSignalRef.current = gateSignal;
        triggerSignalRef.current = triggerSignal;

        // Register with AudioEngine
        const moduleObj = {
            connect: (dest, outPort, inPort) => {
                if (outPort === 0) {
                    gateSignal.connect(dest, 0, inPort);
                } else if (outPort === 1) {
                    triggerSignal.connect(dest, 0, inPort);
                }
            },
            disconnect: (dest) => {
                gateSignal.disconnect(dest);
                triggerSignal.disconnect(dest);
            },
            dispose: () => {
                gateSignal.dispose();
                triggerSignal.dispose();
            }
        };

        audioEngine.registerModule(id, moduleObj);

        return () => {
            moduleObj.dispose();
            audioEngine.unregisterModule(id);
        };
    }, []);

    // Monitor visibility changes
    useEffect(() => {
        const currentState = rawData.visibility === 'daylight';
        const lastState = lastStateRef.current;

        setIsDaylight(currentState);

        // Update gate signal
        if (gateSignalRef.current) {
            gateSignalRef.current.value = currentState ? 1 : 0;
        }

        // Detect transitions
        if (lastState !== null && lastState !== currentState) {
            setTransitionCount(prev => prev + 1);
            setJustTransitioned(true);

            // Fire trigger pulse
            if (triggerSignalRef.current) {
                triggerSignalRef.current.value = 1;
                setTimeout(() => {
                    if (triggerSignalRef.current) {
                        triggerSignalRef.current.value = 0;
                    }
                }, 100); // 100ms trigger pulse
            }

            // Visual feedback
            setTimeout(() => setJustTransitioned(false), 500);
        }

        lastStateRef.current = currentState;
    }, [rawData.visibility]);

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-48 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400">DAY/NIGHT</h3>
                {isDaylight ? (
                    <Sun size={16} className={`text-yellow-400 ${justTransitioned ? 'animate-pulse' : ''}`} />
                ) : (
                    <Moon size={16} className={`text-blue-400 ${justTransitioned ? 'animate-pulse' : ''}`} />
                )}
            </div>

            {/* Status Display */}
            <div className="space-y-3 mb-4">
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <div className="text-center">
                        <div className="text-[10px] text-slate-500 uppercase mb-1">Status</div>
                        <div className={`text-lg font-bold ${isDaylight ? 'text-yellow-400' : 'text-blue-400'}`}>
                            {isDaylight ? 'DAYLIGHT' : 'ECLIPSED'}
                        </div>
                    </div>
                </div>

                {/* Transition Counter */}
                <div className="bg-slate-900 rounded-lg p-2 border border-slate-700">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-500 uppercase">Transitions</span>
                        <span className="text-sm text-slate-300 font-bold">{transitionCount}</span>
                    </div>
                </div>

                {/* Visual Indicator Bar */}
                <div className="h-6 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden relative">
                    <div
                        className={`absolute inset-0 transition-all duration-1000 ${isDaylight ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-blue-900 to-indigo-900'
                            }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${isDaylight ? 'bg-white' : 'bg-slate-400'} shadow-lg`} />
                    </div>
                </div>
            </div>

            {/* Ports */}
            <div className="flex justify-between items-end pt-2 border-t border-slate-700">
                <Port moduleId={id} portId={0} type="output" label="GATE" />
                <Port moduleId={id} portId={1} type="output" label="TRIG" />
            </div>
        </div>
    );
};

export default DayNightDetector;
