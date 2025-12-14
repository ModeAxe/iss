import { create } from 'zustand';

// Normalization ranges based on ISS typical orbit
const RANGES = {
    altitude: { min: 410, max: 430 }, // km
    velocity: { min: 27500, max: 27700 }, // km/h
    latitude: { min: -52, max: 52 },
    longitude: { min: -180, max: 180 }
};

const normalize = (val, min, max) => {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
};

export const useISSData = create((set, get) => ({
    rawData: {
        latitude: 0,
        longitude: 0,
        altitude: 0,
        velocity: 0,
        visibility: 'daylight'
    },
    normalizedData: {
        latitude: 0.5,
        longitude: 0.5,
        altitude: 0.5,
        velocity: 0.5
    },
    isPolling: false,
    error: null,

    startPolling: () => {
        if (get().isPolling) return;
        set({ isPolling: true });

        const poll = async () => {
            if (!get().isPolling) return;

            try {
                const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
                if (!response.ok) throw new Error('API Error');

                const data = await response.json();

                set({
                    rawData: data,
                    normalizedData: {
                        latitude: normalize(data.latitude, RANGES.latitude.min, RANGES.latitude.max),
                        longitude: normalize(data.longitude, RANGES.longitude.min, RANGES.longitude.max),
                        altitude: normalize(data.altitude, RANGES.altitude.min, RANGES.altitude.max),
                        velocity: normalize(data.velocity, RANGES.velocity.min, RANGES.velocity.max)
                    },
                    error: null
                });
                console.log('[ISSData] Updated:', data.altitude, '->', normalize(data.altitude, RANGES.altitude.min, RANGES.altitude.max));
            } catch (err) {
                console.error('ISS Fetch Error:', err);
                set({ error: err.message });
            }

            // Poll every 2 seconds (API rate limit is ~1/sec)
            setTimeout(poll, 2000);
        };

        poll();
    },

    stopPolling: () => {
        set({ isPolling: false });
    }
}));
