import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Zap } from 'lucide-react';
import { useLISData } from '../../services/LISDataService';
import Port from './Port';

const normalize = (val, min, max) => {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
};

const LISModule = ({ id }) => {
    const { 
        rawData, 
        normalizedData, 
        strikeHistory,
        startPolling, 
        stopPolling, 
        isPolling,
        dataMode,
        onStrike 
    } = useLISData();

    // Refs for Tone.Signals
    const signalsRef = useRef({
        trigger: new Tone.Signal(0), // Gate/trigger output
        intensity: new Tone.Signal(0), // Intensity CV
        strikeRate: new Tone.Signal(0), // Strike rate CV
    });

    // State for visual feedback
    const [lastStrikeTime, setLastStrikeTime] = useState(null);
    const [isStrikeActive, setIsStrikeActive] = useState(false);

    useEffect(() => {
        startPolling();

        // Register strike callback for trigger output
        const unsubscribe = onStrike((strike) => {
            setLastStrikeTime(strike.timestamp);
            setIsStrikeActive(true);
            
            // Generate a trigger pulse (0 -> 1 -> 0)
            const trigger = signalsRef.current.trigger;
            trigger.value = 1;
            
            // Reset after 100ms
            setTimeout(() => {
                trigger.value = 0;
                setIsStrikeActive(false);
            }, 100);
        });

        // Register signals with AudioEngine
        const signals = signalsRef.current;

        const compositeNode = {
            isCustom: true,
            connect: (dest, outputNum, inputNum) => {
                console.log(`[LISModule] Connecting output ${outputNum} to`, dest, `input: ${inputNum}`);
                try {
                    // Resolve the actual destination node
                    let actualDest = dest;
                    let destInputIndex = inputNum;

                    if (dest.getInput) {
                        actualDest = dest.getInput(inputNum);
                        destInputIndex = 0;
                    }

                    if (!actualDest) {
                        console.error('[LISModule] Could not resolve destination node');
                        return;
                    }

                    // Map outputNum to specific signal
                    switch (outputNum) {
                        case 0: signals.trigger.connect(actualDest, 0, destInputIndex); break;
                        case 1: signals.intensity.connect(actualDest, 0, destInputIndex); break;
                        case 2: signals.strikeRate.connect(actualDest, 0, destInputIndex); break;
                    }
                } catch (err) {
                    console.error('[LISModule] Connect Error:', err);
                }
            },
            disconnect: (dest) => {
                signals.trigger.disconnect(dest);
                signals.intensity.disconnect(dest);
                signals.strikeRate.disconnect(dest);
            },
            dispose: () => {
                signals.trigger.dispose();
                signals.intensity.dispose();
                signals.strikeRate.dispose();
            }
        };

        audioEngine.registerModule(id, compositeNode);

        return () => {
            stopPolling();
            unsubscribe();
            audioEngine.unregisterModule(id);
        };
    }, []);

    // Update signals when normalized data changes
    useEffect(() => {
        const sigs = signalsRef.current;
        sigs.intensity.rampTo(normalizedData.intensity, 0.1);
        sigs.strikeRate.rampTo(normalizedData.strikeRate, 0.1);
    }, [normalizedData]);

    // Calculate time since last strike
    const timeSinceStrike = lastStrikeTime 
        ? Math.floor((Date.now() - lastStrikeTime) / 1000)
        : null;

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-64 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400">LIS</h3>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    <div className="text-[9px] text-slate-500 uppercase">{dataMode}</div>
                    <Zap 
                        size={14} 
                        className={`transition-all duration-100 ${isStrikeActive ? 'text-yellow-400 scale-125' : 'text-slate-600'}`} 
                    />
                </div>
            </div>

            {/* Strike Counter */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Total Strikes</label>
                    <div className="text-lg text-yellow-400 font-bold">{rawData.totalStrikes}</div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Last Minute</label>
                    <div className="text-lg text-yellow-400 font-bold">{rawData.strikesLastMinute}</div>
                </div>
            </div>

            {/* Intensity Display */}
            {rawData.lastStrike && (
                <div className="mb-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-slate-500 uppercase">Last Strike</label>
                        {timeSinceStrike !== null && (
                            <span className="text-[8px] text-slate-500">{timeSinceStrike}s ago</span>
                        )}
                    </div>
                    <div className="h-8 bg-slate-900 rounded border border-slate-700 flex items-center justify-center relative overflow-hidden">
                        {/* Intensity bar */}
                        <div 
                            className="absolute left-0 top-0 bottom-0 bg-yellow-400/30 transition-all duration-300"
                            style={{ width: `${normalizedData.intensity * 100}%` }}
                        />
                        <div className="relative z-10 text-sm text-yellow-400 font-bold">
                            {rawData.lastStrike.intensity.toFixed(0)} <span className="text-[9px]">kA</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Average Intensity */}
            <div className="mb-4 space-y-1">
                <label className="text-[9px] text-slate-500 uppercase">Avg Intensity</label>
                <div className="text-xs text-slate-300">{rawData.averageIntensity.toFixed(1)} kA</div>
            </div>

            {/* Strike History Visualization */}
            <div className="mb-4 h-12 bg-slate-900 rounded border border-slate-700 p-1 flex items-end gap-1">
                {strikeHistory.slice(-8).map((strike, idx) => {
                    const intensity = normalize(strike.intensity, 0, 200);
                    const age = (Date.now() - strike.timestamp) / 1000; // seconds
                    const opacity = Math.max(0.3, 1 - (age / 60)); // Fade over 60 seconds
                    
                    return (
                        <div
                            key={idx}
                            className="flex-1 bg-yellow-400 rounded-t transition-all"
                            style={{
                                height: `${intensity * 100}%`,
                                opacity,
                            }}
                            title={`${strike.intensity.toFixed(0)} kA`}
                        />
                    );
                })}
            </div>

            {/* Outputs */}
            <div className="flex justify-between items-end pt-2 border-t border-slate-700">
                <Port moduleId={id} portId={0} type="output" label="TRIG" />
                <Port moduleId={id} portId={1} type="output" label="INT" />
                <Port moduleId={id} portId={2} type="output" label="RATE" />
            </div>
        </div>
    );
};

export default LISModule;

