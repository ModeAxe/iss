import { create } from 'zustand';

// Space weather data ranges for normalization
const RANGES = {
    kpIndex: { min: 0, max: 9 }, // Kp index range (0-9)
    apIndex: { min: 0, max: 400 }, // Ap index (0-400)
};

const normalize = (val, min, max) => {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
};

// Parse NOAA SWPC text format for Kp index
// NOAA provides Kp data in various formats - we'll try to parse common ones
const parseKpData = (text) => {
    if (!text) return null;
    
    // Try to extract Kp values from text
    // Format varies, but typically contains Kp values
    const kpMatch = text.match(/Kp\s*[=:]\s*(\d+\.?\d*)/i);
    if (kpMatch) {
        return parseFloat(kpMatch[1]);
    }
    
    // Try alternative formats
    const lines = text.split('\n');
    for (const line of lines) {
        const match = line.match(/(\d+\.?\d*)/);
        if (match) {
            const val = parseFloat(match[1]);
            if (val >= 0 && val <= 9) {
                return val;
            }
        }
    }
    
    return null;
};

export const useRadiationData = create((set, get) => ({
    // Raw data - Radiation Detector instrument
    rawData: {
        radiationLevel: 0, // Derived from Kp index (proxy for ISS radiation exposure)
        lastUpdate: null,
        alertLevel: 'normal', // normal, elevated, high, severe
    },
    
    // Normalized data for CV outputs
    normalizedData: {
        radiation: 0, // Radiation level CV (0-1)
    },
    
    // State
    isPolling: false,
    dataMode: 'api', // 'api' | 'fallback' | 'error'
    error: null,
    
    // Calculate alert level from radiation level
    getAlertLevel: (radiation) => {
        if (radiation < 0.3) return 'normal';
        if (radiation < 0.5) return 'elevated';
        if (radiation < 0.7) return 'high';
        return 'severe';
    },
    
    startPolling: () => {
        if (get().isPolling) return;
        set({ isPolling: true, dataMode: 'api' });
        
        let lastApiAttempt = 0;
        const API_RETRY_INTERVAL = 60000; // Try API every 60 seconds
        let consecutiveFailures = 0;
        
        const poll = async () => {
            if (!get().isPolling) return;
            
            const now = Date.now();
            let fetchedData = null;
            
            // Try to fetch from NOAA SWPC (various possible endpoints)
            if (now - lastApiAttempt > API_RETRY_INTERVAL || consecutiveFailures > 3) {
                lastApiAttempt = now;
                
                // Try multiple NOAA SWPC endpoints
                const endpoints = [
                    // NOAA SWPC 3-day forecast (contains current Kp)
                    'https://services.swpc.noaa.gov/text/3-day-forecast.txt',
                    // NOAA SWPC daily report
                    'https://services.swpc.noaa.gov/text/daily.txt',
                    // Alternative: Try JSON if available
                    'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
                ];
                
                for (const endpoint of endpoints) {
                    try {
                        const response = await fetch(endpoint, {
                            method: 'GET',
                            headers: {
                                'Accept': endpoint.includes('json') ? 'application/json' : 'text/plain',
                            },
                        });
                        
                        if (response.ok) {
                            const contentType = response.headers.get('content-type');
                            
                            if (contentType?.includes('json')) {
                                const data = await response.json();
                                // Try to extract Kp from JSON structure
                                // Structure varies, so we'll look for common fields
                                if (data.kp) {
                                    fetchedData = { kp: parseFloat(data.kp) };
                                } else if (data.kp_index) {
                                    fetchedData = { kp: parseFloat(data.kp_index) };
                                } else if (Array.isArray(data) && data.length > 0) {
                                    // Array of measurements
                                    const latest = data[data.length - 1];
                                    if (latest.kp || latest.kp_index) {
                                        fetchedData = { kp: parseFloat(latest.kp || latest.kp_index) };
                                    }
                                }
                            } else {
                                // Text format
                                const text = await response.text();
                                const kp = parseKpData(text);
                                if (kp !== null) {
                                    fetchedData = { kp };
                                }
                            }
                            
                            if (fetchedData) {
                                consecutiveFailures = 0;
                                break; // Success, stop trying other endpoints
                            }
                        }
                    } catch (err) {
                        console.log(`[SpaceWeather] Endpoint ${endpoint} failed:`, err.message);
                        // Continue to next endpoint
                    }
                }
            }
            
            // If API fetch failed, use fallback (simulated based on realistic patterns)
            if (!fetchedData) {
                consecutiveFailures++;
                if (consecutiveFailures > 3) {
                    set({ dataMode: 'fallback' });
                }
                
                // Fallback: Simulate realistic Kp values
                // Kp typically ranges 0-9, with most values between 1-4
                // Use a pattern that varies slowly over time
                const timeBased = (Date.now() / 3600000) % 24; // Hour of day
                const baseKp = 2 + Math.sin(timeBased / 12 * Math.PI) * 1.5;
                const variation = (Math.random() - 0.5) * 0.5;
                fetchedData = {
                    kp: Math.max(0, Math.min(9, baseKp + variation)),
                };
            } else {
                set({ dataMode: 'api', error: null });
            }
            
            const kp = fetchedData.kp || 0;
            // Convert Kp to radiation level (higher Kp = more radiation exposure for ISS)
            const radiationLevel = normalize(kp, RANGES.kpIndex.min, RANGES.kpIndex.max);
            const alertLevel = get().getAlertLevel(radiationLevel);
            
            const rawData = {
                radiationLevel: kp, // Store raw Kp as radiation level proxy
                lastUpdate: new Date().toISOString(),
                alertLevel,
            };
            
            const normalizedData = {
                radiation: radiationLevel, // Already normalized 0-1
            };
            
            set({
                rawData,
                normalizedData,
                error: null,
            });
            
            // Poll every 5 minutes (space weather data updates less frequently)
            setTimeout(poll, 300000);
        };
        
        // Initial poll
        poll();
    },
    
    stopPolling: () => {
        set({ isPolling: false });
    },
}));

