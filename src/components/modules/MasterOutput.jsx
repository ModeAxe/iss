import React, { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Power, Volume2 } from 'lucide-react';
import Port from './Port';

const MasterOutput = () => {
    const [volume, setVolume] = useState(0); // dB
    const [isMuted, setIsMuted] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const [level, setLevel] = useState(-60);
    const requestRef = React.useRef();

    const animate = () => {
        if (audioEngine.meter) {
            const val = audioEngine.meter.getValue();
            // Tone.Meter returns decibels. Clip to -60 -> 0 range for display
            setLevel(val);
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    useEffect(() => {
        // Sync initial volume
        audioEngine.masterGain.gain.value = Tone.dbToGain(volume);

        // Register Master as a module so we can connect to it
        // We use a fixed ID 'master' for now
        audioEngine.registerModule('master', audioEngine.masterGain);

        return () => {
            audioEngine.unregisterModule('master');
        }
    }, []);

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (!isMuted) {
            audioEngine.masterGain.gain.rampTo(Tone.dbToGain(val), 0.1);
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (!isMuted) {
            audioEngine.masterGain.gain.rampTo(0, 0.1);
        } else {
            audioEngine.masterGain.gain.rampTo(Tone.dbToGain(volume), 0.1);
        }
    };

    const startAudio = async () => {
        await audioEngine.start();
        setIsStarted(true);
    };

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-48 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2 drag-handle cursor-move">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Master Out</h3>
                <div className={`w-2 h-2 rounded-full ${isStarted ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
            </div>

            {/* Input Port */}
            <div className="absolute -left-3 top-16">
                <Port moduleId="master" portId={0} type="input" label="IN" />
            </div>

            <div className="flex flex-col gap-4 ml-4">
                {!isStarted && (
                    <button
                        onClick={startAudio}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
                    >
                        <Power size={14} />
                        INIT SYSTEM
                    </button>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                        <Volume2 size={14} />
                        <span>{volume.toFixed(1)} dB</span>
                    </div>
                    <input
                        type="range"
                        min="-60"
                        max="6"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <button
                    onClick={toggleMute}
                    className={`text-xs font-bold py-1 px-2 rounded border ${isMuted ? 'bg-red-900/50 border-red-500 text-red-500' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'}`}
                >
                    {isMuted ? 'MUTED' : 'MUTE'}
                </button>
            </div>

            {/* Visualizer */}
            <div className="mt-4 h-12 bg-black rounded border border-slate-700 relative overflow-hidden flex items-end gap-0.5 px-1 pb-1">
                {/* Simple VU Meter Bar */}
                <div
                    className="w-full bg-green-500 transition-all duration-75 ease-out"
                    style={{
                        height: `${Math.max(0, Math.min(100, (level + 60) / 60 * 100))}%`,
                        backgroundColor: level > -3 ? '#ef4444' : level > -12 ? '#fbbf24' : '#22c55e'
                    }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600 mix-blend-difference pointer-events-none">
                    {level.toFixed(0)} dB
                </div>
            </div>
        </div>
    );
};

export default MasterOutput;
