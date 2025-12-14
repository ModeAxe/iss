import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Radio, Activity } from 'lucide-react';
import { useRadiationData } from '../../services/SpaceWeatherService';
import Port from './Port';

const RadiationDetectorModule = ({ id }) => {
    const { 
        rawData, 
        normalizedData, 
        startPolling, 
        stopPolling, 
        isPolling,
        dataMode,
        error 
    } = useRadiationData();

    // Refs for Tone.Signals
    const signalsRef = useRef({
        radiation: new Tone.Signal(0), // Radiation level CV
    });

    // State for visual feedback
    const [pulseActive, setPulseActive] = useState(false);

    useEffect(() => {
        startPolling();

        // Register signals with AudioEngine
        const signals = signalsRef.current;

        const compositeNode = {
            isCustom: true,
            connect: (dest, outputNum, inputNum) => {
                console.log(`[RadiationDetectorModule] Connecting output ${outputNum} to`, dest, `input: ${inputNum}`);
                try {
                    // Resolve the actual destination node
                    let actualDest = dest;
                    let destInputIndex = inputNum;

                    if (dest.getInput) {
                        actualDest = dest.getInput(inputNum);
                        destInputIndex = 0;
                    }

                    if (!actualDest) {
                        console.error('[RadiationDetectorModule] Could not resolve destination node');
                        return;
                    }

                    // Map outputNum to specific signal
                    switch (outputNum) {
                        case 0: signals.radiation.connect(actualDest, 0, destInputIndex); break;
                    }
                } catch (err) {
                    console.error('[RadiationDetectorModule] Connect Error:', err);
                }
            },
            disconnect: (dest) => {
                signals.radiation.disconnect(dest);
            },
            dispose: () => {
                signals.radiation.dispose();
            }
        };

        audioEngine.registerModule(id, compositeNode);

        return () => {
            stopPolling();
            audioEngine.unregisterModule(id);
        };
    }, []);

    // Update signals when normalized data changes
    useEffect(() => {
        const sigs = signalsRef.current;
        sigs.radiation.rampTo(normalizedData.radiation, 0.5);
        
        // Visual pulse on significant changes
        if (normalizedData.radiation > 0.5) {
            setPulseActive(true);
            setTimeout(() => setPulseActive(false), 200);
        }
    }, [normalizedData]);

    // Alert level color mapping
    const getAlertColor = (level) => {
        switch (level) {
            case 'normal': return 'text-green-400';
            case 'elevated': return 'text-yellow-400';
            case 'high': return 'text-orange-400';
            case 'severe': return 'text-red-600';
            default: return 'text-slate-400';
        }
    };

    const getAlertBgColor = (level) => {
        switch (level) {
            case 'normal': return 'bg-green-400/20';
            case 'elevated': return 'bg-yellow-400/20';
            case 'high': return 'bg-orange-400/20';
            case 'severe': return 'bg-red-600/20';
            default: return 'bg-slate-400/20';
        }
    };

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-64 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400">RAD DETECTOR</h3>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    <div className="text-[9px] text-slate-500 uppercase">{dataMode}</div>
                    <Radio 
                        size={14} 
                        className={`transition-all duration-200 ${pulseActive ? 'text-purple-400 scale-125' : 'text-slate-600'}`} 
                    />
                </div>
            </div>

            {/* Radiation Level Display */}
            <div className="mb-4 space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[9px] text-slate-500 uppercase">Radiation Level</label>
                    <span className={`text-xs font-bold ${getAlertColor(rawData.alertLevel)}`}>
                        {rawData.radiationLevel.toFixed(1)}
                    </span>
                </div>
                
                {/* Radiation Meter */}
                <div className="h-8 bg-slate-900 rounded border border-slate-700 flex items-center justify-center relative overflow-hidden">
                    {/* Radiation level bar */}
                    <div 
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${getAlertBgColor(rawData.alertLevel)}`}
                        style={{ width: `${normalizedData.radiation * 100}%` }}
                    />
                    {/* Scale markers */}
                    <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
                        {[0, 3, 6, 9].map((val) => (
                            <div key={val} className="text-[8px] text-slate-600">{val}</div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Alert Level */}
            <div className="mb-4 space-y-1">
                <label className="text-[9px] text-slate-500 uppercase">Alert Level</label>
                <div className={`text-sm font-bold uppercase ${getAlertColor(rawData.alertLevel)}`}>
                    {rawData.alertLevel}
                </div>
            </div>

            {/* Radiation Level Visualization */}
            <div className="mb-4 space-y-2">
                <label className="text-[9px] text-slate-500 uppercase">Radiation Level</label>
                <div className="h-12 bg-slate-900 rounded border border-slate-700 p-1 flex items-end gap-0.5">
                    {/* Radiation bars (like a Geiger counter) */}
                    {Array.from({ length: 10 }).map((_, idx) => {
                        const threshold = idx / 10;
                        const isActive = normalizedData.radiation >= threshold;
                        const intensity = Math.max(0, (normalizedData.radiation - threshold) * 10);
                        
                        return (
                            <div
                                key={idx}
                                className="flex-1 bg-purple-400 rounded-t transition-all duration-300"
                                style={{
                                    height: isActive ? `${intensity * 100}%` : '0%',
                                    opacity: isActive ? 0.5 + intensity * 0.5 : 0.2,
                                }}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Last Update */}
            {rawData.lastUpdate && (
                <div className="mb-4 text-[8px] text-slate-500">
                    Updated: {new Date(rawData.lastUpdate).toLocaleTimeString()}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-2 text-[8px] text-red-400">
                    {error}
                </div>
            )}

            {/* Outputs */}
            <div className="flex justify-center items-end pt-2 border-t border-slate-700">
                <Port moduleId={id} portId={0} type="output" label="RAD" />
            </div>
        </div>
    );
};

export default RadiationDetectorModule;

