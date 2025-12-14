import React, { useRef, useEffect } from 'react';
import { useSynthStore } from '../../store/useSynthStore';

const Port = ({ moduleId, portId, type = 'input', label }) => {
    const ref = useRef(null);
    const startCable = useSynthStore(state => state.startCable);
    const endCable = useSynthStore(state => state.endCable);
    const updatePortPosition = useSynthStore(state => state.updatePortPosition);

    // Update port position in store on mount/resize
    useEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Store absolute position relative to the Rack container (which we'll need to calculate)
            // For now, we'll just fire an event or let the Rack handle polling positions
            // Actually, simpler: let's just register the port in the store
            updatePortPosition(moduleId, portId, type, rect);
        }
    }, []);

    const handleMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (type === 'output') {
            const rect = ref.current.getBoundingClientRect();
            // Calculate center point
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Update store with this port's position immediately to ensure it's fresh
            updatePortPosition(moduleId, portId, type, rect);

            startCable(moduleId, portId, { x, y });
        }
    };

    const handleMouseUp = (e) => {
        e.stopPropagation();
        if (type === 'input') {
            const rect = ref.current.getBoundingClientRect();
            updatePortPosition(moduleId, portId, type, rect);
            endCable(moduleId, portId);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Find all connections to/from this port
        const connections = useSynthStore.getState().connections.filter(c =>
            (c.fromModule === moduleId && c.fromPort === portId) ||
            (c.toModule === moduleId && c.toPort === portId)
        );

        connections.forEach(c => {
            useSynthStore.getState().removeConnection(c.id);
            // We need to access the engine to disconnect.
            // Ideally the store would handle this side effect or the Rack would observe it.
            // But since we are inside a component, we can import the engine.
            // Note: This creates a tight coupling. In a larger app, use a middleware.
            import('../../engine/AudioEngine').then(({ audioEngine }) => {
                audioEngine.disconnect(c.fromModule, c.toModule);
            });
        });
    };

    return (
        <div className="flex flex-col items-center gap-1">
            {label && <span className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</span>}
            <div
                ref={ref}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-crosshair hover:scale-110 transition-transform
          ${type === 'input' ? 'bg-slate-900 border-slate-500' : 'bg-slate-300 border-slate-500'}
        `}
            >
                <div className={`w-2 h-2 rounded-full ${type === 'input' ? 'bg-slate-600' : 'bg-black'}`}></div>
            </div>
        </div>
    );
};

export default Port;
