import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ImmersiveWeatherDashboard',
      formats: ['iife'],
      fileName: () => 'immersive-weather-dashboard.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2021',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
