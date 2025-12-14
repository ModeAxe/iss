import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Activity } from 'lucide-react';
import { useSynthStore } from '../../store/useSynthStore';
import Port from './Port';

const Oscillator = ({ id, data }) => {
    const [freq, setFreq] = useState(440);
    const [type, setType] = useState('sine');
    const [fmAmount, setFmAmount] = useState(0);

    const oscRef = useRef(null);
    const fmGainRef = useRef(null);
    const updateModuleData = useSynthStore(state => state.updateModuleData);

    useEffect(() => {
        // Initialize Tone.js Oscillator
        const osc = new Tone.Oscillator(freq, type).start();
        oscRef.current = osc;

        // FM Gain (CV -> Frequency)
        // Scale 0-1 input to 0-1000Hz modulation depth
        const fmGain = new Tone.Gain(0);
        fmGain.connect(osc.frequency);
        fmGainRef.current = fmGain;

        // Register with AudioEngine as custom object
        const moduleObj = {
            getInput: (portIndex) => {
                if (portIndex === 1) return fmGain; // Port 1 is FM
                return null;
            },
            connect: (dest, outPort, inPort) => {
                osc.connect(dest, outPort, inPort);
            },
            dispose: () => {
                osc.dispose();
                fmGain.dispose();
            }
        };

        audioEngine.registerModule(id, moduleObj);

        // Cleanup
        return () => {
            osc.stop();
            moduleObj.dispose();
            audioEngine.unregisterModule(id);
        };
    }, []);

    useEffect(() => {
        if (oscRef.current) {
            oscRef.current.frequency.rampTo(freq, 0.1);
            updateModuleData(id, { frequency: freq });
        }
    }, [freq]);

    useEffect(() => {
        if (oscRef.current) {
            oscRef.current.type = type;
            updateModuleData(id, { type });
        }
    }, [type]);

    useEffect(() => {
        if (fmGainRef.current) {
            // FM Amount controls the gain of the modulation signal
            // Increased max modulation to +/- 5000Hz to make subtle data changes audible
            fmGainRef.current.gain.rampTo(fmAmount * 5000, 0.1);
        }
    }, [fmAmount]);

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-48 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">VCO-1</h3>
                <Activity size={14} className="text-amber-500" />
            </div>

            <div className="flex flex-col gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase">Frequency</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="20"
                            max="2000"
                            value={freq}
                            onChange={(e) => setFreq(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className="text-xs w-12 text-right">{freq}Hz</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase">Waveform</label>
                    <div className="flex gap-1">
                        {['sine', 'square', 'sawtooth', 'triangle'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setType(t)}
                                className={`w-8 h-8 rounded flex items-center justify-center border ${type === t ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                title={t}
                            >
                                {t === 'sine' && '~'}
                                {t === 'square' && '∏'}
                                {t === 'sawtooth' && 'N'}
                                {t === 'triangle' && 'Λ'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* FM Amount */}
                <div className="space-y-2 pt-2 border-t border-slate-700">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-400 uppercase">FM Amount</label>
                        <span className="text-[9px] text-amber-500">{(fmAmount * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={fmAmount}
                        onChange={(e) => setFmAmount(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
            </div>

            {/* Ports */}
            <div className="flex justify-between items-end mt-4">
                <Port moduleId={id} portId={1} type="input" label="FM" />
                <Port moduleId={id} portId={0} type="output" label="OUT" />
            </div>
        </div>
    );
};

export default Oscillator;
