import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.nodes = new Map(); // Map<ModuleID, Tone.AudioNode>
        this.connections = [];
        this.isStarted = false;

        // Master Output Chain
        this.masterGain = new Tone.Gain(0.8).toDestination();
        this.limiter = new Tone.Limiter(-1).connect(this.masterGain);

        // Analysis
        this.meter = new Tone.Meter();
        this.masterGain.connect(this.meter);
    }

    async start() {
        if (!this.isStarted) {
            await Tone.start();
            this.isStarted = true;
            console.log('Audio Engine Started');
        }
    }

    registerModule(id, node) {
        console.log(`[AudioEngine] Registering module: ${id}`);
        this.nodes.set(id, node);
    }

    unregisterModule(id) {
        console.log(`[AudioEngine] Unregistering module: ${id}`);
        const node = this.nodes.get(id);
        if (node) {
            node.dispose();
            this.nodes.delete(id);
        }
    }

    connect(fromId, toId, fromPort = 0, toPort = 0) {
        const source = this.nodes.get(fromId);
        const dest = this.nodes.get(toId);

        console.log(`[AudioEngine] Connecting ${fromId}:${fromPort} -> ${toId}:${toPort}`);

        if (source && dest) {
            try {
                // Handle Custom Module Objects (like ISSNavModule)
                // If source has a custom connect method, use it
                if (source.connect && typeof source.connect === 'function' && source.isCustom) {
                    source.connect(dest, fromPort, toPort);
                    return;
                }

                // Handle Destination Inputs
                // If dest is a custom object with inputs array or getInput method
                let actualDest = dest;
                let destInputIndex = toPort;

                if (dest.getInput) {
                    actualDest = dest.getInput(toPort);
                    destInputIndex = 0; // We resolved the node, so connect to its 0 input
                }

                console.log(`[AudioEngine] Resolved destination:`, actualDest);
                if (actualDest && actualDest.toString) {
                    console.log(`[AudioEngine] Dest Type: ${actualDest.toString()}`);
                }

                // Tone.js connect
                source.connect(actualDest, fromPort, destInputIndex);
                console.log(`[AudioEngine] Connected successfully`);
            } catch (e) {
                console.error(`[AudioEngine] Connection failed:`, e);
            }
        } else {
            console.warn(`[AudioEngine] Missing nodes for connection: Source=${!!source}, Dest=${!!dest}`);
        }
    }

    disconnect(fromId, toId) {
        const source = this.nodes.get(fromId);
        const dest = this.nodes.get(toId);

        if (source && dest) {
            source.disconnect(dest);
        }
    }

    getMasterNode() {
        return this.limiter;
    }
}

export const audioEngine = new AudioEngine();
