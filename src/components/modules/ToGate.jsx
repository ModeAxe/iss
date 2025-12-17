import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Zap } from 'lucide-react';
import Port from './Port';

const ToGate = ({ id }) => {
    const [gateLength, setGateLength] = useState(0.1); // Gate duration in seconds
    const [isGateActive, setIsGateActive] = useState(false);

    const inputSignalRef = useRef(null);
    const outputSignalRef = useRef(null);
    const lastValueRef = useRef(0);
    const gateTimeoutRef = useRef(null);
    const gateLengthRef = useRef(0.1);

    // Update ref when state changes
    useEffect(() => {
        gateLengthRef.current = gateLength;
    }, [gateLength]);

    useEffect(() => {
        // Create input and output signals
        const inputSignal = new Tone.Signal(0);
        const outputSignal = new Tone.Signal(0);

        // Use an Analyser to read the input signal value
        const analyser = new Tone.Analyser('waveform', 32);
        inputSignal.connect(analyser);

        inputSignalRef.current = inputSignal;
        outputSignalRef.current = outputSignal;

        // Poll the analyser for changes
        const checkInterval = setInterval(() => {
            const waveform = analyser.getValue();
            // Get the average value from the waveform
            const currentValue = waveform.reduce((sum, val) => sum + val, 0) / waveform.length;
            // Normalize from -1..1 to 0..1
            const normalizedValue = (currentValue + 1) / 2;

            const lastValue = lastValueRef.current;
            const change = Math.abs(normalizedValue - lastValue);

            // Fire on ANY change (no threshold)
            if (change > 0 && lastValue !== 0) {
                // Trigger gate
                outputSignal.value = 1;
                setIsGateActive(true);

                // Clear any existing timeout
                if (gateTimeoutRef.current) {
                    clearTimeout(gateTimeoutRef.current);
                }

                // Schedule gate off
                gateTimeoutRef.current = setTimeout(() => {
                    outputSignal.value = 0;
                    setIsGateActive(false);
                }, gateLengthRef.current * 1000);
            }

            lastValueRef.current = normalizedValue;
        }, 50); // Check every 50ms

        // Register with AudioEngine
        const moduleObj = {
            getInput: (portIndex) => {
                if (portIndex === 0) return inputSignal;
                return null;
            },
            connect: (dest, outPort, inPort) => {
                if (outPort === 0) {
                    outputSignal.connect(dest, 0, inPort);
                }
            },
            disconnect: (dest) => {
                outputSignal.disconnect(dest);
            },
            dispose: () => {
                clearInterval(checkInterval);
                if (gateTimeoutRef.current) {
                    clearTimeout(gateTimeoutRef.current);
                }
                analyser.dispose();
                inputSignal.dispose();
                outputSignal.dispose();
            }
        };

        audioEngine.registerModule(id, moduleObj);

        return () => {
            moduleObj.dispose();
            audioEngine.unregisterModule(id);
        };
    }, []); // No dependencies - only run once

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-48 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2 drag-handle cursor-move">
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400">TO GATE</h3>
                <Zap size={14} className={`transition-colors ${isGateActive ? 'text-emerald-400' : 'text-slate-600'}`} />
            </div>

            <div className="flex flex-col gap-4">
                {/* Gate Length */}
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase">Gate Length</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0.01"
                            max="1"
                            step="0.01"
                            value={gateLength}
                            onChange={(e) => setGateLength(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-xs w-12 text-right">{(gateLength * 1000).toFixed(0)}ms</span>
                    </div>
                </div>

                {/* Visual indicator */}
                <div className="h-8 bg-slate-900 rounded border border-slate-700 flex items-center justify-center">
                    <div
                        className={`w-4 h-4 rounded-full transition-all duration-75 ${isGateActive ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-slate-700'
                            }`}
                    />
                </div>
            </div>

            {/* Ports */}
            <div className="flex justify-between items-end mt-4">
                <Port moduleId={id} portId={0} type="input" label="IN" />
                <Port moduleId={id} portId={0} type="output" label="GATE" />
            </div>
        </div>
    );
};

export default ToGate;
