import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'manifest.webmanifest'],
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        // Never hijack pairing helper, APIs, hub, or install profiles.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/hub/i,
          /^\/connect\.html/i,
          /^\/install/i,
        ],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
