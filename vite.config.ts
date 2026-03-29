import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Sate-Map/',
  plugins: [cesium()],
  worker: {
    format: 'es'
  },
  server: {
    proxy: {
      '/api/tle': {
        target: 'https://celestrak.org/NORAD/elements/gp.php',
        changeOrigin: true,
        rewrite: () => '?GROUP=active&FORMAT=tle'
      }
    }
  }
});
