import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const useSynthStore = create((set, get) => ({
    modules: [],
    connections: [],
    isDraggingCable: false,
    dragStart: null, // { moduleId, portId, x, y }
    dragCurrent: null, // { x, y }
    portPositions: {}, // { [moduleId-portId]: { x, y, type } }

    // Module Actions
    addModule: (type, x = 100, y = 100) => {
        const id = uuidv4();
        set((state) => ({
            modules: [...state.modules, { id, type, x, y, data: {} }]
        }));
        return id;
    },

    removeModule: (id) => {
        set((state) => ({
            modules: state.modules.filter((m) => m.id !== id),
            connections: state.connections.filter((c) => c.fromModule !== id && c.toModule !== id)
        }));
    },

    updateModulePosition: (id, x, y) => {
        set((state) => ({
            modules: state.modules.map((m) =>
                m.id === id ? { ...m, x, y } : m
            )
        }));
    },

    updateModuleData: (id, data) => {
        set((state) => ({
            modules: state.modules.map((m) =>
                m.id === id ? { ...m, data: { ...m.data, ...data } } : m
            )
        }));
    },

    // Connection Actions
    addConnection: (fromModule, fromPort, toModule, toPort) => {
        // Prevent duplicate connections
        const exists = get().connections.some(c =>
            c.fromModule === fromModule && c.fromPort === fromPort &&
            c.toModule === toModule && c.toPort === toPort
        );
        if (exists) return;

        set((state) => ({
            connections: [...state.connections, {
                id: uuidv4(),
                fromModule, fromPort,
                toModule, toPort
            }]
        }));
    },

    removeConnection: (id) => {
        set((state) => ({
            connections: state.connections.filter((c) => c.id !== id)
        }));
    },

    // Cable Dragging Actions
    updatePortPosition: (moduleId, portId, type, rect) => {
        // We store the center point of the port
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const key = `${moduleId}-${type}-${portId}`;

        set(state => ({
            portPositions: {
                ...state.portPositions,
                [key]: { x, y, type, moduleId, portId }
            }
        }));
    },

    startCable: (moduleId, portId, startPos) => {
        set({
            isDraggingCable: true,
            dragStart: { moduleId, portId, ...startPos },
            dragCurrent: startPos
        });
    },

    updateDrag: (pos) => {
        set({ dragCurrent: pos });
    },

    endCable: (toModuleId, toPortId) => {
        const state = get();
        if (!state.isDraggingCable) return;

        const { moduleId: fromModule, portId: fromPort } = state.dragStart;

        // Don't connect to self or same module (usually)
        if (fromModule === toModuleId) {
            set({ isDraggingCable: false, dragStart: null, dragCurrent: null });
            return;
        }

        // Create connection
        get().addConnection(fromModule, fromPort, toModuleId, toPortId);
        set({ isDraggingCable: false, dragStart: null, dragCurrent: null });
    },

    cancelCable: () => {
        set({ isDraggingCable: false, dragStart: null, dragCurrent: null });
    }
}));
