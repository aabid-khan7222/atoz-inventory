import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import spaFallback from './vite-plugin-spa-fallback.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spaFallback()],
  server: {
    port: 5173,
    host: true, // Allow external connections for development
  },
  preview: {
    port: 5173,
    host: true, // Allow external connections for preview
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    // Ensure public assets are copied correctly
    copyPublicDir: true,
  },
  // Base path - empty for root deployment
  base: '/',
})
