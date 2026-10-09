import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  plugins: [viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map(name => ({ src: `node_modules/cesium/Build/Cesium/${name}`, dest: 'cesium', rename: { stripBase: 4 } })) })],
  server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787', '/_AMapService': 'http://127.0.0.1:8787' } },
  preview: { port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 5500 },
});
