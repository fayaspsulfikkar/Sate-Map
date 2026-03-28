import { Viewer, defined, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium';

export interface UIController {
  setStatus: (msg: string, isReady?: boolean) => void;
  showSatelliteInfo: (info: any | null) => void;
}

export function setupUI(viewer: Viewer): UIController {
  const container = document.getElementById('uiContainer')!;

  // 1. Controls Panel (Top Right)
  const controlsPanel = document.createElement('div');
  controlsPanel.className = 'panel controls-panel';
  
  const title = document.createElement('h2');
  title.innerText = 'System Status';
  controlsPanel.appendChild(title);

  const statusEl = document.createElement('div');
  statusEl.className = 'data-row';
  statusEl.innerHTML = `<span class="data-label">Status:</span> <span class="data-value" id="sys-status">Initializing...</span>`;
  controlsPanel.appendChild(statusEl);

  // Time controls
  const timeControls = document.createElement('div');
  timeControls.className = 'btn-group';
  
  const speeds = [1, 10, 100];
  speeds.forEach(speed => {
    const btn = document.createElement('button');
    btn.innerText = `${speed}x`;
    btn.onclick = () => {
      viewer.clock.multiplier = speed;
      viewer.clock.shouldAnimate = true;
    };
    timeControls.appendChild(btn);
  });
  
  const pauseBtn = document.createElement('button');
  pauseBtn.innerText = 'Pause';
  pauseBtn.onclick = () => {
    viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate;
    pauseBtn.innerText = viewer.clock.shouldAnimate ? 'Pause' : 'Resume';
  };
  timeControls.appendChild(pauseBtn);
  controlsPanel.appendChild(timeControls);
  container.appendChild(controlsPanel);

  // 2. Info Panel (Bottom Right)
  const infoPanel = document.createElement('div');
  infoPanel.className = 'panel info-panel';
  infoPanel.id = 'sat-info-panel';
  
  const satTitle = document.createElement('h2');
  satTitle.innerText = 'Satellite Data';
  satTitle.id = 'sat-name';
  infoPanel.appendChild(satTitle);

  const fields = ['NORAD ID', 'Altitude', 'Velocity', 'Type'];
  fields.forEach(f => {
    const row = document.createElement('div');
    row.className = 'data-row';
    row.innerHTML = `<span class="data-label">${f}:</span> <span class="data-value" id="sat-${f.toLowerCase().replace(' ', '-')}">--</span>`;
    infoPanel.appendChild(row);
  });

  container.appendChild(infoPanel);

  // Setup Picking (Clicking on Satellites)
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement: any) => {
    const pickedObject = viewer.scene.pick(movement.position);
    if (defined(pickedObject) && pickedObject.id) {
       showSatelliteInfo(pickedObject.id);
    } else {
       showSatelliteInfo(null);
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  function setStatus(msg: string, isReady = false) {
    const el = document.getElementById('sys-status');
    if (el) {
      el.innerText = msg;
      el.style.color = isReady ? '#4caf50' : '#e0e8f5';
    }
  }

  function showSatelliteInfo(info: any | null) {
    if (info) {
      infoPanel.classList.add('visible');
      document.getElementById('sat-name')!.innerText = info.name || 'UNKNOWN';
      document.getElementById('sat-norad-id')!.innerText = info.id || '--';
      
      // We will update altitude and velocity dynamically later, just setting initial values here
      document.getElementById('sat-altitude')!.innerText = info.altitude ? `${info.altitude.toFixed(2)} km` : 'Calc...';
      document.getElementById('sat-velocity')!.innerText = info.velocity ? `${info.velocity.toFixed(2)} km/s` : 'Calc...';
      document.getElementById('sat-type')!.innerText = info.type || 'N/A';
    } else {
      infoPanel.classList.remove('visible');
    }
  }

  return { setStatus, showSatelliteInfo };
}
