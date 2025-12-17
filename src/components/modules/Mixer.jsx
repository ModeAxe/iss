import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Sliders } from 'lucide-react';
import { useSynthStore } from '../../store/useSynthStore';
import Port from './Port';

const Mixer = ({ id }) => {
    const [levels, setLevels] = useState([0.8, 0.8, 0.8, 0.8]);
    const channelGainsRef = useRef([]);
    const outputGainRef = useRef(null);

    useEffect(() => {
        // Create audio graph
        const outputGain = new Tone.Gain(1);
        outputGainRef.current = outputGain;

        const channelGains = [];
        for (let i = 0; i < 4; i++) {
            const g = new Tone.Gain(0.8);
            g.connect(outputGain);
            channelGains.push(g);
        }
        channelGainsRef.current = channelGains;

        // Register with AudioEngine
        const moduleObj = {
            getInput: (portIndex) => {
                if (portIndex >= 0 && portIndex < 4) {
                    return channelGains[portIndex];
                }
                return null;
            },
            connect: (dest, outPort, inPort) => {
                if (outPort === 0) {
                    outputGain.connect(dest, 0, inPort);
                }
            },
            disconnect: (dest) => {
                outputGain.disconnect(dest);
            },
            dispose: () => {
                channelGains.forEach(g => g.dispose());
                outputGain.dispose();
            }
        };

        audioEngine.registerModule(id, moduleObj);

        return () => {
            moduleObj.dispose();
            audioEngine.unregisterModule(id);
        };
    }, []);

    // Update gains when state changes
    useEffect(() => {
        levels.forEach((level, i) => {
            if (channelGainsRef.current[i]) {
                channelGainsRef.current[i].gain.rampTo(level, 0.1);
            }
        });
    }, [levels]);

    const handleLevelChange = (index, val) => {
        const newLevels = [...levels];
        newLevels[index] = parseFloat(val);
        setLevels(newLevels);
    };

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-48 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2 drag-handle cursor-move">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">MIXER-4</h3>
                <Sliders size={14} className="text-slate-400" />
            </div>

            <div className="flex justify-between gap-2 mb-6">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <div className="relative h-24 w-8 bg-slate-900 rounded-lg p-1">
                            <input
                                type="range"
                                orient="vertical"
                                min="0"
                                max="1"
                                step="0.01"
                                value={levels[i]}
                                onChange={(e) => handleLevelChange(i, e.target.value)}
                                className="w-full h-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-sm"
                                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
                            />
                        </div>
                        <div className="z-20">
                            <Port moduleId={id} portId={i} type="input" label={`CH${i + 1}`} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center pt-6 border-t border-slate-700">
                <Port moduleId={id} portId={0} type="output" label="MIX OUT" />
            </div>
        </div>
    );
};

export default Mixer;
