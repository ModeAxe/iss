import { create } from 'zustand';

// Lightning data ranges for normalization
const RANGES = {
    intensity: { min: 0, max: 200 }, // kA (kiloamperes) - typical range
    strikesPerMinute: { min: 0, max: 100 }, // strikes per minute
};

const normalize = (val, min, max) => {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
};

// Simulate lightning strikes based on realistic patterns
// Lightning is more common in tropical regions and during certain times
const simulateLightning = () => {
    // Base probability of a strike (higher in tropical regions)
    const baseProbability = 0.3; // 30% chance per check interval
    const hasStrike = Math.random() < baseProbability;
    
    if (!hasStrike) {
        return null;
    }
    
    // Generate realistic lightning parameters
    const intensity = 10 + Math.random() * 190; // 10-200 kA
    const timestamp = Date.now();
    
    return {
        intensity,
        timestamp,
        latitude: -30 + Math.random() * 60, // Tropical/subtropical range
        longitude: -180 + Math.random() * 360,
    };
};

export const useLISData = create((set, get) => ({
    // Raw data
    rawData: {
        lastStrike: null,
        strikesLastMinute: 0,
        averageIntensity: 0,
        totalStrikes: 0,
    },
    
    // Normalized data for CV outputs
    normalizedData: {
        intensity: 0,
        strikeRate: 0,
    },
    
    // Strike history for visualization (last 10 strikes)
    strikeHistory: [],
    
    // State
    isPolling: false,
    dataMode: 'simulation', // 'simulation' | 'api' | 'error'
    error: null,
    
    // Strike event callbacks (for trigger outputs)
    strikeCallbacks: new Set(),
    
    // Register a callback for strike events
    onStrike: (callback) => {
        const callbacks = get().strikeCallbacks;
        callbacks.add(callback);
        return () => callbacks.delete(callback);
    },
    
    startPolling: () => {
        if (get().isPolling) return;
        set({ isPolling: true, dataMode: 'simulation' });
        
        let strikesInLastMinute = [];
        let lastApiAttempt = 0;
        const API_RETRY_INTERVAL = 60000; // Try API every 60 seconds
        
        const poll = async () => {
            if (!get().isPolling) return;
            
            const now = Date.now();
            
            // Try to fetch from public API (if available) periodically
            if (now - lastApiAttempt > API_RETRY_INTERVAL) {
                lastApiAttempt = now;
                
                // Attempt to fetch from a public source
                // For now, we'll use simulation, but this is where we'd add real API calls
                // Example: try fetching from a public weather API or lightning network
                try {
                    // Placeholder for future API integration
                    // const response = await fetch('...');
                    // if (response.ok) { ... }
                } catch (err) {
                    console.log('[LIS] API unavailable, using simulation');
                }
            }
            
            // Generate simulated lightning strike
            const strike = simulateLightning();
            
            if (strike) {
                // Update strike history (keep last 10)
                const history = [...get().strikeHistory, strike].slice(-10);
                
                // Update last minute window
                strikesInLastMinute = strikesInLastMinute.filter(
                    s => now - s.timestamp < 60000
                );
                strikesInLastMinute.push(strike);
                
                const strikesLastMinute = strikesInLastMinute.length;
                const averageIntensity = strikesInLastMinute.reduce(
                    (sum, s) => sum + s.intensity, 0
                ) / strikesLastMinute || 0;
                
                const rawData = {
                    lastStrike: strike,
                    strikesLastMinute,
                    averageIntensity,
                    totalStrikes: get().rawData.totalStrikes + 1,
                };
                
                const normalizedData = {
                    intensity: normalize(averageIntensity, RANGES.intensity.min, RANGES.intensity.max),
                    strikeRate: normalize(strikesLastMinute, RANGES.strikesPerMinute.min, RANGES.strikesPerMinute.max),
                };
                
                set({
                    rawData,
                    normalizedData,
                    strikeHistory: history,
                    error: null,
                });
                
                // Trigger callbacks for gate/trigger outputs
                const callbacks = get().strikeCallbacks;
                callbacks.forEach(cb => {
                    try {
                        cb(strike);
                    } catch (err) {
                        console.error('[LIS] Strike callback error:', err);
                    }
                });
            } else {
                // No strike, but update normalized data based on decay
                const currentData = get().normalizedData;
                set({
                    normalizedData: {
                        intensity: currentData.intensity * 0.95, // Decay
                        strikeRate: normalize(strikesInLastMinute.length, RANGES.strikesPerMinute.min, RANGES.strikesPerMinute.max),
                    },
                });
            }
            
            // Poll every 2 seconds (simulation rate)
            setTimeout(poll, 2000);
        };
        
        poll();
    },
    
    stopPolling: () => {
        set({ isPolling: false });
    },
}));

