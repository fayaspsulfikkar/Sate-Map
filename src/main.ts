import { Viewer } from 'cesium';
import './style.css';
import { setupUI } from './ui/controls';
import { TLELoader } from './satellites/tleLoader';
import { SatelliteManager } from './satellites/satelliteManager';

async function bootstrap() {
  let ui;
  try {
    // 1. Initialize Cesium Viewer
    const viewer = await initializeViewer();
    
    // 2. Setup UI panels
    ui = setupUI(viewer);

    // 3. Initialize Satellite Manager
    const satelliteManager = new SatelliteManager(viewer, ui);
    ui.onSatelliteClicked = (sat: any) => satelliteManager.showOrbit(sat);

    // 4. Load TLE Data
    const loader = new TLELoader();
    ui.setStatus('Fetching TLE data...');
    const tles = await loader.loadActiveSatellites();
    
    // 5. Initialize Orbits & Render
    ui.setStatus(`Loaded ${tles.length} satellites. Computing orbits...`);
    await satelliteManager.initialize(tles);
    
    ui.setStatus('System Ready', true);
  } catch (err: any) {
    console.error("Bootstrap Error:", err);
    if (ui) {
      ui.setStatus(`Error: ${err.message || 'Check console'}`);
    } else {
      document.body.innerHTML += `<div style="position: absolute; top: 10px; left: 10px; color: red; z-index: 9999; background: black; padding: 10px;">Fatal Error: ${err.message}</div>`;
    }
  }
}

async function initializeViewer(): Promise<Viewer> {
  // We import dynamically or directly use the Viewer. Best to import here to avoid blocking execution.
  const { Viewer, Cartesian3, Math: CesiumMath, Color } = await import('cesium');
  
  // Create viewer without the default UI widgets to maintain clean aesthetic
  const viewer = new Viewer('cesiumContainer', {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    requestRenderMode: false, // Need continuous rendering for animation
  });

  viewer.scene.globe.enableLighting = true; // Sun shading
  viewer.scene.backgroundColor = Color.fromCssColorString('#020205'); // Deep space
  
  // Set default camera view looking at Earth
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(0.0, 20.0, 25000000.0),
    orientation: {
      heading: 0.0,
      pitch: CesiumMath.toRadians(-90.0),
      roll: 0.0
    }
  });

  return viewer;
}

bootstrap().catch(console.error);
