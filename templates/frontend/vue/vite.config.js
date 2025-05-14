import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // Use relative paths for assets when building
  base: './',
  
  // Make sure assets are properly bundled
  build: {
    assetsInlineLimit: 0, // Don't inline assets as base64
    rollupOptions: {
      output: {
        manualChunks: undefined // Don't split chunks
      }
    },
    // Ensure all public files are copied to dist
    copyPublicDir: true
  },
  
  // Configure public directory handling
  publicDir: resolve(__dirname, 'public')
})
