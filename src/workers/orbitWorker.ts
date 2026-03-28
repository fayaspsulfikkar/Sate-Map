// orbitWorker.ts
import { twoline2satrec, propagate, gstime, eciToEcf } from 'satellite.js';

interface SatRecord {
    satrec: any;
    valid: boolean;
}

let satRecords: SatRecord[] = [];
// Use a pre-allocated Float32Array for performance.
// 3 floats per sat: X, Y, Z
let positionBuffer: Float32Array; 

self.onmessage = (e: MessageEvent) => {
    const { type } = e.data;

    if (type === 'INITIALIZE') {
        const tles: { tle1: string, tle2: string }[] = e.data.data;
        satRecords = tles.map(t => {
            const satrec = twoline2satrec(t.tle1, t.tle2);
            return {
                satrec,
                valid: satrec && satrec.error === 0
            };
        });

        positionBuffer = new Float32Array(satRecords.length * 3);
        console.log(`Worker initialized with ${satRecords.length} satellites.`);
    } 
    else if (type === 'COMPUTE') {
        const timeMs = e.data.time;
        const date = new Date(timeMs);
        const gmst = gstime(date);
        
        for (let i = 0; i < satRecords.length; i++) {
            const record = satRecords[i];
            const bufIdx = i * 3;
            
            if (record.valid) {
                // Propagate returns position and velocity in ECI (Earth-centered inertial)
                const positionAndVelocity = propagate(record.satrec, date);
                
                if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
                    // Convert ECI to ECF (Earth-centered, Earth-fixed) for Cesium which spins with the earth
                    const positionEcf = eciToEcf(positionAndVelocity.position as any, gmst);
                    
                    // satellite.js outputs km. Cesium needs meters.
                    positionBuffer[bufIdx] = positionEcf.x * 1000;
                    positionBuffer[bufIdx + 1] = positionEcf.y * 1000;
                    positionBuffer[bufIdx + 2] = positionEcf.z * 1000;
                    continue;
                }
            }

            // Invalid or decayed
            positionBuffer[bufIdx] = 0;
            positionBuffer[bufIdx + 1] = 0;
            positionBuffer[bufIdx + 2] = 0;
        }

        // Post back using transferables for max speed if possible, or just slice. 
        // Sending the buffer directly is fast enough since structured clone for primitive arrays is highly optimized.
        // Actually, returning a copy is ok, or we can use Transferable but that destroys it here.
        self.postMessage({
            type: 'POSITIONS',
            payload: positionBuffer
        });
    }
};
