import { Viewer, defined, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium';

export interface UIController {
  setStatus: (msg: string, isReady?: boolean) => void;
  showSatelliteInfo: (info: any | null) => void;
}

export function setupUI(viewer: Viewer): UIController {
  const container = document.getElementById('uiContainer')!;

  // Detailed Cinematic HUD Panel (Left Align)
  const hudContainer = document.createElement('div');
  hudContainer.className = 'hud-container';
  
  // Header / System Status
  const header = document.createElement('div');
  header.className = 'hud-header';
  header.innerHTML = `
    <div class="hud-brand">SATELLITE <span class="brand-accent">TRACKER</span></div>
    <div class="hud-sys-status"><div class="status-indicator"></div> <span id="sys-status">INITIALIZING SYSTEMS</span></div>
  `;
  hudContainer.appendChild(header);

  // Time Controls
  const timeSection = document.createElement('div');
  timeSection.className = 'hud-section';
  timeSection.innerHTML = `<div class="section-title">TEMPORAL ENGINE</div>`;
  const timeControls = document.createElement('div');
  timeControls.className = 'btn-group';
  
  [1, 10, 100].forEach(speed => {
    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.innerText = `${speed}x`;
    btn.onclick = () => {
      viewer.clock.multiplier = speed;
      viewer.clock.shouldAnimate = true;
    };
    timeControls.appendChild(btn);
  });
  
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'hud-btn btn-danger';
  pauseBtn.innerText = 'PAUSE';
  pauseBtn.onclick = () => {
    viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate;
    pauseBtn.innerText = viewer.clock.shouldAnimate ? 'PAUSE' : 'RESUME';
    pauseBtn.classList.toggle('active', !viewer.clock.shouldAnimate);
  };
  timeControls.appendChild(pauseBtn);
  timeSection.appendChild(timeControls);
  hudContainer.appendChild(timeSection);

  // Telemetry Dashboard (Hidden by default, shown on click)
  const telemetry = document.createElement('div');
  telemetry.className = 'hud-telemetry';
  telemetry.id = 'sat-info-panel';
  
  telemetry.innerHTML = `
    <div class="telemetry-header">
      <div class="target-locked">TARGET LOCKED</div>
      <h2 id="sat-name">UNKNOWN</h2>
    </div>
    <div class="telemetry-grid">
      <div class="t-cell"><span class="t-label">NORAD ID</span><span class="t-val" id="sat-norad-id">--</span></div>
      <div class="t-cell"><span class="t-label">TYPE</span><span class="t-val" id="sat-type">--</span></div>
      <div class="t-cell"><span class="t-label">ALTITUDE</span><span class="t-val" id="sat-altitude">--</span></div>
      <div class="t-cell"><span class="t-label">VELOCITY</span><span class="t-val" id="sat-velocity">--</span></div>
    </div>
  `;
  hudContainer.appendChild(telemetry);

  container.appendChild(hudContainer);

  // Setup Picking (Clicking on Satellites) & Camera Tracking
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement: any) => {
    const pickedObject = viewer.scene.pick(movement.position);
    if (defined(pickedObject) && pickedObject.id) {
       // Lock camera to the 3D model!
       viewer.trackedEntity = pickedObject.id;
       
       const sat = pickedObject.id._satData || pickedObject.id;
       showSatelliteInfo(sat);
    } else {
       viewer.trackedEntity = undefined;
       showSatelliteInfo(null);
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  function setStatus(msg: string, isReady = false) {
    const el = document.getElementById('sys-status');
    const indicator = document.querySelector('.status-indicator') as HTMLElement;
    if (el && indicator) {
      el.innerText = msg.toUpperCase();
      indicator.style.background = isReady ? '#00e676' : '#ffea00';
      indicator.style.boxShadow = isReady ? '0 0 10px #00e676' : '0 0 10px #ffea00';
    }
  }

  function showSatelliteInfo(info: any | null) {
    if (info) {
      telemetry.classList.add('visible');
      document.getElementById('sat-name')!.innerText = info.name || 'UNKNOWN';
      document.getElementById('sat-norad-id')!.innerText = info.id || '--';
      
      // Update data elements dynamically
      document.getElementById('sat-altitude')!.innerText = info.altitude ? `${(info.altitude).toFixed(1)} KM` : 'CALC...';
      document.getElementById('sat-velocity')!.innerText = info.velocity ? `${(info.velocity).toFixed(2)} KM/S` : 'CALC...';
      document.getElementById('sat-type')!.innerText = info.type || 'N/A';
    } else {
      telemetry.classList.remove('visible');
    }
  }

  return { setStatus, showSatelliteInfo };
}
