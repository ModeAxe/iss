import React, { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../engine/AudioEngine';
import { Globe, Satellite } from 'lucide-react';
import { useISSData } from '../../services/ISSDataService';
import Port from './Port';

const ISSNavModule = ({ id }) => {
    const { rawData, normalizedData, startPolling, stopPolling, isPolling } = useISSData();

    // Refs for Tone.Signals
    const signalsRef = useRef({
        lat: new Tone.Signal(0),
        lon: new Tone.Signal(0),
        alt: new Tone.Signal(0),
        vel: new Tone.Signal(0)
    });

    useEffect(() => {
        startPolling();

        // Register signals with AudioEngine
        // We need a way to distinguish ports. 
        // Convention: id + portIndex? Or custom naming?
        // The AudioEngine's connect method takes (fromId, toId, fromPort, toPort).
        // Tone.js nodes often have multiple inputs/outputs.
        // Signals are simple 1-in-1-out nodes.
        // We might need a "Splitter" or just register them as sub-nodes?
        // SIMPLIFICATION: For this MVP, let's register the module as a "MultiOutput" container?
        // Actually, Tone.js `connect` handles output indices.
        // But we have 4 distinct signals, not one node with 4 outputs.
        // We need a custom "ModuleNode" wrapper in AudioEngine or just register them individually?

        // Let's try registering them as "id-portIndex" in the engine?
        // No, the engine expects `nodes.get(moduleId)`.

        // Better approach: Create a dummy "Merger" or just an object that holds the signals?
        // AudioEngine.connect needs to handle this.
        // Let's update AudioEngine to handle a "Module Object" that has `.outputs[]`?

        // For now, let's hack it:
        // We will register 4 separate "virtual modules" in the engine for patching purposes?
        // OR, we update AudioEngine to support a `getOutput(moduleId, portIndex)` method.

        // Let's stick to the plan: The module registers itself.
        // But wait, `osc.connect(dest)` works.
        // `signal.connect(dest)` works.
        // If I have 4 signals, I can't return just one node.

        // WORKAROUND: We will register a special object in AudioEngine.
        const signals = signalsRef.current;

        // We'll modify AudioEngine to handle this, but for now let's assume 
        // we can register an object with a `connect` method that delegates based on port?
        const compositeNode = {
            isCustom: true,
            connect: (dest, outputNum, inputNum) => {
                console.log(`[ISSNavModule] Connecting output ${outputNum} to`, dest, `input: ${inputNum}`);
                try {
                    // Resolve the actual destination node
                    let actualDest = dest;
                    let destInputIndex = inputNum;

                    if (dest.getInput) {
                        actualDest = dest.getInput(inputNum);
                        destInputIndex = 0; // We resolved the specific node, so connect to its 0 input
                    }

                    if (!actualDest) {
                        console.error('[ISSNavModule] Could not resolve destination node');
                        return;
                    }

                    // Map outputNum to specific signal
                    switch (outputNum) {
                        case 0: signals.alt.connect(actualDest, 0, destInputIndex); break;
                        case 1: signals.vel.connect(actualDest, 0, destInputIndex); break;
                        case 2: signals.lat.connect(actualDest, 0, destInputIndex); break;
                        case 3: signals.lon.connect(actualDest, 0, destInputIndex); break;
                    }
                } catch (err) {
                    console.error('[ISSNavModule] Connect Error:', err);
                }
            },
            disconnect: (dest) => {
                signals.alt.disconnect(dest);
                signals.vel.disconnect(dest);
                signals.lat.disconnect(dest);
                signals.lon.disconnect(dest);
            },
            dispose: () => {
                signals.alt.dispose();
                signals.vel.dispose();
                signals.lat.dispose();
                signals.lon.dispose();
            }
        };

        audioEngine.registerModule(id, compositeNode);

        return () => {
            stopPolling();
            audioEngine.unregisterModule(id);
        };
    }, []);

    const [testMode, setTestMode] = React.useState(false);
    const [mode, setMode] = React.useState('raw');
    const zoomBaseline = useRef({ alt: 0.5, vel: 0.5, lat: 0.5, lon: 0.5 });
    const lfoRef = useRef(null);

    useEffect(() => {
        // Create a test LFO for debugging connections
        const lfo = new Tone.LFO(0.5, 0, 1).start();
        lfoRef.current = lfo;

        return () => {
            lfo.dispose();
        };
    }, []);

    // Update signals when data changes or test mode toggles
    useEffect(() => {
        const sigs = signalsRef.current;

        if (testMode) {
            if (lfoRef.current) {
                sigs.alt.overridden = true;
                lfoRef.current.connect(sigs.alt);
                lfoRef.current.connect(sigs.vel);
                lfoRef.current.connect(sigs.lat);
                lfoRef.current.connect(sigs.lon);
            }
        } else {
            // Disconnect LFO if connected
            if (lfoRef.current) {
                try {
                    lfoRef.current.disconnect(sigs.alt);
                    lfoRef.current.disconnect(sigs.vel);
                    lfoRef.current.disconnect(sigs.lat);
                    lfoRef.current.disconnect(sigs.lon);
                } catch (e) { /* ignore if already disconnected */ }
            }

            sigs.alt.overridden = false;

            if (mode === 'raw') {
                sigs.alt.rampTo(normalizedData.altitude, 1);
                sigs.vel.rampTo(normalizedData.velocity, 1);
                sigs.lat.rampTo(normalizedData.latitude, 1);
                sigs.lon.rampTo(normalizedData.longitude, 1);
            } else if (mode === 'zoom') {
                // Zoom mode: Amplify changes relative to baseline
                // Gain factor of 50 means a 2% change becomes full scale
                const gain = 50;

                const processZoom = (val, baseline) => {
                    // Center around 0.5
                    let zoomed = (val - baseline) * gain + 0.5;
                    // Clamp to 0-1
                    return Math.max(0, Math.min(1, zoomed));
                };

                sigs.alt.rampTo(processZoom(normalizedData.altitude, zoomBaseline.current.alt), 1);
                sigs.vel.rampTo(processZoom(normalizedData.velocity, zoomBaseline.current.vel), 1);
                sigs.lat.rampTo(processZoom(normalizedData.latitude, zoomBaseline.current.lat), 1);
                sigs.lon.rampTo(processZoom(normalizedData.longitude, zoomBaseline.current.lon), 1);
            }
        }
    }, [testMode, normalizedData, mode]);

    // Capture baseline when entering zoom mode
    useEffect(() => {
        if (mode === 'zoom') {
            zoomBaseline.current = {
                alt: normalizedData.altitude,
                vel: normalizedData.velocity,
                lat: normalizedData.latitude,
                lon: normalizedData.longitude
            };
        }
    }, [mode, normalizedData]);

    return (
        <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-4 w-64 shadow-xl text-slate-200 font-mono relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2 drag-handle cursor-move">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">NAV / TELEMETRY</h3>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-900 rounded border border-slate-600 overflow-hidden">
                        <button
                            onClick={() => setMode('raw')}
                            className={`text-[9px] px-1.5 py-0.5 ${mode === 'raw' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            RAW
                        </button>
                        <button
                            onClick={() => setMode('zoom')}
                            className={`text-[9px] px-1.5 py-0.5 ${mode === 'zoom' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Amplify changes (50x)"
                        >
                            ZOOM
                        </button>
                    </div>
                    <button
                        onClick={() => setTestMode(!testMode)}
                        className={`text-[9px] px-1 rounded border ${testMode ? 'bg-red-500 border-red-500 text-white' : 'border-slate-600 text-slate-500'}`}
                    >
                        TEST
                    </button>
                    <Globe size={14} className={`text-blue-400 ${isPolling ? 'animate-spin-slow' : ''}`} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Altitude</label>
                    <div className="text-sm text-amber-500 font-bold">{rawData.altitude.toFixed(2)} <span className="text-[9px]">km</span></div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Velocity</label>
                    <div className="text-sm text-amber-500 font-bold">{rawData.velocity.toFixed(0)} <span className="text-[9px]">km/h</span></div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Latitude</label>
                    <div className="text-xs text-slate-300">{rawData.latitude.toFixed(4)}°</div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Longitude</label>
                    <div className="text-xs text-slate-300">{rawData.longitude.toFixed(4)}°</div>
                </div>
            </div>

            {/* Outputs */}
            <div className="flex justify-between items-end pt-2 border-t border-slate-700">
                <Port moduleId={id} portId={0} type="output" label="ALT" />
                <Port moduleId={id} portId={1} type="output" label="VEL" />
                <Port moduleId={id} portId={2} type="output" label="LAT" />
                <Port moduleId={id} portId={3} type="output" label="LON" />
            </div>
        </div>
    );
};

export default ISSNavModule;
