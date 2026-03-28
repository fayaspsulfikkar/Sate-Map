import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Sate-Map/',
  plugins: [cesium()],
  worker: {
    format: 'es'
  }
});
