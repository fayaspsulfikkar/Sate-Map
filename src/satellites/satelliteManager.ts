import { Cartesian3, Color, JulianDate, DistanceDisplayCondition, ArcType } from 'cesium';
import { twoline2satrec, propagate, gstime, eciToEcf } from 'satellite.js';
import type { Viewer, Entity } from 'cesium';
import type { SatelliteData } from './tleLoader';
import type { UIController } from '../ui/controls';
import OrbitWorker from '../workers/orbitWorker?worker';

export class SatelliteManager {
  private viewer: Viewer;
  // private ui: UIController;
  private entities: Entity[] = [];
  private worker: Worker;
  // private satData: SatelliteData[] = [];
  
  // Mapping index directly to point for fast updates
  private pointCount = 0;

  constructor(viewer: Viewer, _ui: UIController) {
    this.viewer = viewer;
    // this.ui = _ui;
    this.viewer = viewer;
    
    // Initialize worker using Vite's ?worker import
    this.worker = new OrbitWorker();

    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = (err) => {
      console.error('Worker failed:', err);
      if (_ui && _ui.setStatus) {
        _ui.setStatus('Worker crashed. Please check console.');
      }
    };
  }

  async initialize(data: SatelliteData[]) {
    this.viewer.entities.removeAll();
    this.pointCount = data.length;
    this.entities = [];

    // Create 3D Entity primitives. Initially placed at center of earth
    for (let i = 0; i < data.length; i++) {
        const sat = data[i];
        let color = Color.fromCssColorString('#a0c0ff'); // LEO Default Blue-ish
        if (sat.type === 'MEO') color = Color.fromCssColorString('#ffc040'); // Orange-ish
        if (sat.type === 'GEO') color = Color.fromCssColorString('#ff6060'); // Red-ish

        const entity = this.viewer.entities.add({
            id: sat.id + '_' + i,
            name: sat.name,
            position: new Cartesian3(0, 0, 0),
            // Distant View (Glowing Dot)
            point: {
                pixelSize: 2, // Tiny dot
                color: color,
                outlineColor: Color.WHITE,
                outlineWidth: 0,
                distanceDisplayCondition: new DistanceDisplayCondition(150000.0, Number.MAX_VALUE)
            },
            // The satellite core (True Scale Box - tiny 2.5 meters)
            box: {
                dimensions: new Cartesian3(2.5, 1.0, 1.0),
                material: color,
                outline: true,
                outlineColor: Color.BLACK,
                distanceDisplayCondition: new DistanceDisplayCondition(0.0, 150000.0)
            },
            // The satellite dish/antenna (True Scale Cylinder - tiny 2 meters)
            cylinder: {
                length: 2.0,
                topRadius: 0.5,
                bottomRadius: 0.0,
                material: Color.fromCssColorString('#ffffff'),
                distanceDisplayCondition: new DistanceDisplayCondition(0.0, 150000.0)
            }
        });
        
        // Attach data for picking logic
        (entity as any)._satData = sat;
        
        this.entities.push(entity);
    }

    // Send initial TLE payload to Worker
    this.worker.postMessage({
      type: 'INITIALIZE',
      data: data.map(d => ({ tle1: d.tle1, tle2: d.tle2 }))
    });

    // Start propagation loop
    this.viewer.scene.preUpdate.addEventListener(this.updateLoop.bind(this));
  }

  private updateLoop() {
    // We send JulianDate to worker each frame
    
    // Note: To optimize, we probably don't need to post every frame if worker is slow,
    // but posting every frame allows it to consume times.
    
    // Cesium JulianDate is days since Noon Jan 1 4713 BC. We just use Viewer clock as a JS Date
    const d = JulianDate.toDate(this.viewer.clock.currentTime);
    
    this.worker.postMessage({
      type: 'COMPUTE',
      time: d.getTime()
    });
  }

  private handleWorkerMessage(e: MessageEvent) {
      if (e.data.type === 'POSITIONS') {
          const positions: Float32Array = e.data.payload;
          
          if (positions.length / 3 !== this.pointCount) {
             console.warn("Positions array length mismatch.");
             return;
          }

          // Buffer comes back as [x1, y1, z1, x2, y2, z2...] in meters
          let ptIndex = 0;
          for (let i = 0; i < positions.length; i += 3) {
             const x = positions[i];
             const y = positions[i + 1];
             const z = positions[i + 2];
             
             const pt = this.entities[ptIndex];
             // 0 values from worker often indicate orbital error (decayed, or invalid TLE for time)
             if (x !== 0 || y !== 0 || z !== 0) {
                 pt.position = new Cartesian3(x, y, z) as any;
                 pt.show = true;
             } else {
                 pt.show = false;
             }
             ptIndex++;
          }
      }
  }

  showOrbit(sat: SatelliteData | null) {
      this.viewer.entities.removeById('active-orbit');
      if (!sat) return;

      try {
          const satrec = twoline2satrec(sat.tle1, sat.tle2);
          const positions = [];
          
          // Generate an orbital ring over 100 minutes
          const now = Date.now();
          for (let i = 0; i < 100; i += 1.5) {
              const t = new Date(now + i * 60000); // add 'i' minutes
              const posVel = propagate(satrec, t);
              if (posVel.position && typeof posVel.position !== 'boolean') {
                  const gmst = gstime(t);
                  const posEcf = eciToEcf(posVel.position, gmst) as any;
                  positions.push(new Cartesian3(posEcf.x * 1000, posEcf.y * 1000, posEcf.z * 1000));
              }
          }

          if (positions.length > 0) {
              // Close the loop
              positions.push(positions[0]);
              
              const color = sat.type === 'MEO' ? '#ffc040' : sat.type === 'GEO' ? '#ff6060' : '#00e676';

              this.viewer.entities.add({
                  id: 'active-orbit',
                  polyline: {
                      positions: positions,
                      width: 2,
                      material: Color.fromCssColorString(color).withAlpha(0.6),
                      arcType: ArcType.NONE
                  }
              });
          }
      } catch (e) {
          console.error("Failed to generate orbit line:", e);
      }
  }
}
